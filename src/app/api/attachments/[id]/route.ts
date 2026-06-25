import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { FileService } from '@/lib/services/file-service'
import { readFile } from 'fs/promises'
import prisma from '@/lib/prisma'
import {
  assertTicketAccessById,
  TicketAccessError,
  toTicketAccessUser,
} from '@/lib/tickets/ticket-access'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const attachmentId = (await params).id
    const attachment = await prisma.attachments.findUnique({
      where: { id: attachmentId },
      select: { ticketId: true },
    })
    if (!attachment) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
    }

    try {
      await assertTicketAccessById(toTicketAccessUser(session.user), attachment.ticketId, 'read')
    } catch (err) {
      if (err instanceof TicketAccessError) {
        return NextResponse.json({ error: err.message }, { status: err.statusCode })
      }
      throw err
    }

    const fileInfo = await FileService.downloadFile(attachmentId)
    const fileBuffer = await readFile(fileInfo.path)

    // Verificar si es una solicitud de descarga o vista previa
    const { searchParams } = new URL(request.url)
    const download = searchParams.get('download') === 'true'

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': fileInfo.mimeType,
        'Content-Disposition': download 
          ? `attachment; filename="${fileInfo.filename}"`
          : `inline; filename="${fileInfo.filename}"`,
      },
    })
  } catch (error) {
    console.error('Error al descargar archivo:', error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    await FileService.deleteFile((await params).id, session.user.id)
    return NextResponse.json({ message: 'Archivo eliminado exitosamente' })
  } catch (error) {
    console.error('Error al eliminar archivo:', error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
