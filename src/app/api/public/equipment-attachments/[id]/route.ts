import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const attachment = await prisma.equipment_attachments.findUnique({
      where: { id },
      include: { equipment: { select: { id: true } } },
    })

    if (!attachment?.equipment) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
    }

    // Endpoint público (QR): solo imágenes del equipo verificable
    if (!attachment.mimeType.startsWith('image/')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    if (!existsSync(attachment.path)) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
    }

    const fileBuffer = await readFile(attachment.path)

    const { searchParams } = new URL(request.url)
    const download = searchParams.get('download') === 'true'

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Disposition': download
          ? `attachment; filename="${attachment.originalName}"`
          : `inline; filename="${attachment.originalName}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Error al descargar archivo público:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
