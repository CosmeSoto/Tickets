import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { getUploadDir } from '@/lib/upload-path'

/**
 * GET /api/inventory/decommission-acts/[id]/pdf
 *
 * Descarga el PDF del acta de baja.
 * El PDF se genera en el momento de la aprobación y se almacena en
 * /uploads/decommission-acts/{folio}_{timestamp}.pdf
 *
 * Permisos:
 *   - ADMIN (cualquiera)
 *   - El solicitante original
 *   - Gestores con canManageInventory
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id: requestId } = await params

    // Cargar la solicitud con su acta
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

    // Verificar permisos
    const isAdmin = session.user.role === 'ADMIN'
    const isRequester = decommissionRequest.requestedById === session.user.id
    const canManage = await (
      await import('@/lib/inventory/inventory-session')
    ).resolveCanManageInventory(session.user.id, session.user.role)

    if (!isAdmin && !isRequester && !canManage) {
      return NextResponse.json(
        { error: 'No tienes permiso para descargar este PDF' },
        { status: 403 }
      )
    }

    // Verificar que la solicitud esté aprobada y tenga acta
    if (decommissionRequest.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Solo se puede descargar el PDF de solicitudes aprobadas' },
        { status: 400 }
      )
    }

    if (!decommissionRequest.act) {
      return NextResponse.json(
        { error: 'Esta solicitud no tiene acta generada aún' },
        { status: 404 }
      )
    }

    const act = decommissionRequest.act

    if (!act.pdfPath) {
      return NextResponse.json(
        { error: 'El PDF del acta aún no ha sido generado' },
        { status: 404 }
      )
    }

    // Resolver la ruta física del PDF
    // pdfPath puede ser /uploads/decommission-acts/... o una ruta absoluta
    let fullPath: string
    if (act.pdfPath.startsWith('/uploads/')) {
      const relative = act.pdfPath.replace(/^\/uploads\//, '')
      fullPath = getUploadDir(relative)
    } else {
      fullPath = act.pdfPath
    }

    if (!existsSync(fullPath)) {
      return NextResponse.json(
        { error: 'El archivo PDF no está disponible en el servidor' },
        { status: 404 }
      )
    }

    const pdfBuffer = await readFile(fullPath)
    const fileName = `Acta_Baja_${act.folio.replace(/\//g, '-')}.pdf`

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('[decommission-acts/pdf] Error:', error)
    return NextResponse.json({ error: 'Error al descargar el PDF' }, { status: 500 })
  }
}
