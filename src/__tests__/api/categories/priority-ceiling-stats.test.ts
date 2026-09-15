/**
 * GET /api/categories/priority-ceiling-stats
 *
 * Con el techo automático de prioridad (categories.priorityCeiling) ya en
 * producción, tickets.requestedPriority queda como el rastro histórico de
 * cuántas veces un cliente pidió más de lo que su categoría permite. Este
 * endpoint agrega ese rastro por categoría — es la señal para que un admin
 * decida si debe subir el techo de una categoría concreta.
 */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { tickets: { groupBy: jest.fn() } },
}))

jest.mock('@/lib/auth/admin-scope', () => ({
  getAdminTicketFamilyFilter: jest.fn(),
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
import { GET } from '@/app/api/categories/priority-ceiling-stats/route'

function req(url = 'https://app.test/api/categories/priority-ceiling-stats') {
  return { url } as any
}

describe('GET /api/categories/priority-ceiling-stats', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getAdminTicketFamilyFilter as jest.Mock).mockResolvedValue({})
  })

  it('CLIENT/TECHNICIAN → 403, no consulta la BD', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'tech-1', role: 'TECHNICIAN' },
    })

    const res = await GET(req())

    expect(res.status).toBe(403)
    expect(prisma.tickets.groupBy).not.toHaveBeenCalled()
  })

  it('ADMIN → agrega por categoría los tickets con requestedPriority no nulo', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', isSuperAdmin: false },
    })
    ;(prisma.tickets.groupBy as jest.Mock).mockResolvedValue([
      { categoryId: 'cat-1', _count: { _all: 7 } },
      { categoryId: 'cat-2', _count: { _all: 2 } },
    ])

    const res = await GET(req())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual([
      { categoryId: 'cat-1', count: 7 },
      { categoryId: 'cat-2', count: 2 },
    ])
    expect(prisma.tickets.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['categoryId'],
        where: expect.objectContaining({ requestedPriority: { not: null } }),
      })
    )
  })

  it('respeta el scope de familia de un admin no-super (reutiliza getAdminTicketFamilyFilter)', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', isSuperAdmin: false },
    })
    ;(getAdminTicketFamilyFilter as jest.Mock).mockResolvedValue({ familyId: { in: ['fam-1'] } })
    ;(prisma.tickets.groupBy as jest.Mock).mockResolvedValue([])

    await GET(req())

    expect(getAdminTicketFamilyFilter).toHaveBeenCalledWith('admin-1', false)
    expect(prisma.tickets.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ familyId: { in: ['fam-1'] } }),
      })
    )
  })

  it('parámetro days se acota entre 1 y 365', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', isSuperAdmin: true },
    })
    ;(prisma.tickets.groupBy as jest.Mock).mockResolvedValue([])

    const res = await GET(req('https://app.test/api/categories/priority-ceiling-stats?days=9999'))
    const body = await res.json()

    expect(body.days).toBe(365)
  })
})
