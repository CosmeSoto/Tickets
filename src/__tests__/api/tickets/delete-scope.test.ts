/**
 * DELETE /api/tickets/[id]
 *
 * Eliminar un ticket es irreversible (cascada a comentarios, adjuntos, plan
 * de resolución, tareas, historial y calificación) — por eso está
 * restringido solo al Super Admin (`canDeleteTicket` en ticket-access.ts).
 * Antes un ADMIN de familia (no super) podía borrar cualquier ticket dentro
 * de su alcance, y un CLIENT podía borrar su propio ticket mientras seguía
 * OPEN y sin asignar; ambas rutas quedaron cerradas a propósito.
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
    tickets: { findUnique: jest.fn(), delete: jest.fn() },
  },
}))

jest.mock('@/lib/auth/family-scope', () => ({
  adminCanOperateTicketFamily: jest.fn(),
  adminCanViewTicketFamily: jest.fn(),
  adminCanAccessPatrolSourcedTicketFamily: jest.fn(),
  technicianCanAccessUnassignedQueue: jest.fn(),
}))

jest.mock('@/lib/services/audit-service-complete', () => ({
  AuditServiceComplete: { log: jest.fn().mockResolvedValue(true) },
  AuditActionsComplete: { TICKET_DELETED: 'TICKET_DELETED' },
}))

jest.mock('@/lib/tickets/notify-ticket-changed', () => ({
  notifyTicketChanged: jest.fn(),
  invalidateTicketCaches: jest.fn(),
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
import { adminCanOperateTicketFamily } from '@/lib/auth/family-scope'
import { DELETE } from '@/app/api/tickets/[id]/route'

const TICKET_ID = 'ticket-1'

function params() {
  return { params: Promise.resolve({ id: TICKET_ID }) }
}

function makeRequest() {
  return { url: `https://app.test/api/tickets/${TICKET_ID}`, headers: { get: () => null } } as any
}

function baseTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: TICKET_ID,
    title: 'Impresora atascada',
    status: 'OPEN',
    priority: 'LOW',
    clientId: 'client-1',
    assigneeId: null,
    familyId: 'family-other',
    source: 'WEB',
    createdById: 'client-1',
    ...overrides,
  }
}

describe('DELETE /api/tickets/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.tickets.delete as jest.Mock).mockResolvedValue({})
  })

  it('rechaza a un ADMIN de familia que no es Super Admin, aunque esté dentro de su alcance', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', isSuperAdmin: false },
    })
    ;(prisma.tickets.findUnique as jest.Mock).mockResolvedValue(baseTicket())
    // Aunque el scope de familia diera acceso, borrar ya no depende de eso.
    ;(adminCanOperateTicketFamily as jest.Mock).mockResolvedValue(true)

    const res = await DELETE(makeRequest(), params())

    expect(res.status).toBe(403)
    expect(prisma.tickets.delete).not.toHaveBeenCalled()
    // canDeleteTicket ya no consulta el scope de familia en absoluto.
    expect(adminCanOperateTicketFamily).not.toHaveBeenCalled()
  })

  it('permite al Super Admin eliminar cualquier ticket', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'super-1', role: 'ADMIN', isSuperAdmin: true },
    })
    ;(prisma.tickets.findUnique as jest.Mock).mockResolvedValue(baseTicket())

    const res = await DELETE(makeRequest(), params())

    expect(res.status).toBe(200)
    expect(prisma.tickets.delete).toHaveBeenCalledWith({ where: { id: TICKET_ID } })
    expect(adminCanOperateTicketFamily).not.toHaveBeenCalled()
  })

  it('un cliente ya no puede eliminar ni su propio ticket, aunque esté OPEN y sin asignar', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'client-1', role: 'CLIENT', isSuperAdmin: false },
    })
    ;(prisma.tickets.findUnique as jest.Mock).mockResolvedValue(
      baseTicket({ clientId: 'client-1', assigneeId: null, status: 'OPEN' })
    )

    const res = await DELETE(makeRequest(), params())

    expect(res.status).toBe(403)
    expect(prisma.tickets.delete).not.toHaveBeenCalled()
  })

  it('regla existente: un técnico nunca puede eliminar tickets', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'tech-1', role: 'TECHNICIAN', isSuperAdmin: false },
    })
    ;(prisma.tickets.findUnique as jest.Mock).mockResolvedValue(
      baseTicket({ assigneeId: 'tech-1' })
    )

    const res = await DELETE(makeRequest(), params())

    expect(res.status).toBe(403)
    expect(prisma.tickets.delete).not.toHaveBeenCalled()
  })
})
