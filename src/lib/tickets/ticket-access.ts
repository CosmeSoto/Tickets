/**
 * Control de acceso centralizado para operaciones sobre tickets por ID.
 * Alineado con el filtrado de GET /api/tickets (familias, asignación, colaboradores).
 */

import prisma from '@/lib/prisma'
import { getUserFamilyScope } from '@/lib/auth/admin-scope'

export type TicketAccessAction =
  | 'read'
  | 'comment'
  | 'write'
  | 'assign'
  | 'manage_collaborators'
  | 'resolution_plan'
  | 'delete'

export interface TicketAccessUser {
  id: string
  role: string
  isSuperAdmin?: boolean
}

export interface TicketAccessRecord {
  id: string
  clientId: string
  assigneeId: string | null
  familyId: string | null
}

export class TicketAccessError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 403
  ) {
    super(message)
    this.name = 'TicketAccessError'
  }
}

export async function loadTicketForAccess(ticketId: string): Promise<TicketAccessRecord | null> {
  return prisma.tickets.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      clientId: true,
      assigneeId: true,
      familyId: true,
    },
  })
}

export async function assertTicketAccess(
  user: TicketAccessUser,
  ticket: TicketAccessRecord,
  action: TicketAccessAction
): Promise<void> {
  const allowed = await canAccessTicket(user, ticket, action)
  if (!allowed) {
    throw new TicketAccessError('No tienes permisos para esta operación en el ticket', 403)
  }
}

export async function assertTicketAccessById(
  user: TicketAccessUser,
  ticketId: string,
  action: TicketAccessAction
): Promise<TicketAccessRecord> {
  const ticket = await loadTicketForAccess(ticketId)
  if (!ticket) {
    throw new TicketAccessError('Ticket no encontrado', 404)
  }
  await assertTicketAccess(user, ticket, action)
  return ticket
}

export async function canAccessTicket(
  user: TicketAccessUser,
  ticket: TicketAccessRecord,
  action: TicketAccessAction
): Promise<boolean> {
  const isSuperAdmin = user.role === 'ADMIN' && user.isSuperAdmin === true

  if (isSuperAdmin) return true

  switch (action) {
    case 'read':
      return canReadTicket(user, ticket)
    case 'comment':
      return canCommentOnTicket(user, ticket)
    case 'write':
      return canWriteTicket(user, ticket)
    case 'assign':
      return canAssignTicket(user, ticket)
    case 'manage_collaborators':
      return canManageCollaborators(user, ticket)
    case 'resolution_plan':
      return canManageResolutionPlan(user, ticket)
    case 'delete':
      return canDeleteTicket(user, ticket)
    default:
      return false
  }
}

async function canReadTicket(user: TicketAccessUser, ticket: TicketAccessRecord): Promise<boolean> {
  if (user.role === 'CLIENT') {
    return ticket.clientId === user.id
  }

  if (user.role === 'ADMIN') {
    return adminHasFamilyAccess(user, ticket.familyId)
  }

  if (user.role === 'TECHNICIAN') {
    return technicianHasTicketAccess(user.id, ticket)
  }

  return false
}

async function canCommentOnTicket(
  user: TicketAccessUser,
  ticket: TicketAccessRecord
): Promise<boolean> {
  if (user.role === 'CLIENT') {
    return ticket.clientId === user.id
  }
  return canReadTicket(user, ticket)
}

async function canWriteTicket(
  user: TicketAccessUser,
  ticket: TicketAccessRecord
): Promise<boolean> {
  if (user.role === 'CLIENT') {
    return ticket.clientId === user.id
  }

  if (user.role === 'ADMIN') {
    return adminHasFamilyAccess(user, ticket.familyId)
  }

  if (user.role === 'TECHNICIAN') {
    if (ticket.assigneeId === user.id) return true
    return technicianHasTicketAccess(user.id, ticket)
  }

  return false
}

async function canAssignTicket(
  user: TicketAccessUser,
  ticket: TicketAccessRecord
): Promise<boolean> {
  if (user.role !== 'ADMIN') return false
  return adminHasFamilyAccess(user, ticket.familyId)
}

/** Crear/editar/eliminar plan de resolución: admin (scope) o técnico asignado únicamente */
async function canManageResolutionPlan(
  user: TicketAccessUser,
  ticket: TicketAccessRecord
): Promise<boolean> {
  if (user.role === 'TECHNICIAN') {
    return ticket.assigneeId === user.id
  }
  if (user.role === 'ADMIN') {
    return adminHasFamilyAccess(user, ticket.familyId)
  }
  return false
}

async function canManageCollaborators(
  user: TicketAccessUser,
  ticket: TicketAccessRecord
): Promise<boolean> {
  if (user.role === 'ADMIN') {
    return adminHasFamilyAccess(user, ticket.familyId)
  }
  if (user.role === 'TECHNICIAN' && ticket.assigneeId === user.id) {
    return true
  }
  return false
}

async function canDeleteTicket(
  user: TicketAccessUser,
  ticket: TicketAccessRecord
): Promise<boolean> {
  if (user.role === 'ADMIN') {
    return adminHasFamilyAccess(user, ticket.familyId)
  }
  if (user.role === 'CLIENT') {
    return ticket.clientId === user.id
  }
  return false
}

async function technicianHasTicketAccess(
  userId: string,
  ticket: TicketAccessRecord
): Promise<boolean> {
  if (ticket.assigneeId === userId) return true

  const isCollaborator = await prisma.ticket_collaborators.findUnique({
    where: {
      ticketId_collaboratorId: { ticketId: ticket.id, collaboratorId: userId },
    },
    select: { ticketId: true },
  })
  if (isCollaborator) return true

  if (!ticket.familyId) {
    return ticket.assigneeId === null
  }

  const techFamilies = await prisma.technician_family_assignments.findMany({
    where: { technicianId: userId, isActive: true },
    select: { familyId: true },
  })
  const techFamilyIds = techFamilies.map(a => a.familyId)
  if (techFamilyIds.length === 0) {
    return ticket.assigneeId === null
  }

  if (!techFamilyIds.includes(ticket.familyId)) {
    return false
  }

  return ticket.assigneeId === null || ticket.assigneeId === userId
}

async function adminHasFamilyAccess(
  user: TicketAccessUser,
  familyId: string | null
): Promise<boolean> {
  if (user.isSuperAdmin) return true
  if (user.role !== 'ADMIN') return false

  const scope = await getUserFamilyScope(user.id, 'ADMIN', false)
  if (scope.familyIds === undefined) return true
  if (scope.familyIds.length === 0) return false

  if (!familyId) return true
  return scope.familyIds.includes(familyId)
}

/** Usuario de sesión NextAuth → TicketAccessUser */
export function toTicketAccessUser(sessionUser: {
  id: string
  role: string
  isSuperAdmin?: boolean
}): TicketAccessUser {
  return {
    id: sessionUser.id,
    role: sessionUser.role,
    isSuperAdmin: (sessionUser as { isSuperAdmin?: boolean }).isSuperAdmin === true,
  }
}
