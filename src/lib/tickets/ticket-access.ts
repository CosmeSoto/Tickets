/**
 * Control de acceso centralizado para operaciones sobre tickets por ID.
 *
 * Reglas de scope (ver family-scope.ts):
 * - Admin cola soporte (read/write): solo nativa
 * - Admin puede leer tickets que él solicitó (clientId) aunque sean a otra área
 * - Técnico cola sin asignar: solo nativa; asignado/colaborador/cliente: acceso directo
 */

import prisma from '@/lib/prisma'
import {
  adminCanOperateTicketFamily,
  adminCanViewTicketFamily,
  technicianCanAccessUnassignedQueue,
} from '@/lib/auth/family-scope'

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
    // Solicitante: puede ver sus tickets a otras áreas
    if (ticket.clientId === user.id) return true
    return adminCanViewTicketFamily(user.id, ticket.familyId, user.isSuperAdmin === true)
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
    return adminCanOperateTicketFamily(user.id, ticket.familyId, user.isSuperAdmin === true)
  }

  if (user.role === 'TECHNICIAN') {
    if (ticket.assigneeId === user.id) return true
    return technicianHasWorkQueueAccess(user.id, ticket)
  }

  return false
}

async function canAssignTicket(
  user: TicketAccessUser,
  ticket: TicketAccessRecord
): Promise<boolean> {
  if (user.role !== 'ADMIN') return false
  return adminCanOperateTicketFamily(user.id, ticket.familyId, user.isSuperAdmin === true)
}

async function canManageResolutionPlan(
  user: TicketAccessUser,
  ticket: TicketAccessRecord
): Promise<boolean> {
  if (user.role === 'TECHNICIAN') {
    return ticket.assigneeId === user.id
  }
  if (user.role === 'ADMIN') {
    return adminCanOperateTicketFamily(user.id, ticket.familyId, user.isSuperAdmin === true)
  }
  return false
}

async function canManageCollaborators(
  user: TicketAccessUser,
  ticket: TicketAccessRecord
): Promise<boolean> {
  if (user.role === 'ADMIN') {
    return adminCanOperateTicketFamily(user.id, ticket.familyId, user.isSuperAdmin === true)
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
    return adminCanOperateTicketFamily(user.id, ticket.familyId, user.isSuperAdmin === true)
  }
  if (user.role === 'CLIENT') {
    return ticket.clientId === user.id
  }
  return false
}

/** Acceso por relación directa (asignado, solicitante, colaborador). */
async function technicianHasDirectTicketAccess(
  userId: string,
  ticket: TicketAccessRecord
): Promise<boolean> {
  if (ticket.assigneeId === userId) return true
  if (ticket.clientId === userId) return true

  const isCollaborator = await prisma.ticket_collaborators.findUnique({
    where: {
      ticketId_collaboratorId: { ticketId: ticket.id, collaboratorId: userId },
    },
    select: { ticketId: true },
  })
  return Boolean(isCollaborator)
}

/** Cola de trabajo: solo tickets sin asignar en familia nativa del técnico. */
async function technicianHasWorkQueueAccess(
  userId: string,
  ticket: TicketAccessRecord
): Promise<boolean> {
  if (ticket.assigneeId !== null && ticket.assigneeId !== userId) return false
  return technicianCanAccessUnassignedQueue(userId, ticket.familyId)
}

async function technicianHasTicketAccess(
  userId: string,
  ticket: TicketAccessRecord
): Promise<boolean> {
  if (await technicianHasDirectTicketAccess(userId, ticket)) return true
  if (ticket.assigneeId !== null && ticket.assigneeId !== userId) return false
  return technicianCanAccessUnassignedQueue(userId, ticket.familyId)
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
