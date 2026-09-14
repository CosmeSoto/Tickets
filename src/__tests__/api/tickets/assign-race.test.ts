/**
 * PATCH /api/tickets/[id]/assign
 *
 * Mismo patrón que status-race.test.ts: dos admins reasignando el mismo
 * ticket casi al mismo tiempo — `update` incondicional dejaba que el último
 * en escribir ganara en silencio. El fix usa `updateMany` con
 * `where: { id, assigneeId: currentTicket.assigneeId }` (claim atómico) y
 * responde 409 si `count === 0`.
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
  },
}))

jest.mock('@/lib/tickets/ticket-access', () => ({
  assertTicketAccessById: jest.fn().mockResolvedValue({ familyId: 'family-1' }),
  TicketAccessError: class TicketAccessError extends Error {
    statusCode: number
    constructor(message: string, statusCode = 403) {
      super(message)
      this.statusCode = statusCode
    }
  },
  toTicketAccessUser: (u: any) => u,
}))

jest.mock('@/lib/tickets/assignee-validation', () => ({
  assertTechnicianActiveInFamily: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/settings/runtime-settings', () => ({
  getAutoAssignmentEnabled: jest.fn().mockResolvedValue(true),
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
import { PATCH } from '@/app/api/tickets/[id]/assign/route'

const TICKET_ID = 'ticket-1'

function params() {
  return { params: Promise.resolve({ id: TICKET_ID }) }
}

function makeRequest(body: Record<string, unknown>) {
  return { json: async () => body } as any
}

describe('PATCH /api/tickets/[id]/assign', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', isSuperAdmin: false, name: 'Admin' },
    })
    ;(prisma.tickets.findUnique as jest.Mock).mockResolvedValue({
      clientId: 'client-1',
      assigneeId: null,
      familyId: 'family-1',
      users_tickets_assigneeIdTousers: null,
    })
  })

  it('regresión: dos admins reasignando el mismo ticket casi a la vez — el segundo pierde la carrera con 409', async () => {
    ;(prisma.tickets.updateMany as jest.Mock).mockResolvedValue({ count: 0 })

    const res = await PATCH(makeRequest({ assigneeId: 'tech-2' }), params())

    expect(res.status).toBe(409)
    expect(prisma.tickets.updateMany).toHaveBeenCalledWith({
      where: { id: TICKET_ID, assigneeId: null },
      data: expect.objectContaining({ assigneeId: 'tech-2' }),
    })
    expect(prisma.ticket_history.create).not.toHaveBeenCalled()
  })

  it('gana la carrera: claim exitoso, registra historial y responde 200', async () => {
    ;(prisma.tickets.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(prisma.tickets.findUniqueOrThrow as jest.Mock).mockResolvedValue({
      id: TICKET_ID,
      assigneeId: 'tech-1',
      status: 'IN_PROGRESS',
      users_tickets_assigneeIdTousers: {
        id: 'tech-1',
        name: 'Tech',
        email: 't@x.com',
        role: 'TECHNICIAN',
      },
      users_tickets_clientIdTousers: { id: 'client-1', name: 'Client', email: 'c@x.com' },
    })

    const res = await PATCH(makeRequest({ assigneeId: 'tech-1' }), params())

    expect(res.status).toBe(200)
    expect(prisma.ticket_history.create).toHaveBeenCalled()
  })
})
