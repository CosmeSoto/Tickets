/**
 * PUT /api/tickets/[id] — paridad de efectos al cambiar `status` entre las
 * ramas TECHNICIAN y ADMIN.
 *
 * Bug real: la rama ADMIN nunca ejecutaba ninguno de los efectos de cambio
 * de estado (a diferencia de TECHNICIAN y de PATCH /api/tickets/[id]/status):
 * ni sincronizaba tickets.resolvedAt/closedAt (quedaban en null para
 * siempre), ni llamaba a SLAService.recordResolution, ni disparaba la
 * notificación/email "califica el servicio", ni emitía el evento SSE que
 * refresca en vivo la pantalla del cliente — así que un admin resolviendo/
 * cerrando desde el formulario de edición general lo hacía en silencio y el
 * modal de calificación nunca aparecía. El fix centraliza estos efectos en
 * src/lib/tickets/apply-ticket-status-effects.ts y los llama desde ambas
 * ramas.
 */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    tickets: { findUnique: jest.fn(), update: jest.fn() },
    ticket_history: { create: jest.fn().mockResolvedValue({}) },
    users: { findUnique: jest.fn().mockResolvedValue(null) },
  },
}))

jest.mock('@/lib/tickets/ticket-access', () => ({
  assertTicketAccess: jest.fn().mockResolvedValue(undefined),
  TicketAccessError: class TicketAccessError extends Error {
    statusCode: number
    constructor(message: string, statusCode = 403) {
      super(message)
      this.statusCode = statusCode
    }
  },
  toTicketAccessUser: (u: any) => u,
}))

jest.mock('@/lib/tickets/notify-ticket-changed', () => ({
  notifyTicketChanged: jest.fn(),
  invalidateTicketCaches: jest.fn(),
}))

jest.mock('@/lib/audit', () => ({
  auditTicketChange: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/services/audit-service-complete', () => ({
  AuditServiceComplete: { log: jest.fn().mockResolvedValue(undefined) },
  AuditActionsComplete: { TICKET_PRIORITY_CHANGED: 'x', TICKET_UPDATED: 'y', TICKET_RESOLVED: 'z' },
}))

jest.mock('@/lib/services/sla-service', () => ({
  SLAService: {
    assignSLA: jest.fn().mockResolvedValue(undefined),
    recordResolution: jest.fn().mockResolvedValue(undefined),
  },
}))

jest.mock('@/lib/services/webhook-service', () => ({
  WebhookService: {
    trigger: jest.fn().mockResolvedValue(undefined),
    EVENTS: {
      TICKET_UPDATED: 'ticket.updated',
      TICKET_RESOLVED: 'ticket.resolved',
      TICKET_CLOSED: 'ticket.closed',
      TICKET_REOPENED: 'ticket.reopened',
      TICKET_ASSIGNED: 'ticket.assigned',
    },
  },
}))

jest.mock('@/lib/services/notification-service', () => ({
  NotificationService: {
    notifyTicketResolved: jest.fn().mockResolvedValue(undefined),
    notifyTicketAssigned: jest.fn().mockResolvedValue(undefined),
    push: jest.fn().mockResolvedValue(undefined),
  },
}))

jest.mock('@/lib/ticket-events', () => ({
  TicketEvents: { emit: jest.fn() },
}))

jest.mock('@/lib/notifications/ticket-resolved-email', () => ({
  queueTicketResolvedRaterEmail: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/email-triggers', () => ({
  triggerTicketResolvedToAdminEmail: jest.fn(),
  triggerTicketAssignedToTechnicianEmail: jest.fn(),
  triggerTicketAssignedToClientEmail: jest.fn(),
  triggerTicketClosedEmail: jest.fn(),
  triggerTicketReopenedEmail: jest.fn(),
}))

jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}))

import { getServerSession } from 'next-auth'
import prisma from '@/lib/prisma'
import { SLAService } from '@/lib/services/sla-service'
import { NotificationService } from '@/lib/services/notification-service'
import { TicketEvents } from '@/lib/ticket-events'
import { PUT } from '@/app/api/tickets/[id]/route'

const TICKET_ID = 'ticket-1'

function params() {
  return { params: Promise.resolve({ id: TICKET_ID }) }
}

function makeRequest(body: Record<string, unknown>) {
  return { json: async () => body, url: `https://app.test/api/tickets/${TICKET_ID}` } as any
}

function baseTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: TICKET_ID,
    status: 'OPEN',
    priority: 'MEDIUM',
    clientId: 'client-1',
    assigneeId: 'tech-1',
    familyId: 'family-1',
    source: 'WEB',
    createdById: 'client-1',
    title: 'Impresora atascada',
    ...overrides,
  }
}

describe('PUT /api/tickets/[id] — efectos de cambio de estado (ADMIN y TECHNICIAN)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.tickets.findUnique as jest.Mock).mockResolvedValue(baseTicket())
  })

  describe('ADMIN', () => {
    beforeEach(() => {
      ;(getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'admin-1', role: 'ADMIN', isSuperAdmin: false, name: 'Admin' },
      })
    })

    it('regresión: OPEN → RESOLVED sincroniza resolvedAt, registra SLA y notifica (antes no hacía nada de esto)', async () => {
      ;(prisma.tickets.update as jest.Mock).mockResolvedValue(baseTicket({ status: 'RESOLVED' }))

      await PUT(makeRequest({ status: 'RESOLVED' }), params())

      expect(prisma.tickets.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'RESOLVED', resolvedAt: expect.any(Date) }),
        })
      )
      expect(SLAService.recordResolution).toHaveBeenCalledWith(TICKET_ID)
      expect(NotificationService.notifyTicketResolved).toHaveBeenCalledWith(TICKET_ID)
      expect(TicketEvents.emit).toHaveBeenCalledWith(
        TICKET_ID,
        expect.objectContaining({
          type: 'status_changed',
          status: 'RESOLVED',
          previousStatus: 'OPEN',
        })
      )
    })

    it('regresión: OPEN → CLOSED directo sincroniza closedAt y emite SSE, pero no dispara la notificación de "califica" (esa solo aplica al resolver)', async () => {
      ;(prisma.tickets.update as jest.Mock).mockResolvedValue(baseTicket({ status: 'CLOSED' }))

      await PUT(makeRequest({ status: 'CLOSED' }), params())

      expect(prisma.tickets.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CLOSED', closedAt: expect.any(Date) }),
        })
      )
      expect(SLAService.recordResolution).not.toHaveBeenCalled()
      expect(NotificationService.notifyTicketResolved).not.toHaveBeenCalled()
      expect(TicketEvents.emit).toHaveBeenCalledWith(
        TICKET_ID,
        expect.objectContaining({ type: 'status_changed', status: 'CLOSED' })
      )
    })

    it('sin cambio de estado (solo título) → no dispara ningún efecto de estado', async () => {
      ;(prisma.tickets.update as jest.Mock).mockResolvedValue(baseTicket({ title: 'Nuevo título' }))

      await PUT(makeRequest({ title: 'Nuevo título' }), params())

      expect(SLAService.recordResolution).not.toHaveBeenCalled()
      expect(NotificationService.notifyTicketResolved).not.toHaveBeenCalled()
      expect(TicketEvents.emit).not.toHaveBeenCalled()
    })
  })

  describe('TECHNICIAN (regresión tras el refactor a helper compartido)', () => {
    beforeEach(() => {
      ;(getServerSession as jest.Mock).mockResolvedValue({
        user: { id: 'tech-1', role: 'TECHNICIAN', isSuperAdmin: false, name: 'Técnico' },
      })
      ;(prisma.tickets.findUnique as jest.Mock).mockResolvedValue(
        baseTicket({ status: 'IN_PROGRESS' })
      )
    })

    it('IN_PROGRESS → RESOLVED sigue sincronizando resolvedAt, SLA, notificación y SSE', async () => {
      ;(prisma.tickets.update as jest.Mock).mockResolvedValue(baseTicket({ status: 'RESOLVED' }))

      await PUT(makeRequest({ status: 'RESOLVED' }), params())

      expect(prisma.tickets.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'RESOLVED', resolvedAt: expect.any(Date) }),
        })
      )
      expect(SLAService.recordResolution).toHaveBeenCalledWith(TICKET_ID)
      expect(NotificationService.notifyTicketResolved).toHaveBeenCalledWith(TICKET_ID)
      expect(TicketEvents.emit).toHaveBeenCalledWith(
        TICKET_ID,
        expect.objectContaining({ type: 'status_changed', status: 'RESOLVED' })
      )
    })
  })
})
