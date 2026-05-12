import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { FileService } from '@/lib/services/file-service'
import prisma from '@/lib/prisma'

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

    // Verificar permisos
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      select: {
        clientId: true,
        assigneeId: true,
        familyId: true,
      },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })
    }

    const isSuperAdmin = (session.user as any).isSuperAdmin ?? false
    let isAuthorized =
      isSuperAdmin ||
      session.user.role === 'ADMIN' ||
      ticket.clientId === session.user.id ||
      ticket.assigneeId === session.user.id

    // If not yet authorized and user is a technician, check if they have access to the ticket's family
    if (!isAuthorized && session.user.role === 'TECHNICIAN') {
      // Check if technician is assigned to the ticket's family
      const techFamilies = await prisma.technician_family_assignments.findMany({
        where: { technicianId: session.user.id, isActive: true },
        select: { familyId: true },
      })
      const techFamilyIds = techFamilies.map(a => a.familyId)

      // Check if ticket's family is in technician's families, OR ticket is unassigned and technician has any family access
      if (techFamilyIds.length > 0) {
        const hasFamilyAccess = ticket.familyId ? techFamilyIds.includes(ticket.familyId) : true
        const canAccessUnassigned = ticket.assigneeId === null
        isAuthorized = hasFamilyAccess && canAccessUnassigned
      } else {
        // If technician has no family assignments, still allow access if ticket is unassigned
        isAuthorized = ticket.assigneeId === null
      }
    }

    if (!isAuthorized) {
      // Verificar si es colaborador del ticket
      const isCollaborator = await prisma.ticket_collaborators
        .findUnique({
          where: { ticketId_collaboratorId: { ticketId, collaboratorId: session.user.id } },
        })
        .catch(() => null)

      if (!isCollaborator) {
        return NextResponse.json(
          { error: 'No tienes permiso para acceder a este archivo' },
          { status: 403 }
        )
      }
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

    // Solo el creador del archivo o un admin pueden eliminarlo
    const isAuthorized = session.user.role === 'ADMIN' || attachment.uploadedBy === session.user.id

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'No tienes permiso para eliminar este archivo' },
        { status: 403 }
      )
    }

    // Eliminar el archivo
    await FileService.deleteFile(attachmentId, session.user.id)

    return NextResponse.json({ success: true, message: 'Archivo eliminado exitosamente' })
  } catch (error) {
    console.error('Error al eliminar archivo:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
