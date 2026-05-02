import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PDFGeneratorService } from '@/lib/services/pdf-generator.service'
import { ReturnActService } from '@/lib/services/return-act.service'
import { getUploadDir } from '@/lib/upload-path'
import fs from 'fs'
import { promisify } from 'util'

const readFile = promisify(fs.readFile)

/**
 * GET /api/inventory/return-acts/[id]/pdf
 * Descarga el PDF de un acta de devolución.
 * Genera el PDF si no existe todavía.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await params

    const act = await ReturnActService.getActById(id)
    if (!act) {
      return NextResponse.json({ error: 'Acta no encontrada' }, { status: 404 })
    }

    // Verificar permisos: deliverer, receiver o ADMIN
    const userId = session.user.id
    const isAdmin = session.user.role === 'ADMIN'
    const isParticipant =
      (act.receiverInfo as any)?.id === userId || (act.delivererInfo as any)?.id === userId

    if (!isAdmin && !isParticipant) {
      return NextResponse.json({ error: 'Sin permisos para descargar este PDF' }, { status: 403 })
    }

    if (act.status !== 'ACCEPTED') {
      return NextResponse.json(
        { error: 'Solo se pueden descargar PDFs de actas aceptadas' },
        { status: 400 }
      )
    }

    // Obtener o generar PDF
    let pdfPath = await PDFGeneratorService.getReturnActPDFPath(id)

    if (!pdfPath || !(await PDFGeneratorService.pdfExists(pdfPath))) {
      console.log('[RETURN ACT PDF] PDF no encontrado, generando...')
      pdfPath = await PDFGeneratorService.generateReturnActPDF(id)
    }

    // Leer archivo — pdfPath es /uploads/return-acts/... → extraer segmento relativo
    const relative = pdfPath.replace(/^\/uploads\//, '')
    const fullPath = getUploadDir(relative)
    const pdfBuffer = await readFile(fullPath)

    const fileName = `Acta_Devolucion_${act.folio.replace(/\//g, '-')}.pdf`

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Error en GET /api/inventory/return-acts/[id]/pdf:', error)
    const msg = error instanceof Error ? error.message : 'Error al descargar PDF'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
