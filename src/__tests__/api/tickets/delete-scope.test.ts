/**
 * DELETE /api/tickets/[id]
 *
 * Bug de seguridad real: `if (session.user.role === 'ADMIN') { // Admin
 * puede eliminar cualquier ticket }` — sin ningún chequeo de scope. Un ADMIN
 * de familia (no super admin) podía borrar CUALQUIER ticket del sistema,
 * incluidos los de familias totalmente fuera de su alcance, mientras que el
 * GET/PUT del mismo ticket sí respetan `adminCanOperateTicketFamily`
 * (ticket-access.ts::canDeleteTicket, que la ruta nunca llamaba).
 *
 * El fix delega en `assertTicketAccess(..., 'delete')` — el mismo criterio
 * ya usado por GET/PUT — y mantiene las reglas de negocio adicionales para
 * CLIENT (solo OPEN, sin asignar) que no forman parte de la autorización.
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

  it('regresión: rechaza a un ADMIN fuera de su alcance de familia (antes borraba cualquier ticket)', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', isSuperAdmin: false },
    })
    ;(prisma.tickets.findUnique as jest.Mock).mockResolvedValue(baseTicket())
    ;(adminCanOperateTicketFamily as jest.Mock).mockResolvedValue(false) // fuera de scope

    const res = await DELETE(makeRequest(), params())

    expect(res.status).toBe(403)
    expect(prisma.tickets.delete).not.toHaveBeenCalled()
  })

  it('permite a un ADMIN dentro de su alcance de familia', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', isSuperAdmin: false },
    })
    ;(prisma.tickets.findUnique as jest.Mock).mockResolvedValue(baseTicket())
    ;(adminCanOperateTicketFamily as jest.Mock).mockResolvedValue(true)

    const res = await DELETE(makeRequest(), params())

    expect(res.status).toBe(200)
    expect(prisma.tickets.delete).toHaveBeenCalledWith({ where: { id: TICKET_ID } })
  })

  it('Super Admin puede eliminar cualquier ticket sin consultar scope', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'super-1', role: 'ADMIN', isSuperAdmin: true },
    })
    ;(prisma.tickets.findUnique as jest.Mock).mockResolvedValue(baseTicket())

    const res = await DELETE(makeRequest(), params())

    expect(res.status).toBe(200)
    expect(adminCanOperateTicketFamily).not.toHaveBeenCalled()
  })

  it('regla existente: un cliente no puede eliminar un ticket ya asignado, aunque sea suyo', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'client-1', role: 'CLIENT', isSuperAdmin: false },
    })
    ;(prisma.tickets.findUnique as jest.Mock).mockResolvedValue(
      baseTicket({ clientId: 'client-1', assigneeId: 'tech-1' })
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
