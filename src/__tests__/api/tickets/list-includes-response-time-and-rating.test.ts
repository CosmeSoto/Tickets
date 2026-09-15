/**
 * GET /api/tickets — la columna "Primera respuesta" y "Calificación" de las
 * tablas/exportación necesitan que el listado traiga firstResponseAt y
 * ticket_ratings; antes el `select` no los incluía, así que aunque las
 * columnas ya existieran nunca tendrían dato que mostrar.
 */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    tickets: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
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
import { GET } from '@/app/api/tickets/route'

function req() {
  return { url: 'https://app.test/api/tickets' } as any
}

describe('GET /api/tickets — incluye firstResponseAt y ticket_ratings en el select', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'client-1', role: 'CLIENT' },
    })
  })

  it('regresión: el select trae firstResponseAt y la calificación (antes no venían en el listado)', async () => {
    await GET(req())

    expect(prisma.tickets.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          firstResponseAt: true,
          ticket_ratings: { select: { rating: true } },
        }),
      })
    )
  })
})
