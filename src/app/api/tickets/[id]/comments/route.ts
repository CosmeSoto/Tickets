import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { randomUUID } from 'crypto'
import { auditCommentCreated } from '@/lib/audit'
import { WebhookService } from '@/lib/services/webhook-service'
import { SLAService } from '@/lib/services/sla-service'
import { queueTicketDigestItem } from '@/lib/notifications/queue-ticket-digest-item'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import { NotificationService } from '@/lib/services/notification-service'
import { FileService } from '@/lib/services/file-service'
import { TicketEvents } from '@/lib/ticket-events'
import { invalidateTicketCaches } from '@/lib/tickets/notify-ticket-changed'
import {
  assertTicketAccess,
  TicketAccessError,
  toTicketAccessUser,
} from '@/lib/tickets/ticket-access'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    const { id: ticketId } = await params
    const contentType = request.headers.get('content-type')

    let commentData: { content: string; isInternal: boolean; files: File[] }
    if (contentType?.includes('multipart/form-data')) {
      const formData = await request.formData()
      const files: File[] = []
      for (const [key, value] of formData.entries()) {
        if (key.startsWith('attachments') && value instanceof File && value.size > 0) {
          files.push(value)
        }
      }
      commentData = {
        content: formData.get('content') as string,
        isInternal: formData.get('isInternal') === 'true',
        files,
      }
    } else {
      const json = await request.json()
      commentData = { content: json.content, isInternal: json.isInternal || false, files: [] }
    }

    if (!commentData.content?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: 'El contenido del comentario es requerido',
        },
        { status: 400 }
      )
    }

    // Verificar que el ticket existe
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        assigneeId: true,
        clientId: true,
        familyId: true,
        status: true,
        title: true,
      },
    })

    if (!ticket) {
      return NextResponse.json({ success: false, message: 'Ticket no encontrado' }, { status: 404 })
    }

    try {
      await assertTicketAccess(toTicketAccessUser(session.user), ticket, 'comment')
    } catch (err) {
      if (err instanceof TicketAccessError) {
        return NextResponse.json(
          { success: false, message: err.message },
          { status: err.statusCode }
        )
      }
      throw err
    }

    const isAdmin = session.user.role === 'ADMIN'
    const isTechnician = session.user.role === 'TECHNICIAN'
    const isClient = ticket.clientId === session.user.id
    const isAssignee = ticket.assigneeId === session.user.id

    if ((isAdmin || isTechnician) && ticket.status === 'OPEN') {
      return NextResponse.json(
        {
          success: false,
          message: 'Pon el ticket En progreso para comentar y registrar actividad en el historial',
        },
        { status: 400 }
      )
    }

    let isCollaborator = false
    if (session.user.role === 'TECHNICIAN' && !isAssignee) {
      const collab = await prisma.ticket_collaborators.findUnique({
        where: { ticketId_collaboratorId: { ticketId, collaboratorId: session.user.id } },
      })
      isCollaborator = !!collab
    }

    // Colaboradores y clientes no pueden hacer comentarios internos
    if (commentData.isInternal && (isClient || isCollaborator)) {
      commentData.isInternal = false
    }

    // Crear comentario en base de datos
    const newComment = await prisma.comments.create({
      data: {
        id: randomUUID(),
        ticketId,
        authorId: session.user.id,
        content: commentData.content,
        isInternal: commentData.isInternal || false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    })

    // Subir archivos adjuntos del comentario
    const uploadedAttachments: {
      id: string
      originalName: string
      mimeType: string
      size: number
    }[] = []
    for (const file of commentData.files) {
      try {
        const attachment = await FileService.uploadFile({
          file,
          ticketId,
          uploadedBy: session.user.id,
          skipHistory: true, // El historial lo maneja el comentario
        })
        uploadedAttachments.push({
          id: attachment.id,
          originalName: attachment.originalName,
          mimeType: attachment.mimeType,
          size: attachment.size,
        })
      } catch (err) {
        console.error('[COMMENT] Error subiendo archivo adjunto:', err)
      }
    }

    // Registrar en historial del ticket para que aparezca en el timeline
    await prisma.ticket_history
      .create({
        data: {
          id: randomUUID(),
          ticketId,
          userId: session.user.id,
          action: 'comment_added',
          comment: newComment.content,
          field: commentData.isInternal ? 'internal_comment' : 'comment',
          // Guardar IDs de adjuntos en newValue como JSON para recuperarlos en el timeline
          newValue:
            uploadedAttachments.length > 0
              ? JSON.stringify(uploadedAttachments.map(a => a.id))
              : null,
          createdAt: new Date(),
        },
      })
      .catch(err => {
        console.error('[COMMENT] Error registrando en historial:', err)
      })

    // ⭐ AUDITORÍA: Registrar creación de comentario (no crítico, en paralelo)
    const sideEffects: Promise<any>[] = [
      auditCommentCreated(
        newComment.id,
        ticketId,
        session.user.id,
        commentData.isInternal || false
      ).catch(err => {
        console.error('[AUDIT] Error en auditCommentCreated:', err)
      }),
      AuditServiceComplete.log({
        action: AuditActionsComplete.COMMENT_ADDED,
        entityType: 'comment',
        entityId: newComment.id,
        userId: session.user.id,
        details: {
          ticketId: ticketId,
          ticketTitle: ticket.title,
          authorName: newComment.users.name,
          authorRole: newComment.users.role,
          isInternal: newComment.isInternal,
          contentPreview: newComment.content.substring(0, 100),
        },
        request: request,
      }).catch(err => {
        console.error('[AUDIT] Error registrando auditoría de comentario:', err)
      }),
    ]

    // Registrar primera respuesta en SLA si es un técnico/admin
    if (session.user.role === 'TECHNICIAN' || session.user.role === 'ADMIN') {
      sideEffects.push(
        SLAService.recordFirstResponse(ticketId).catch(err => {
          console.error('[SLA] Error registrando primera respuesta:', err)
        })
      )
    }

    // Disparar webhook de comentario agregado
    sideEffects.push(
      WebhookService.trigger(WebhookService.EVENTS.COMMENT_ADDED, {
        commentId: newComment.id,
        ticketId,
        author: {
          id: newComment.users.id,
          name: newComment.users.name,
          role: newComment.users.role,
        },
        content: newComment.content.substring(0, 200),
        isInternal: newComment.isInternal,
        createdAt: newComment.createdAt,
      }).catch(err => {
        console.error('[WEBHOOK] Error disparando evento COMMENT_ADDED:', err)
      })
    )

    // Enviar notificaciones in-app
    sideEffects.push(
      NotificationService.notifyNewComment(newComment.id).catch(err => {
        console.error('[NOTIFICATION] Error enviando notificaciones de nuevo comentario:', err)
      })
    )

    // Email al cliente o técnico según quien comentó (también en paralelo)
    if (!newComment.isInternal) {
      sideEffects.push(
        prisma.tickets
          .findUnique({
            where: { id: ticketId },
            include: {
              users_tickets_clientIdTousers: { select: { id: true, name: true, email: true } },
              users_tickets_assigneeIdTousers: { select: { id: true, name: true, email: true } },
            },
          })
          .then(async ticketWithUsers => {
            if (!ticketWithUsers) return
            let recipient = null
            let recipientRole = ''
            if (session.user.role === 'CLIENT') {
              if (ticketWithUsers.users_tickets_assigneeIdTousers) {
                recipient = ticketWithUsers.users_tickets_assigneeIdTousers
                recipientRole = 'técnico'
              }
            } else {
              recipient = ticketWithUsers.users_tickets_clientIdTousers
              recipientRole = 'cliente'
            }
            if (!recipient) return
            const authorName = newComment.users.name
            const authorRole = session.user.role === 'CLIENT' ? 'cliente' : 'técnico'
            const preview = newComment.content.slice(0, 140)
            // No se envía correo individual por cada comentario (satura la bandeja):
            // se encola y un cron lo agrupa en un solo correo por ticket/destinatario
            // cada 30 min (ver src/lib/cron/ticket-activity-digest.ts). La notificación
            // in-app de arriba sigue siendo instantánea.
            await queueTicketDigestItem({
              ticketId,
              recipientId: recipient.id,
              event: 'newComments',
              summary: `${authorName} (${authorRole}) comentó: "${preview}${newComment.content.length > 140 ? '…' : ''}"`,
            })
          })
          .catch(err => {
            console.error('[API] Error sending email for new comment:', err)
          })
      )
    }

    // Lanzar todos los side effects en paralelo sin bloquear la respuesta
    Promise.all(sideEffects)

    // Emitir evento SSE a todos los clientes suscritos a este ticket (instantáneo)
    TicketEvents.emit(ticketId, { type: 'comment_added' })
    void invalidateTicketCaches()

    return NextResponse.json({
      success: true,
      data: {
        id: newComment.id,
        ticketId: newComment.ticketId,
        content: newComment.content,
        isInternal: newComment.isInternal,
        createdAt: newComment.createdAt.toISOString(),
        user: newComment.users,
      },
      message: 'Comentario agregado exitosamente',
    })
  } catch (error) {
    console.error('Error in comments API:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al agregar comentario',
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}
