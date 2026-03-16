import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PDFGeneratorService } from '@/lib/services/pdf-generator.service'
import { DeliveryActService } from '@/lib/services/delivery-act.service'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

const readFile = promisify(fs.readFile)

/**
 * GET /api/inventory/acts/[id]/pdf
 * Descarga el PDF de un acta de entrega
 * Requiere autenticación y permisos (deliverer, receiver o ADMIN)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
    }

    const { id } = params

    // Obtener acta
    const act = await DeliveryActService.getActById(id)
    
    if (!act) {
      return NextResponse.json(
        { error: 'Acta no encontrada' },
        { status: 404 }
      )
    }

    // Verificar permisos: solo deliverer, receiver o ADMIN pueden descargar
    const userId = session.user.id
    const userRole = session.user.role
    
    const isDeliverer = act.delivererInfo.id === userId
    const isReceiver = act.receiverInfo.id === userId
    const isAdmin = userRole === 'ADMIN'

    if (!isDeliverer && !isReceiver && !isAdmin) {
      return NextResponse.json(
        { error: 'No tienes permisos para descargar este PDF' },
        { status: 403 }
      )
    }

    // Verificar que el acta esté aceptada
    if (act.status !== 'ACCEPTED') {
      return NextResponse.json(
        { error: 'Solo se pueden descargar PDFs de actas aceptadas' },
        { status: 400 }
      )
    }

    // Obtener o generar PDF
    let pdfPath = await PDFGeneratorService.getDeliveryActPDFPath(id)
    
    // Si no existe el PDF o el archivo no existe, generarlo
    if (!pdfPath || !(await PDFGeneratorService.pdfExists(pdfPath))) {
      console.log('PDF no encontrado, generando nuevo PDF...')
      pdfPath = await PDFGeneratorService.generateDeliveryActPDF(id)
    }

    // Leer archivo PDF
    const fullPath = path.join(process.cwd(), 'public', pdfPath)
    const pdfBuffer = await readFile(fullPath)

    // Nombre del archivo para descarga
    const fileName = `Acta_Entrega_${act.folio.replace(/\//g, '-')}.pdf`

    // Retornar PDF
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Error en GET /api/inventory/acts/[id]/pdf:', error)
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Error al descargar PDF' },
      { status: 500 }
    )
  }
}
