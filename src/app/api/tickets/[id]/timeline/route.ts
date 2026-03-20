import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * GET /api/tickets/[id]/timeline
 * Obtiene el timeline (historial) de un ticket
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const params = await context.params
    const ticketId = params.id
    console.log(`[TIMELINE] GET ticketId=${ticketId} user=${session.user.id} role=${session.user.role}`)

    // Verificar que el ticket existe
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        clientId: true,
        assigneeId: true,
      },
    })

    if (!ticket) {
      return NextResponse.json(
        { success: false, error: 'Ticket no encontrado' },
        { status: 404 }
      )
    }

    // Verificar permisos
    const isAdmin = session.user.role === 'ADMIN'
    const isTechnician = session.user.role === 'TECHNICIAN'
    const isOwner = ticket.clientId === session.user.id
    const isAssignee = ticket.assigneeId === session.user.id

    console.log(`[TIMELINE] user=${session.user.id} role=${session.user.role} isOwner=${isOwner} isAssignee=${isAssignee} clientId=${ticket.clientId} assigneeId=${ticket.assigneeId}`)

    if (!isAdmin && !isTechnician && !isOwner && !isAssignee) {
      console.log(`[TIMELINE] 403 - sin permisos`)
      return NextResponse.json(
        { success: false, error: 'No tienes permisos para ver este timeline' },
        { status: 403 }
      )
    }

    // Obtener historial del ticket (más reciente primero)
    const history = await prisma.ticket_history.findMany({
      where: { ticketId },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Obtener plan de resolución si existe para enriquecer metadata
    const resolutionPlan = await prisma.resolution_plans.findFirst({
      where: { ticketId },
      select: {
        id: true,
        title: true,
        status: true,
        totalTasks: true,
        completedTasks: true,
        estimatedHours: true,
        actualHours: true,
        startDate: true,
        targetDate: true,
        completedDate: true,
        createdAt: true,
      }
    })

    // Recopilar IDs de attachments referenciados en comentarios
    const commentAttachmentIds = history
      .filter(e => e.action === 'comment_added' && e.newValue)
      .flatMap(e => {
        try { return JSON.parse(e.newValue!) as string[] } catch { return [] }
      })

    // También recopilar IDs de file_uploaded (newValue es el ID directo)
    const fileUploadedIds = history
      .filter(e => e.action === 'file_uploaded' && e.newValue)
      .map(e => e.newValue!)

    // Cargar attachments de comentarios en una sola query
    const allAttachmentIds = [...commentAttachmentIds, ...fileUploadedIds]
    const commentAttachments = allAttachmentIds.length > 0
      ? await prisma.attachments.findMany({
          where: { id: { in: allAttachmentIds } },
          select: { id: true, originalName: true, mimeType: true, size: true }
        })
      : []
    const attachmentMap = new Map(commentAttachments.map(a => [a.id, a]))

    // Formatear timeline con transformación de eventos
    const timeline = history.map((entry) => {
      const baseEvent = {
        id: entry.id,
        type: mapActionToType(entry.action),
        title: generateTitle(entry.action, entry.field, entry.newValue, entry.oldValue),
        description: generateDescription(entry.action, entry.comment, entry.newValue, entry.oldValue),
        isInternal: entry.field === 'internal_comment',
        user: entry.users
          ? {
              id: entry.users.id,
              name: entry.users.name,
              email: entry.users.email,
              role: entry.users.role,
              avatar: entry.users.avatar,
            }
          : null,
        createdAt: entry.createdAt.toISOString(),
        metadata: parseMetadata(entry.action, entry.newValue, entry.oldValue, resolutionPlan, attachmentMap)
      }

      return baseEvent
    })

    return NextResponse.json({
      success: true,
      data: timeline,
    })
  } catch (error) {
    console.error('[API-TIMELINE] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener el timeline' },
      { status: 500 }
    )
  }
}

// Mapear acciones de BD a tipos de timeline
function mapActionToType(action: string): string {
  const mapping: Record<string, string> = {
    'created': 'created',
    'status_changed': 'status_change',
    'assigned': 'assignment',
    'unassigned': 'assignment',
    'auto_assigned': 'assignment',
    'reassigned': 'assignment',
    'updated': 'status_change',
    'priority_changed': 'priority_change',
    'comment_added': 'comment',
    'resolution_plan_created': 'resolution_plan',
    'resolution_plan_updated': 'resolution_plan',
    'resolution_plan_completed': 'resolution_plan',
    'resolution_plan_deleted': 'resolution_plan',
    'resolution_task_created': 'resolution_task',
    'resolution_task_updated': 'resolution_task',
    'resolution_task_deleted': 'resolution_task',
    'rating_submitted': 'rating',
    'resolved': 'resolution',
    'file_uploaded': 'file_uploaded',
  }
  
  return mapping[action] || 'created'
}

