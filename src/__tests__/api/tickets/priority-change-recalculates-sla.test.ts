/**
 * PUT /api/tickets/[id] — recalcular SLA al cambiar prioridad.
 *
 * Bug real: `SLAService.assignSLA()` solo se llamaba al crear el ticket. Si
 * un técnico o un admin cambiaban la prioridad después (ambos pueden, vía
 * `techAllowed`/`adminAllowed`), el `slaDeadline` quedaba calculado con la
 * prioridad original — desactualizado silenciosamente. El fix vuelve a
 * llamar `assignSLA` en las dos ramas del handler cuando la prioridad
 * efectivamente cambia, y no la toca si no cambió.
 */

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    tickets: { findUnique: jest.fn(), update: jest.fn() },
    ticket_history: { create: jest.fn().mockResolvedValue({}) },
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
  AuditActionsComplete: { TICKET_PRIORITY_CHANGED: 'x', TICKET_UPDATED: 'y' },
}))

jest.mock('@/lib/services/sla-service', () => ({
  SLAService: { assignSLA: jest.fn().mockResolvedValue(undefined) },
}))

jest.mock('@/lib/services/webhook-service', () => ({
  WebhookService: {
    trigger: jest.fn().mockResolvedValue(undefined),
    EVENTS: {
      TICKET_UPDATED: 'ticket.updated',
      TICKET_RESOLVED: 'ticket.resolved',
      TICKET_REOPENED: 'ticket.reopened',
      TICKET_ASSIGNED: 'ticket.assigned',
    },
  },
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

describe('PUT /api/tickets/[id] — recalcula SLA al cambiar prioridad', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.tickets.findUnique as jest.Mock).mockResolvedValue(baseTicket())
  })

  it('TECHNICIAN cambia la prioridad → se recalcula el SLA', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'tech-1', role: 'TECHNICIAN', isSuperAdmin: false, name: 'Técnico' },
    })
    ;(prisma.tickets.update as jest.Mock).mockResolvedValue(baseTicket({ priority: 'URGENT' }))

    await PUT(makeRequest({ priority: 'URGENT' }), params())

    expect(SLAService.assignSLA).toHaveBeenCalledWith(TICKET_ID)
  })

  it('TECHNICIAN cambia el estado pero NO la prioridad → no recalcula el SLA', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'tech-1', role: 'TECHNICIAN', isSuperAdmin: false, name: 'Técnico' },
    })
    ;(prisma.tickets.update as jest.Mock).mockResolvedValue(baseTicket({ status: 'IN_PROGRESS' }))

    await PUT(makeRequest({ status: 'IN_PROGRESS' }), params())

    expect(SLAService.assignSLA).not.toHaveBeenCalled()
  })

  it('ADMIN cambia la prioridad → también se recalcula el SLA', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', isSuperAdmin: false, name: 'Admin' },
    })
    ;(prisma.tickets.update as jest.Mock).mockResolvedValue(baseTicket({ priority: 'LOW' }))

    await PUT(makeRequest({ priority: 'LOW' }), params())

    expect(SLAService.assignSLA).toHaveBeenCalledWith(TICKET_ID)
  })

  it('ADMIN edita el título sin tocar la prioridad → no recalcula el SLA', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', isSuperAdmin: false, name: 'Admin' },
    })
    ;(prisma.tickets.update as jest.Mock).mockResolvedValue(baseTicket({ title: 'Nuevo título' }))

    await PUT(makeRequest({ title: 'Nuevo título' }), params())

    expect(SLAService.assignSLA).not.toHaveBeenCalled()
  })
})
