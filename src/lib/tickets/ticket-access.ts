import prisma from '@/lib/prisma'
import { getUserFamilyScope } from '@/lib/auth/admin-scope'

export type TicketAccessAction =
  | 'view'
  | 'comment'
  | 'update'
  | 'delete'
  | 'assign'
  | 'status'
  | 'manage_collaborators'
  | 'rate'

export interface TicketAccessUser {
  id: string
  role: string
  isSuperAdmin?: boolean
}

export interface TicketAccessTicket {
  id: string
  clientId: string
  assigneeId: string | null
  familyId: string | null
  status?: string
}

export interface TicketAccessResult {
  allowed: boolean
  isAdmin: boolean
  isClient: boolean
  isAssignee: boolean
  isCollaborator: boolean
  isSuperAdmin: boolean
  reason?: string
}

function deny(
  context: Omit<TicketAccessResult, 'allowed' | 'reason'>,
  reason = 'No tienes acceso a este ticket'
): TicketAccessResult {
  return { ...context, allowed: false, reason }
}

function allow(context: Omit<TicketAccessResult, 'allowed' | 'reason'>): TicketAccessResult {
  return { ...context, allowed: true }
}

/**
 * Reglas centrales de acceso a tickets.
 *
 * Mantiene compatibilidad con el listado actual:
 * - CLIENT: solo sus tickets.
 * - ADMIN super: todo.
 * - ADMIN normal: solo familias en su scope.
 * - TECHNICIAN: asignado, colaborador, o ticket sin asignar dentro de sus familias.
 */
export async function canAccessTicket(
  user: TicketAccessUser,
  ticket: TicketAccessTicket,
  action: TicketAccessAction = 'view'
): Promise<TicketAccessResult> {
  const isSuperAdmin = user.role === 'ADMIN' && user.isSuperAdmin === true
  const isClient = ticket.clientId === user.id
  const isAssignee = ticket.assigneeId === user.id
  let isCollaborator = false

  if (user.role === 'TECHNICIAN' && !isAssignee) {
    const collaborator = await prisma.ticket_collaborators.findUnique({
      where: { ticketId_collaboratorId: { ticketId: ticket.id, collaboratorId: user.id } },
      select: { id: true },
    })
    isCollaborator = !!collaborator
  }

  const context = {
    isAdmin: user.role === 'ADMIN',
    isClient,
    isAssignee,
    isCollaborator,
    isSuperAdmin,
  }

  if (isSuperAdmin) return allow(context)

  if (user.role === 'CLIENT') {
    if (!isClient) return deny(context)
    if (action === 'rate') return allow(context)
    if (action === 'delete' && ticket.status && ticket.status !== 'OPEN') {
      return deny(context, 'Solo puedes eliminar tickets abiertos')
    }
    return allow(context)
  }

  if (user.role === 'ADMIN') {
    const scope = await getUserFamilyScope(user.id, 'ADMIN', false)
    if (!ticket.familyId) {
      return deny(context, 'El ticket no tiene familia asignada')
    }
    if (!scope.familyIds?.includes(ticket.familyId)) {
      return deny(context, 'No tienes acceso a la familia de este ticket')
    }
    return allow(context)
  }

  if (user.role === 'TECHNICIAN') {
    if (action === 'delete' || action === 'rate' || action === 'assign') {
      return deny(context)
    }
    if (action === 'manage_collaborators') {
      return isAssignee ? allow(context) : deny(context)
    }
    if (action === 'update') {
      return isAssignee ? allow(context) : deny(context)
    }
    if (isAssignee || isCollaborator) return allow(context)

    const scope = await getUserFamilyScope(user.id, 'TECHNICIAN', false)
    const hasFamilyAccess = ticket.familyId
      ? scope.familyIds?.includes(ticket.familyId) === true
      : (scope.familyIds?.length ?? 0) === 0

    if (ticket.assigneeId === null && hasFamilyAccess) {
      return allow(context)
    }

    return deny(context)
  }

  return deny(context)
}

export async function requireTicketAccess(
  user: TicketAccessUser,
  ticket: TicketAccessTicket,
  action: TicketAccessAction = 'view'
): Promise<TicketAccessResult> {
  return canAccessTicket(user, ticket, action)
}
