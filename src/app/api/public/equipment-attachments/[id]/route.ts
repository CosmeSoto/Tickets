import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { checkRateLimit } from '@/lib/rate-limit'
import { DigitalSignatureService } from '@/lib/services/digital-signature.service'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Sin auth por diseño (QR físico) — limitar por IP evita enumeración
    // automatizada de adjuntos.
    const ip = DigitalSignatureService.extractIpAddress(request.headers)
    const rateLimit = await checkRateLimit(`public-equipment-attachment:${ip}`, 30, 15 * 60_000)
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Demasiadas solicitudes. Inténtalo nuevamente más tarde.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter ?? 60) } }
      )
    }

    const { id } = await params

    const attachment = await prisma.equipment_attachments.findUnique({
      where: { id },
      include: { equipment: { select: { id: true } } },
    })

    if (!attachment?.equipment) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
    }

    // Endpoint público (QR): solo imágenes del equipo verificable. SVG queda
    // excluido aunque empiece con "image/" — es el único tipo "imagen" que
    // puede contener <script> y el pipeline de subida ya no lo acepta, pero
    // una fila legacy anterior al fix seguiría siendo servible sin esto.
    if (!attachment.mimeType.startsWith('image/') || attachment.mimeType === 'image/svg+xml') {
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
