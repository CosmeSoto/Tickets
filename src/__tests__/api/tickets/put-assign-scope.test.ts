/**
 * PUT /api/tickets/[id]
 *
 * Bug real: la ruta solo exigía el scope de 'write' para cualquier edición,
 * incluido cambiar `assigneeId` (reasignar). `canWriteTicket` (a diferencia
 * de `canAssignTicket`) deja pasar a un ADMIN que YA es el asignado actual
 * del ticket, sin mirar `adminCanOperateTicketFamily` — así que un ADMIN
 * asignado puntualmente a un ticket fuera de su familia (p. ej. vía PATROL
 * o por otro admin) podía reasignarlo a cualquier técnico por esta vía
 * genérica, cuando el endpoint dedicado PATCH /assign se lo habría negado.
 *
 * El fix agrega un chequeo adicional con acción 'assign' específicamente
 * cuando `updates.assigneeId !== undefined` y el rol es ADMIN.
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
  },
}))

jest.mock('@/lib/tickets/ticket-access', () => ({
  assertTicketAccess: jest.fn(),
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
import { assertTicketAccess, TicketAccessError } from '@/lib/tickets/ticket-access'
import { PUT } from '@/app/api/tickets/[id]/route'

const TICKET_ID = 'ticket-1'

function params() {
  return { params: Promise.resolve({ id: TICKET_ID }) }
}

function makeRequest(body: Record<string, unknown>) {
  return {
    json: async () => body,
    url: `https://app.test/api/tickets/${TICKET_ID}`,
  } as any
}

function baseTicket() {
  return {
    id: TICKET_ID,
    status: 'IN_PROGRESS',
    clientId: 'client-1',
    assigneeId: 'admin-1', // el ADMIN de la prueba ya es el asignado actual
    familyId: 'family-other', // pero fuera de su alcance de familia
    source: 'WEB',
    createdById: 'client-1',
  }
}

describe('PUT /api/tickets/[id] — reasignar exige scope de assign', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', isSuperAdmin: false, name: 'Admin' },
    })
    ;(prisma.tickets.findUnique as jest.Mock).mockResolvedValue(baseTicket())
  })

  it('regresión: un ADMIN asignado pero fuera de scope de familia NO puede reasignar vía PUT', async () => {
    ;(assertTicketAccess as jest.Mock).mockImplementation((_user, _ticket, action) => {
      if (action === 'write') return Promise.resolve() // canWriteTicket: es el assigneeId actual
      if (action === 'assign') {
        return Promise.reject(
          new TicketAccessError('No tienes permisos para esta operación en el ticket', 403)
        )
      }
      return Promise.resolve()
    })

    const res = await PUT(makeRequest({ assigneeId: 'tech-2' }), params())

    expect(res.status).toBe(403)
    expect(assertTicketAccess).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'assign')
    expect(prisma.tickets.update).not.toHaveBeenCalled()
  })

  it('editar campos que NO son assigneeId solo exige el scope de write (no llama a assign)', async () => {
    ;(assertTicketAccess as jest.Mock).mockResolvedValue(undefined)
    ;(prisma.tickets.update as jest.Mock).mockResolvedValue({
      ...baseTicket(),
      title: 'Nuevo título',
    })

    await PUT(makeRequest({ title: 'Nuevo título' }), params())

    const assignCalls = (assertTicketAccess as jest.Mock).mock.calls.filter(
      call => call[2] === 'assign'
    )
    expect(assignCalls).toHaveLength(0)
  })
})