// Generar título descriptivo basado en la acción
function generateTitle(action: string, field: string | null, newValue: string | null, oldValue: string | null): string {
  const titles: Record<string, string> = {
    'created': 'Ticket creado',
    'status_changed': 'Estado actualizado',
    'updated': 'Ticket actualizado',
    'assigned': 'Ticket asignado',
    'unassigned': 'Ticket desasignado',
    'auto_assigned': 'Ticket asignado automáticamente',
    'reassigned': 'Ticket reasignado',
    'priority_changed': 'Prioridad cambiada',
    'comment_added': field === 'internal_comment' ? 'Comentario interno agregado' : 'Comentario agregado',
    'resolution_plan_created': '📋 Plan de resolución creado',
    'resolution_plan_updated': '📋 Plan de resolución actualizado',
    'resolution_plan_completed': '✅ Plan de resolución completado',
    'resolution_plan_deleted': '🗑️ Plan de resolución eliminado',
    'resolution_task_created': '✓ Nueva tarea agregada',
    'resolution_task_updated': '✓ Tarea actualizada',
    'resolution_task_deleted': '✓ Tarea eliminada',
    'rating_submitted': '⭐ Calificación recibida',
    'resolved': 'Ticket resuelto',
    'file_uploaded': 'Archivo adjunto',
  }
  
  return titles[action] || `Cambio en ${field || 'ticket'}`
}

// Generar descripción detallada
function generateDescription(action: string, originalComment: string | null, newValue: string | null, oldValue: string | null): string {
  // Si ya hay un comentario, usarlo
  if (originalComment) {
    return originalComment
  }

  // Para planes de resolución, no generar descripción adicional ya que se muestra en el metadata card
  if (action.includes('resolution_plan')) {
    return ''
  }

  // Generar descripción basada en la acción
  switch (action) {
    case 'assigned':
      return `El ticket ha sido asignado a un técnico para su atención.`
    
    case 'unassigned':
      return `El ticket ha sido desasignado y está disponible para reasignación.`
    
    case 'status_changed':
      return `El estado del ticket cambió de "${oldValue}" a "${newValue}".`
    
    case 'priority_changed':
      return `La prioridad del ticket cambió de "${oldValue}" a "${newValue}".`
    
    default:
      return ''
  }
}

// Parsear metadata para eventos específicos
function parseMetadata(action: string, newValue: string | null, oldValue: string | null, resolutionPlan: any, attachmentMap?: Map<string, { id: string; originalName: string; mimeType: string; size: number }>): any {
  const metadata: any = {
    oldValue,
    newValue
  }

  // Para comentarios, adjuntar archivos si existen
  if (action === 'comment_added' && newValue && attachmentMap) {
    try {
      const ids = JSON.parse(newValue) as string[]
      const attachments = ids
        .map(id => attachmentMap.get(id))
        .filter(Boolean)
        .map(a => ({
          id: a!.id,
          name: a!.originalName,
          size: a!.size,
          type: a!.mimeType,
        }))
      if (attachments.length > 0) {
        metadata.attachments = attachments
      }
    } catch {
      // newValue no es JSON de IDs, ignorar
    }
  }

  // Para archivos subidos directamente, recuperar el attachment por su ID
  if (action === 'file_uploaded' && newValue && attachmentMap) {
    const a = attachmentMap.get(newValue)
    if (a) {
      metadata.attachments = [{
        id: a.id,
        name: a.originalName,
        size: a.size,
        type: a.mimeType,
      }]
    }
  }

  // Para planes de resolución, agregar información completa del plan
  if (action.includes('resolution_plan') && resolutionPlan) {
    metadata.planTitle = resolutionPlan.title
    metadata.status = resolutionPlan.status
    metadata.totalTasks = resolutionPlan.totalTasks
    metadata.completedTasks = resolutionPlan.completedTasks
    metadata.estimatedHours = resolutionPlan.estimatedHours
    metadata.actualHours = resolutionPlan.actualHours
    
    if (resolutionPlan.startDate) {
      metadata.startDate = resolutionPlan.startDate.toISOString()
    }
    if (resolutionPlan.targetDate) {
      metadata.targetDate = resolutionPlan.targetDate.toISOString()
    }
    if (resolutionPlan.completedDate) {
      metadata.completedDate = resolutionPlan.completedDate.toISOString()
    }
  } else if (action.includes('resolution_plan')) {
    // Si no hay plan (fue eliminado), usar el título del newValue/oldValue
    metadata.planTitle = newValue || oldValue
  }

  return metadata
}
