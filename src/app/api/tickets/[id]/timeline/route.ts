import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  translateStatus,
  translatePriority,
  translateField,
  translateFieldNames,
  translateFieldValue,
  TICKET_FIELD_LABELS,
  TICKET_ACTION_LABELS,
} from '@/lib/constants/ticket-labels'
import {
  assertTicketAccess,
  TicketAccessError,
  toTicketAccessUser,
} from '@/lib/tickets/ticket-access'

/**
 * GET /api/tickets/[id]/timeline
 * Obtiene el timeline (historial) de un ticket
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
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
        familyId: true,
      },
    })

    if (!ticket) {
      return NextResponse.json({ success: true, data: [], deleted: true })
    }

    try {
      await assertTicketAccess(toTicketAccessUser(session.user), ticket, 'read')
    } catch (err) {
      if (err instanceof TicketAccessError) {
        return NextResponse.json({ success: false, error: err.message }, { status: err.statusCode })
      }
      throw err
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
      },
    })

    // Recopilar IDs de attachments referenciados en comentarios
    const commentAttachmentIds = history
      .filter(e => e.action === 'comment_added' && e.newValue)
      .flatMap(e => {
        try {
          return JSON.parse(e.newValue!) as string[]
        } catch {
          return []
        }
      })

    // También recopilar IDs de file_uploaded (newValue es el ID directo)
    const fileUploadedIds = history
      .filter(e => e.action === 'file_uploaded' && e.newValue)
      .map(e => e.newValue!)

    // Cargar attachments de comentarios en una sola query
    const allAttachmentIds = [...commentAttachmentIds, ...fileUploadedIds]
    const commentAttachments =
      allAttachmentIds.length > 0
        ? await prisma.attachments.findMany({
            where: { id: { in: allAttachmentIds } },
            select: { id: true, originalName: true, mimeType: true, size: true },
          })
        : []
    const attachmentMap = new Map(commentAttachments.map(a => [a.id, a]))

    // Formatear timeline con transformación de eventos
    const timeline = history.map(entry => {
      const baseEvent = {
        id: entry.id,
        action: entry.action,
        type: mapActionToType(entry.action),
        title: generateTitle(entry.action, entry.field, entry.newValue, entry.oldValue),
        description: generateDescription(
          entry.action,
          entry.comment,
          entry.newValue,
          entry.oldValue
        ),
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
        metadata: parseMetadata(
          entry.action,
          entry.newValue,
          entry.oldValue,
          entry.comment,
          resolutionPlan,
          attachmentMap
        ),
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
    created: 'created',
    status_changed: 'status_change',
    assigned: 'assignment',
    unassigned: 'assignment',
    auto_assigned: 'assignment',
    reassigned: 'assignment',
    updated: 'status_change',
    priority_changed: 'priority_change',
    comment_added: 'comment',
    resolution_plan_created: 'resolution_plan',
    resolution_plan_updated: 'resolution_plan',
    resolution_plan_completed: 'resolution_plan',
    resolution_plan_deleted: 'resolution_plan',
    resolution_task_created: 'resolution_task',
    resolution_task_updated: 'resolution_task',
    resolution_task_deleted: 'resolution_task',
    rating_submitted: 'rating',
    resolved: 'resolution',
    file_uploaded: 'file_uploaded',
  }

  return mapping[action] || 'created'
}

// Traducción de valores de campos técnicos a español legible
// — Ahora importado desde @/lib/constants/ticket-labels —

function translateValue(field: string | null, value: string | null): string {
  return translateFieldValue(field, value)
}

function translateFields(fields: string): string {
  return translateFieldNames(fields.split(','))
}

// Generar título descriptivo basado en la acción
function generateTitle(
  action: string,
  field: string | null,
  newValue: string | null,
  oldValue: string | null
): string {
  switch (action) {
    case 'created':
      return 'Ticket creado'
    case 'status_changed': {
      const from = translateFieldValue('status', oldValue)
      const to = translateFieldValue('status', newValue)
      return `Estado: ${from} → ${to}`
    }
    case 'updated':
      return 'Ticket actualizado'
    case 'assigned':
      return 'Técnico asignado'
    case 'unassigned':
      return 'Técnico desasignado'
    case 'auto_assigned':
      return 'Asignación automática'
    case 'reassigned':
      return 'Técnico reasignado'
    case 'priority_changed': {
      const from = translateFieldValue('priority', oldValue)
      const to = translateFieldValue('priority', newValue)
      return `Prioridad: ${from} → ${to}`
    }
    case 'comment_added':
      return field === 'internal_comment' ? 'Nota interna' : 'Comentario'
    case 'resolution_plan_created':
      return 'Plan de resolución creado'
    case 'resolution_plan_updated':
      return 'Plan de resolución actualizado'
    case 'resolution_plan_completed':
      return 'Plan de resolución completado'
    case 'resolution_plan_deleted':
      return 'Plan de resolución eliminado'
    case 'resolution_task_created':
      return 'Nueva tarea agregada'
    case 'resolution_task_updated':
      return 'Tarea actualizada'
    case 'resolution_task_deleted':
      return 'Tarea eliminada'
    case 'rating_submitted':
      return 'Calificación recibida'
    case 'resolved':
      return 'Ticket marcado como resuelto'
    case 'file_uploaded':
      return 'Archivo adjunto'
    default:
      return field ? `Cambio en ${translateField(field)}` : 'Cambio en ticket'
  }
}

// Generar descripción detallada
function generateDescription(
  action: string,
  originalComment: string | null,
  newValue: string | null,
  oldValue: string | null
): string {
  // Para eventos de resolution_plan, el comment contiene metadata JSON, no texto legible
  if (action.includes('resolution_plan') || action.includes('resolution_task')) {
    return ''
  }

  if (originalComment) {
    return originalComment.replace(
      /actualizó:\s*([a-zA-Z,\s]+)/g,
      (_, fields) => `actualizó: ${translateFieldNames(fields.split(','))}`
    )
  }
  switch (action) {
    case 'assigned':
      return newValue ? `Asignado a ${newValue}` : 'El ticket fue asignado para su atención.'
    case 'unassigned':
      return 'El ticket quedó sin asignar y está disponible para reasignación.'
    case 'auto_assigned':
      return newValue
        ? `Asignado automáticamente a ${newValue}`
        : 'Asignación automática completada.'
    case 'reassigned':
      return newValue ? `Reasignado a ${newValue}` : 'El ticket fue reasignado.'
    case 'status_changed': {
      const from = translateStatus(oldValue ?? '')
      const to = translateStatus(newValue ?? '')
      return `El estado cambió de "${from}" a "${to}".`
    }
    case 'priority_changed': {
      const from = translatePriority(oldValue ?? '')
      const to = translatePriority(newValue ?? '')
      return `La prioridad cambió de "${from}" a "${to}".`
    }
    case 'updated': {
      if (newValue) return `Se actualizó: ${translateFieldNames(newValue.split(','))}.`
      return 'Se actualizaron los datos del ticket.'
    }
    case 'resolved':
      return 'El técnico marcó el ticket como resuelto. El solicitante puede calificar el servicio.'
    case 'created':
      return 'El ticket fue registrado en el sistema.'
    default:
      return ''
  }
}

// Parsear metadata para eventos específicos
function parseMetadata(
  action: string,
  newValue: string | null,
  oldValue: string | null,
  comment: string | null,
  resolutionPlan: any,
  attachmentMap?: Map<string, { id: string; originalName: string; mimeType: string; size: number }>
): any {
  const metadata: any = {
    oldValue,
    newValue,
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
      metadata.attachments = [
        {
          id: a.id,
          name: a.originalName,
          size: a.size,
          type: a.mimeType,
        },
      ]
    }
  }

  // Para planes de resolución, usar el snapshot guardado en `comment` como fuente primaria
  // y complementar con datos actuales del plan solo lo que no esté en el snapshot.
  // Esto garantiza que cada entrada del historial muestre el estado del plan EN ESE MOMENTO,
  // no el estado actual (que podría ser "completado" aunque el evento sea "creado").
  if (action.includes('resolution_plan')) {
    // Fuente 1: snapshot guardado en el campo comment al momento del evento (más fiel)
    if (comment) {
      try {
        const savedMeta = JSON.parse(comment)
        if (savedMeta.planTitle) metadata.planTitle = savedMeta.planTitle
        if (savedMeta.description) metadata.description = savedMeta.description
        if (savedMeta.status) metadata.status = savedMeta.status
        if (savedMeta.startDate) metadata.startDate = savedMeta.startDate
        if (savedMeta.targetDate) metadata.targetDate = savedMeta.targetDate
        if (savedMeta.completedDate) metadata.completedDate = savedMeta.completedDate
        if (savedMeta.estimatedHours != null) metadata.estimatedHours = savedMeta.estimatedHours
        if (savedMeta.actualHours != null) metadata.actualHours = savedMeta.actualHours
        if (savedMeta.totalTasks != null) metadata.totalTasks = savedMeta.totalTasks
        if (savedMeta.completedTasks != null) metadata.completedTasks = savedMeta.completedTasks
      } catch {
        // comment no es JSON, ignorar
      }
    }

    // Fuente 2: datos actuales del plan — solo para rellenar lo que el snapshot no tiene
    // (p. ej. planes creados antes de que se guardara el snapshot completo)
    if (resolutionPlan) {
      if (!metadata.planTitle) metadata.planTitle = resolutionPlan.title
      if (!metadata.status) metadata.status = resolutionPlan.status
      if (metadata.totalTasks == null) metadata.totalTasks = resolutionPlan.totalTasks
      if (metadata.completedTasks == null) metadata.completedTasks = resolutionPlan.completedTasks
      if (metadata.estimatedHours == null) metadata.estimatedHours = resolutionPlan.estimatedHours
      if (!metadata.startDate && resolutionPlan.startDate)
        metadata.startDate = resolutionPlan.startDate.toISOString()
      if (!metadata.targetDate && resolutionPlan.targetDate)
        metadata.targetDate = resolutionPlan.targetDate.toISOString()
      // completedDate y actualHours solo para eventos de completado
      // (no contaminar el evento "creado" con datos que no existían entonces)
      if (action === 'resolution_plan_completed') {
        if (!metadata.completedDate && resolutionPlan.completedDate)
          metadata.completedDate = resolutionPlan.completedDate.toISOString()
        if (metadata.actualHours == null) metadata.actualHours = resolutionPlan.actualHours
      }
    }

    // Fallback final: usar newValue/oldValue como título
    if (!metadata.planTitle) {
      metadata.planTitle = newValue || oldValue
    }
  }

  return metadata
}
