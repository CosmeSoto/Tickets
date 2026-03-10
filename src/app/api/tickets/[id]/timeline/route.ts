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
    const isClient = session.user.role === 'CLIENT'
    const isOwner = ticket.clientId === session.user.id
    const isAssignee = ticket.assigneeId === session.user.id

    if (!isAdmin && !isTechnician && !isOwner && !isAssignee) {
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

    // Formatear timeline con transformación de eventos
    const timeline = history.map((entry) => {
      const baseEvent = {
        id: entry.id,
        type: mapActionToType(entry.action),
        title: generateTitle(entry.action, entry.field, entry.newValue, entry.oldValue),
        description: generateDescription(entry.action, entry.comment, entry.newValue, entry.oldValue),
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
        metadata: parseMetadata(entry.action, entry.newValue, entry.oldValue, resolutionPlan)
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
  }
  
  return mapping[action] || 'created'
}

// Generar título descriptivo basado en la acción
function generateTitle(action: string, field: string | null, newValue: string | null, oldValue: string | null): string {
  const titles: Record<string, string> = {
    'created': 'Ticket creado',
    'status_changed': 'Estado actualizado',
    'assigned': 'Ticket asignado',
    'unassigned': 'Ticket desasignado',
    'priority_changed': 'Prioridad cambiada',
    'comment_added': 'Comentario agregado',
    'resolution_plan_created': '📋 Plan de resolución creado',
    'resolution_plan_updated': '📋 Plan de resolución actualizado',
    'resolution_plan_completed': '✅ Plan de resolución completado',
    'resolution_plan_deleted': '🗑️ Plan de resolución eliminado',
    'resolution_task_created': '✓ Nueva tarea agregada',
    'resolution_task_updated': '✓ Tarea actualizada',
    'resolution_task_deleted': '✓ Tarea eliminada',
    'rating_submitted': '⭐ Calificación recibida',
    'resolved': 'Ticket resuelto',
  }
  
  return titles[action] || `Cambio en ${field || 'ticket'}`
}

// Generar descripción detallada
function generateDescription(action: string, originalComment: string | null, newValue: string | null, oldValue: string | null): string {
  // Si ya hay un comentario, usarlo
  if (originalComment) {
    return originalComment
  }

  // Generar descripción basada en la acción
  switch (action) {
    case 'resolution_plan_created':
      return `Se ha creado un plan de resolución: "${newValue}". El técnico ha estructurado un plan de trabajo para resolver este ticket de manera organizada.`
    
    case 'resolution_plan_completed':
      return `El plan de resolución "${oldValue}" ha sido completado exitosamente. Todas las tareas programadas han sido finalizadas.`
    
    case 'resolution_plan_deleted':
      return `El plan de resolución "${oldValue}" ha sido eliminado del ticket.`
    
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
function parseMetadata(action: string, newValue: string | null, oldValue: string | null, resolutionPlan: any): any {
  const metadata: any = {
    oldValue,
    newValue
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
