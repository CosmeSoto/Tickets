/**
 * autoCloseResolvedTickets (src/lib/cron/auto-close-resolved-tickets.ts)
 *
 * Bug real: por cada ticket candidato se hacía `tx.tickets.update({where:
 * {id}})` incondicional dentro de una transacción. Si el cron se ejecutaba
 * dos veces solapado (dos workers, o un disparo manual mientras corre el
 * programado), ambas ejecuciones listaban el mismo ticket ANTES de que
 * cualquiera escribiera (ambas lecturas ocurren antes de cualquier update),
 * y ambas creaban: entrada de historial duplicada + notificación duplicada
 * al cliente y al técnico.
 *
 * El fix reemplaza el `update` por `updateMany({where:{id, status:
 * 'RESOLVED'}})` (claim atómico) — si `count===0` la segunda ejecución no
 * crea historial ni notificaciones para ese ticket.
 */

const txMock = {
  tickets: { updateMany: jest.fn() },
  ticket_history: { create: jest.fn() },
  notifications: { create: jest.fn() },
}

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    system_settings: { findUnique: jest.fn().mockResolvedValue(null) },
    tickets: { findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}))

import prisma from '@/lib/prisma'
import { autoCloseResolvedTickets } from '@/lib/cron/auto-close-resolved-tickets'

function staleTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ticket-1',
    title: 'Impresora atascada',
    clientId: 'client-1',
    assigneeId: 'tech-1',
    ...overrides,
  }
}

describe('autoCloseResolvedTickets', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => cb(txMock))
  })

  it('regresión: dos ejecuciones "solapadas" del mismo ticket — la segunda no duplica historial ni notificaciones', async () => {
    ;(prisma.tickets.findMany as jest.Mock).mockResolvedValue([staleTicket()])

    // Primera ejecución: gana el claim.
    txMock.tickets.updateMany.mockResolvedValueOnce({ count: 1 })
    const first = await autoCloseResolvedTickets()
    expect(first.closed).toBe(1)
    expect(txMock.ticket_history.create).toHaveBeenCalledTimes(1)
    expect(txMock.notifications.create).toHaveBeenCalledTimes(2) // cliente + técnico

    jest.clearAllMocks()
    ;(prisma.tickets.findMany as jest.Mock).mockResolvedValue([staleTicket()])
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => cb(txMock))

    // Segunda ejecución "solapada": el ticket ya no está en RESOLVED (la
    // primera ya lo cerró), el claim no afecta ninguna fila.
    txMock.tickets.updateMany.mockResolvedValueOnce({ count: 0 })
    const second = await autoCloseResolvedTickets()

    expect(second.closed).toBe(0)
    expect(txMock.ticket_history.create).not.toHaveBeenCalled()
    expect(txMock.notifications.create).not.toHaveBeenCalled()
  })

  it('el claim siempre exige status: RESOLVED en el where', async () => {
    ;(prisma.tickets.findMany as jest.Mock).mockResolvedValue([staleTicket()])
    txMock.tickets.updateMany.mockResolvedValue({ count: 1 })

    await autoCloseResolvedTickets()

    expect(txMock.tickets.updateMany).toHaveBeenCalledWith({
      where: { id: 'ticket-1', status: 'RESOLVED' },
      data: expect.objectContaining({ status: 'CLOSED' }),
    })
  })
})
