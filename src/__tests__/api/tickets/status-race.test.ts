/**
 * PATCH /api/tickets/[id]/status
 *
 * Bug real: el flujo era `findUnique` → validar en memoria → `update`
 * incondicional sobre `{ where: { id } }`. Dos técnicos tomando casi a la
 * vez un ticket sin asignar (o cualquier doble cambio de estado
 * simultáneo) leían el mismo `status`/`assigneeId`, ambos pasaban la
 * validación de transición, y el `update` dejaba que el último en escribir
 * ganara en silencio — el otro recibía un 200 "éxito" sin que su cambio se
 * hubiera aplicado realmente.
 *
 * El fix reemplaza el `update` por un `updateMany` con
 * `where: { id, status: currentStatus }` (claim atómico) + 409 si `count===0`.
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
    tickets: { findUnique: jest.fn(), updateMany: jest.fn(), findUniqueOrThrow: jest.fn() },
    ticket_history: { create: jest.fn() },
    ticket_collaborators: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    resolution_plans: { findFirst: jest.fn().mockResolvedValue(null) },
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

jest.mock('@/lib/services/notification-service', () => ({
  NotificationService: { notifyTicketResolved: jest.fn(), push: jest.fn() },
}))

jest.mock('@/lib/services/audit-service-complete', () => ({
  AuditServiceComplete: { log: jest.fn().mockResolvedValue(true) },
  AuditActionsComplete: { TICKET_STATUS_CHANGED: 'x', TICKET_RESOLVED: 'y' },
}))

jest.mock('@/lib/api-cache', () => ({ invalidateCache: jest.fn().mockResolvedValue(undefined) }))

jest.mock('@/lib/ticket-events', () => ({ TicketEvents: { emit: jest.fn() } }))

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
import { PATCH } from '@/app/api/tickets/[id]/status/route'

const TICKET_ID = 'ticket-1'

function params() {
  return { params: Promise.resolve({ id: TICKET_ID }) }
}

function makeRequest(body: Record<string, unknown>) {
  return { json: async () => body } as any
}

function baseTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: TICKET_ID,
    status: 'OPEN',
    assigneeId: null,
    clientId: 'client-1',
    createdById: 'client-1',
    source: 'WEB',
    familyId: 'family-1',
    title: 'Impresora atascada',
    ...overrides,
  }
}

describe('PATCH /api/tickets/[id]/status', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'tech-1', role: 'TECHNICIAN', isSuperAdmin: false },
    })
  })

  it('regresión: dos técnicos tomando el mismo ticket sin asignar — el segundo pierde la carrera con 409, no un 200 falso', async () => {
    ;(prisma.tickets.findUnique as jest.Mock).mockResolvedValue(baseTicket())
    // Simula que otro técnico ya lo tomó justo antes del UPDATE: 0 filas afectadas.
    ;(prisma.tickets.updateMany as jest.Mock).mockResolvedValue({ count: 0 })

    const res = await PATCH(makeRequest({ status: 'IN_PROGRESS' }), params())

    expect(res.status).toBe(409)
    expect(prisma.tickets.updateMany).toHaveBeenCalledWith({
      where: { id: TICKET_ID, status: 'OPEN' },
      data: expect.objectContaining({ status: 'IN_PROGRESS', assigneeId: 'tech-1' }),
    })
    expect(prisma.ticket_history.create).not.toHaveBeenCalled()
  })

  it('gana la carrera: claim exitoso, se registra historial y responde 200', async () => {
    ;(prisma.tickets.findUnique as jest.Mock).mockResolvedValue(baseTicket())
    ;(prisma.tickets.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(prisma.tickets.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      ...baseTicket({ status: 'IN_PROGRESS', assigneeId: 'tech-1' }),
      updatedAt: new Date(),
      resolvedAt: null,
      closedAt: null,
      categories: null,
      users_tickets_clientIdTousers: null,
      users_tickets_assigneeIdTousers: null,
    })

    const res = await PATCH(makeRequest({ status: 'IN_PROGRESS' }), params())

    expect(res.status).toBe(200)
    expect(prisma.ticket_history.create).toHaveBeenCalled()
  })
})
