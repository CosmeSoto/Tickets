import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { canManageInventory } from '@/lib/inventory-access'
import prisma from '@/lib/prisma'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { getUploadDir } from '@/lib/upload-path'

/**
 * GET /api/inventory/decommission-acts/[id]/preview
 * Devuelve el PDF del acta de baja con Content-Disposition: inline para vista previa.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id: requestId } = await params

    const decommissionRequest = await prisma.decommission_requests.findUnique({
      where: { id: requestId },
      include: {
        act: { select: { id: true, folio: true, pdfPath: true } },
        requester: { select: { id: true } },
      },
    })

    if (!decommissionRequest) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
    }

    const isAdmin = session.user.role === 'ADMIN'
    const isRequester = decommissionRequest.requestedById === session.user.id
    const canManage = await canManageInventory(session.user.id, session.user.role)

    if (!isAdmin && !isRequester && !canManage) {
      return NextResponse.json({ error: 'Sin permisos para previsualizar este PDF' }, { status: 403 })
    }

    if (decommissionRequest.status !== 'APPROVED' || !decommissionRequest.act) {
      return NextResponse.json(
        { error: 'El PDF solo está disponible para solicitudes aprobadas' },
        { status: 400 }
      )
    }

    const act = decommissionRequest.act
    if (!act.pdfPath) {
      return NextResponse.json({ error: 'El PDF aún no ha sido generado' }, { status: 404 })
    }

    let fullPath: string
    if (act.pdfPath.startsWith('/uploads/')) {
      const relative = act.pdfPath.replace(/^\/uploads\//, '')
      fullPath = getUploadDir(relative)
    } else {
      fullPath = act.pdfPath
    }

    if (!existsSync(fullPath)) {
      return NextResponse.json({ error: 'El archivo PDF no está disponible' }, { status: 404 })
    }

    const pdfBuffer = await readFile(fullPath)
    const fileName = `Acta_Baja_${act.folio.replace(/\//g, '-')}.pdf`

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('[decommission-acts/preview] Error:', error)
    return NextResponse.json({ error: 'Error al previsualizar PDF' }, { status: 500 })
  }
}
