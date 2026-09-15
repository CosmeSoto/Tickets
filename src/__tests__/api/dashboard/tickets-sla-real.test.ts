/**
 * GET /api/dashboard/tickets
 *
 * `isOverdue`/`urgencyLevel` se calculaban con una tabla de horas fija por
 * prioridad (HIGH:4h, MEDIUM:24h, LOW:72h — sin URGENT, caía al default de
 * 24h) medida desde `createdAt`, ignorando por completo `sla_policies` y el
 * `slaDeadline` real que el sistema ya calcula. El contador agregado
 * `overdueTickets` (solo ADMIN) tenía el mismo problema con un proxy fijo de
 * "abierto hace más de 24h". Ahora ambos usan el `slaDeadline` real.
 */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    categories: { findMany: jest.fn().mockResolvedValue([]) },
    tickets: { findMany: jest.fn(), count: jest.fn().mockResolvedValue(0) },
  },
}))

jest.mock('@/lib/auth/admin-scope', () => ({
  getAdminTicketFamilyFilter: jest.fn().mockResolvedValue({}),
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
import { getAdminTicketFamilyFilter } from '@/lib/auth/admin-scope'
import { GET } from '@/app/api/dashboard/tickets/route'

function req() {
  return { url: 'https://app.test/api/dashboard/tickets' } as any
}

function baseTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1',
    title: 'Ticket',
    description: 'desc',
    priority: 'HIGH',
    status: 'OPEN',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    resolvedAt: null,
    slaDeadline: null,
    users_tickets_clientIdTousers: { id: 'c1', name: 'Cliente', email: 'c@test.com' },
    users_tickets_assigneeIdTousers: null,
    categories: { id: 'cat-1', name: 'Cat', color: '#000' },
    _count: { comments: 0, attachments: 0 },
    comments: [],
    ...overrides,
  }
}

describe('GET /api/dashboard/tickets — SLA real, no una tabla de horas fija', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.categories.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.tickets.count as jest.Mock).mockResolvedValue(0)
  })

  it('regresión: URGENT con slaDeadline vencido → isOverdue true, urgencyLevel critical (antes URGENT ni se contemplaba)', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'tech-1', role: 'TECHNICIAN' },
    })
    ;(prisma.tickets.findMany as jest.Mock).mockResolvedValue([
      baseTicket({
        priority: 'URGENT',
        slaDeadline: new Date(Date.now() - 60 * 60 * 1000), // vencido hace 1h
      }),
    ])

    const res = await GET(req())
    const body = await res.json()

    expect(body.tickets[0].isOverdue).toBe(true)
    expect(body.tickets[0].urgencyLevel).toBe('critical')
  })

  it('LOW recién creado (hace <72h) pero con slaDeadline real ya vencido → isOverdue true (antes la tabla fija de 72h lo hubiera dado como "a tiempo")', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'tech-1', role: 'TECHNICIAN' },
    })
    ;(prisma.tickets.findMany as jest.Mock).mockResolvedValue([
      baseTicket({
        priority: 'LOW',
        createdAt: new Date(Date.now() - 60 * 60 * 1000), // creado hace solo 1h
        slaDeadline: new Date(Date.now() - 5 * 60 * 1000), // pero su SLA real ya venció
      }),
    ])

    const res = await GET(req())
    const body = await res.json()

    expect(body.tickets[0].isOverdue).toBe(true)
  })

  it('sin slaDeadline (sin política aplicable) → nunca se marca vencido', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'tech-1', role: 'TECHNICIAN' },
    })
    ;(prisma.tickets.findMany as jest.Mock).mockResolvedValue([
      baseTicket({
        priority: 'URGENT',
        createdAt: new Date('2020-01-01'),
        slaDeadline: null,
      }),
    ])

    const res = await GET(req())
    const body = await res.json()

    expect(body.tickets[0].isOverdue).toBe(false)
  })

  it('regresión: el contador overdueTickets (ADMIN) filtra por slaDeadline real, no por "creado hace más de 24h"', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', isSuperAdmin: true },
    })
    ;(prisma.tickets.findMany as jest.Mock).mockResolvedValue([])

    await GET(req())

    expect(getAdminTicketFamilyFilter).toHaveBeenCalled()
    const countCalls = (prisma.tickets.count as jest.Mock).mock.calls
    const overdueCall = countCalls.find(call => call[0]?.where && 'slaDeadline' in call[0].where)
    expect(overdueCall).toBeDefined()
    expect(overdueCall![0].where.slaDeadline).toEqual({ lt: expect.any(Date) })
    // Regresión explícita: ya NO debe quedar el proxy viejo basado en createdAt.
    expect(overdueCall![0].where.createdAt).toBeUndefined()
  })
})
