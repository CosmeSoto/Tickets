import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { randomUUID } from 'crypto'
import { auditCommentCreated } from '@/lib/audit'
import { WebhookService } from '@/lib/services/webhook-service'
import { SLAService } from '@/lib/services/sla-service'
import { EmailService } from '@/lib/services/email/email-service'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import { NotificationService } from '@/lib/services/notification-service'
import { FileService } from '@/lib/services/file-service'
import { TicketEvents } from '@/lib/ticket-events'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 401 }
      )
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
          message: 'El contenido del comentario es requerido'
        },
        { status: 400 }
      )
    }

    // Verificar que el ticket existe
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      select: { id: true, assigneeId: true, clientId: true, status: true, title: true },
    })

    if (!ticket) {
      return NextResponse.json(
        { success: false, message: 'Ticket no encontrado' },
        { status: 404 }
      )
    }

    // Verificar acceso: cliente del ticket, técnico asignado, colaborador o admin
    const isAdmin = session.user.role === 'ADMIN'
    const isClient = ticket.clientId === session.user.id
    const isAssignee = ticket.assigneeId === session.user.id

    let isCollaborator = false
    if (session.user.role === 'TECHNICIAN' && !isAssignee) {
      const collab = await prisma.ticket_collaborators.findUnique({
        where: { ticketId_collaboratorId: { ticketId, collaboratorId: session.user.id } },
      })
      isCollaborator = !!collab
    }

    if (!isAdmin && !isClient && !isAssignee && !isCollaborator) {
      return NextResponse.json(
        { success: false, message: 'No tienes acceso a este ticket' },
        { status: 403 }
      )
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
        updatedAt: new Date()
      },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    })

    // Subir archivos adjuntos del comentario
    const uploadedAttachments: { id: string; originalName: string; mimeType: string; size: number }[] = []
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
    await prisma.ticket_history.create({
      data: {
        id: randomUUID(),
        ticketId,
        userId: session.user.id,
        action: 'comment_added',
        comment: newComment.content,
        field: commentData.isInternal ? 'internal_comment' : 'comment',
        // Guardar IDs de adjuntos en newValue como JSON para recuperarlos en el timeline
        newValue: uploadedAttachments.length > 0 ? JSON.stringify(uploadedAttachments.map(a => a.id)) : null,
        createdAt: new Date(),
      }
    }).catch(err => {
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
          contentPreview: newComment.content.substring(0, 100)
        },
        request: request
      }).catch(err => {
        console.error('[AUDIT] Error registrando auditoría de comentario:', err)
      })
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
          role: newComment.users.role
        },
        content: newComment.content.substring(0, 200),
        isInternal: newComment.isInternal,
        createdAt: newComment.createdAt
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
        prisma.tickets.findUnique({
          where: { id: ticketId },
          include: {
            users_tickets_clientIdTousers: { select: { id: true, name: true, email: true } },
            users_tickets_assigneeIdTousers: { select: { id: true, name: true, email: true } }
          }
        }).then(async (ticketWithUsers) => {
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
          const emailBody = `
            <h2>Nuevo Comentario en tu Ticket</h2>
            <p>Hola ${recipient.name},</p>
            <p>Se ha agregado un nuevo comentario en el ticket <strong>#${ticketId.substring(0, 8)}</strong>.</p>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 10px 0;"><strong>De:</strong> ${authorName} (${authorRole})</p>
              <p style="margin: 0 0 10px 0;"><strong>Ticket:</strong> ${ticketWithUsers.title}</p>
              <div style="background-color: white; padding: 15px; border-radius: 6px; margin-top: 15px;">
                <p style="margin: 0; white-space: pre-wrap;">${newComment.content}</p>
              </div>
            </div>
            <div style="margin-top: 30px;">
              <a href="${process.env.NEXTAUTH_URL}/${session.user.role === 'CLIENT' ? 'technician' : 'client'}/tickets/${ticketId}"
                 style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Ver Ticket y Responder
              </a>
            </div>
          `
          await EmailService.queueEmail({
            to: recipient.email,
            subject: `Nuevo comentario en Ticket #${ticketId.substring(0, 8)} - ${ticketWithUsers.title}`,
            html: emailBody,
            text: `Nuevo comentario de ${authorName} (${authorRole}) en ticket #${ticketId.substring(0, 8)}:\n\n${newComment.content}`,
          } as any, session.user.id)
        }).catch(err => {
          console.error('[API] Error sending email for new comment:', err)
        })
      )
    }

    // Lanzar todos los side effects en paralelo sin bloquear la respuesta
    Promise.all(sideEffects)

    // Emitir evento SSE a todos los clientes suscritos a este ticket (instantáneo)
    TicketEvents.emit(ticketId, { type: 'comment_added' })

    return NextResponse.json({
      success: true,
      data: {
        id: newComment.id,
        ticketId: newComment.ticketId,
        content: newComment.content,
        isInternal: newComment.isInternal,
        createdAt: newComment.createdAt.toISOString(),
        user: newComment.users
      },
      message: 'Comentario agregado exitosamente'
    })
  } catch (error) {
    console.error('Error in comments API:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al agregar comentario',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}