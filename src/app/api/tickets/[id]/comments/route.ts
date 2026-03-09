import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { randomUUID } from 'crypto'
import { auditCommentCreated } from '@/lib/audit'
import { WebhookService } from '@/lib/services/webhook-service'
import { SLAService } from '@/lib/services/sla-service'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import { NotificationService } from '@/lib/services/notification-service'

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

    let commentData
    if (contentType?.includes('multipart/form-data')) {
      // Manejar FormData (con archivos)
      const formData = await request.formData()
      commentData = {
        content: formData.get('content') as string,
        isInternal: formData.get('isInternal') === 'true',
        attachments: [] // En producción, procesar archivos aquí
      }
    } else {
      // Manejar JSON
      commentData = await request.json()
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
      where: { id: ticketId }
    })

    if (!ticket) {
      return NextResponse.json(
        { success: false, message: 'Ticket no encontrado' },
        { status: 404 }
      )
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

    // Registrar en auditoría
    await auditCommentCreated(
      newComment.id,
      ticketId,
      session.user.id,
      commentData.isInternal || false
    )

    // ⭐ AUDITORÍA: Registrar creación de comentario
    await AuditServiceComplete.log({
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
    })

    // ⭐ NUEVO: Registrar primera respuesta en SLA si es un técnico/admin
    if (session.user.role === 'TECHNICIAN' || session.user.role === 'ADMIN') {
      await SLAService.recordFirstResponse(ticketId).catch(err => {
        console.error('[SLA] Error registrando primera respuesta:', err)
      })
    }

    // ⭐ NUEVO: Disparar webhook de comentario agregado
    await WebhookService.trigger(WebhookService.EVENTS.COMMENT_ADDED, {
      commentId: newComment.id,
      ticketId,
      author: {
        id: newComment.users.id,
        name: newComment.users.name,
        role: newComment.users.role
      },
      content: newComment.content.substring(0, 200), // Primeros 200 caracteres
      isInternal: newComment.isInternal,
      createdAt: newComment.createdAt
    }).catch(err => {
      console.error('[WEBHOOK] Error disparando evento COMMENT_ADDED:', err)
    })

    // ⭐ NUEVO: Enviar notificaciones in-app
    await NotificationService.notifyNewComment(newComment.id).catch(err => {
      console.error('[NOTIFICATION] Error enviando notificaciones de nuevo comentario:', err)
    })

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