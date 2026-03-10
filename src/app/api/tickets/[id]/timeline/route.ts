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

    // Obtener historial del ticket
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
        createdAt: 'asc',
      },
    })

    // Formatear timeline con transformación de eventos
    const timeline = history.map((entry) => {
      const baseEvent = {
        id: entry.id,
        type: mapActionToType(entry.action),
        title: entry.description || generateTitle(entry.action, entry.field),
        description: entry.description,
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
        metadata: {
          oldValue: entry.oldValue,
          newValue: entry.newValue,
        }
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
    'resolution_plan_deleted': 'resolution_plan',
    'resolution_task_created': 'resolution_task',
    'resolution_task_updated': 'resolution_task',
    'resolution_task_deleted': 'resolution_task',
    'rating_submitted': 'rating',
    'resolved': 'resolution',
  }
  
  return mapping[action] || 'created'
}

// Generar título basado en la acción
function generateTitle(action: string, field: string | null): string {
  const titles: Record<string, string> = {
    'created': 'Ticket creado',
    'status_changed': 'Estado actualizado',
    'assigned': 'Ticket asignado',
    'unassigned': 'Ticket desasignado',
    'priority_changed': 'Prioridad cambiada',
    'comment_added': 'Comentario agregado',
    'resolution_plan_created': 'Plan de resolución creado',
    'resolution_plan_updated': 'Plan de resolución actualizado',
    'resolution_plan_deleted': 'Plan de resolución eliminado',
    'resolution_task_created': 'Tarea agregada',
    'resolution_task_updated': 'Tarea actualizada',
    'resolution_task_deleted': 'Tarea eliminada',
    'rating_submitted': 'Calificación enviada',
    'resolved': 'Ticket resuelto',
  }
  
  return titles[action] || `Cambio en ${field || 'ticket'}`
}
