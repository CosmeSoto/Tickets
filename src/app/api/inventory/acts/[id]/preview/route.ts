import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PDFGeneratorService } from '@/lib/services/pdf-generator.service'
import { DeliveryActService } from '@/lib/services/delivery-act.service'
import { getUploadDir } from '@/lib/upload-path'
import fs from 'fs'
import { promisify } from 'util'

const readFile = promisify(fs.readFile)

/**
 * GET /api/inventory/acts/[id]/preview
 * Devuelve el PDF con Content-Disposition: inline para vista previa en navegador.
 * Mismos permisos que /pdf pero sin restricción de estado ACCEPTED para admins/gestores.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await params
    const act = await DeliveryActService.getActById(id)

    if (!act) {
      return NextResponse.json({ error: 'Acta no encontrada' }, { status: 404 })
    }

    const userId = session.user.id
    const userRole = session.user.role
    const isAdmin = userRole === 'ADMIN'
    const canManage = await (
      await import('@/lib/inventory/inventory-session')
    ).resolveCanManageInventory(session.user.id, session.user.role)
    const isParticipant =
      (act.delivererInfo as any)?.id === userId || (act.receiverInfo as any)?.id === userId

    if (!isAdmin && !canManage && !isParticipant) {
      return NextResponse.json(
        { error: 'Sin permisos para previsualizar este PDF' },
        { status: 403 }
      )
    }

    if (act.status !== 'ACCEPTED') {
      return NextResponse.json(
        { error: 'El PDF solo está disponible para actas aceptadas' },
        { status: 400 }
      )
    }

    let pdfPath = await PDFGeneratorService.getDeliveryActPDFPath(id)
    if (!pdfPath || !(await PDFGeneratorService.pdfExists(pdfPath))) {
      pdfPath = await PDFGeneratorService.generateDeliveryActPDF(id)
    }

    const relative = pdfPath.replace(/^\/uploads\//, '')
    const fullPath = getUploadDir(relative)
    const pdfBuffer = await readFile(fullPath)
    const fileName = `Acta_Entrega_${act.folio.replace(/\//g, '-')}.pdf`

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Error en GET /api/inventory/acts/[id]/preview:', error)
    return NextResponse.json({ error: 'Error al previsualizar PDF' }, { status: 500 })
  }
}
