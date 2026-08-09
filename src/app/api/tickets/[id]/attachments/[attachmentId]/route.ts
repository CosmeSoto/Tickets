import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { FileService } from '@/lib/services/file-service'
import prisma from '@/lib/prisma'
import {
  assertTicketAccessById,
  TicketAccessError,
  toTicketAccessUser,
} from '@/lib/tickets/ticket-access'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id: ticketId, attachmentId } = await params
    const { searchParams } = new URL(request.url)
    const isPreview = searchParams.get('preview') === 'true'

    // Verificar que el archivo existe y pertenece al ticket
    const attachment = await prisma.attachments.findFirst({
      where: {
        id: attachmentId,
        ticketId: ticketId,
      },
    })

    if (!attachment) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
    }

    try {
      await assertTicketAccessById(toTicketAccessUser(session.user), ticketId, 'read')
    } catch (err) {
      if (err instanceof TicketAccessError) {
        return NextResponse.json({ error: err.message }, { status: err.statusCode })
      }
      throw err
    }

    // Obtener el archivo del servicio
    const fileData = await FileService.getFile(attachmentId)

    if (!fileData) {
      return NextResponse.json(
        { error: 'Archivo no encontrado en el almacenamiento' },
        { status: 404 }
      )
    }

    // Determinar Content-Disposition según el modo
    const disposition = isPreview ? 'inline' : 'attachment'

    // Retornar el archivo con los headers apropiados
    return new NextResponse(fileData.buffer, {
      headers: {
        'Content-Type': attachment.mimeType || 'application/octet-stream',
        'Content-Disposition': `${disposition}; filename="${encodeURIComponent(attachment.originalName)}"`,
        'Content-Length': attachment.size.toString(),
      },
    })
  } catch (error) {
    console.error('Error al descargar archivo:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id: ticketId, attachmentId } = await params

    // Verificar que el archivo existe
    const attachment = await prisma.attachments.findFirst({
      where: {
        id: attachmentId,
        ticketId: ticketId,
      },
    })

    if (!attachment) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
    }

    try {
      const isUploader = attachment.uploadedBy === session.user.id
      await assertTicketAccessById(
        toTicketAccessUser(session.user),
        ticketId,
        isUploader ? 'comment' : 'write'
      )
    } catch (err) {
      if (err instanceof TicketAccessError) {
        return NextResponse.json({ error: err.message }, { status: err.statusCode })
      }
      throw err
    }

    await FileService.deleteFile(attachmentId, session.user.id)

    return NextResponse.json({ success: true, message: 'Archivo eliminado exitosamente' })
  } catch (error) {
    console.error('Error al eliminar archivo:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
