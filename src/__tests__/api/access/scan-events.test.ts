/**
 * GET /api/access-passes/scan-events
 *
 * Este endpoint era el único de accesos que no usaba los helpers
 * `assertCan*`/`isAccessFamilyAllowed`: reimplementaba el chequeo de permiso
 * y de scope de familia inline, y validaba `result`/`accessType` a mano con
 * arrays redeclarados en vez de los enums centralizados. El fix unifica
 * autorización y validación con el resto de las rutas de accesos, y anida
 * explícitamente el filtro de tipo de acceso/arrendatario y las ramas de
 * `search` bajo un `AND`, para que no puedan pisarse.
 */

import { getServerSession } from 'next-auth'

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    users: { findUnique: jest.fn() },
    access_scan_events: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
  },
}))

jest.mock('@/lib/auth/user-family-access', () => ({
  resolveModuleFamilyScopeIds: jest.fn().mockResolvedValue([]),
}))

jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
  NextRequest: class {},
}))

import prisma from '@/lib/prisma'
import { GET } from '@/app/api/access-passes/scan-events/route'

function makeRequest(query: string) {
  return { url: `https://app.test/api/access-passes/scan-events${query}` } as any
}

describe('GET /api/access-passes/scan-events', () => {
  beforeEach(() => jest.clearAllMocks())

  it('rechaza con 401 si no hay sesión', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    const res = await GET(makeRequest(''))
    expect(res.status).toBe(401)
  })

  it('rechaza con 403 si el usuario no tiene canScan ni canManage', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1', role: 'TECHNICIAN' } })
    ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({
      isActive: true,
      isSuperAdmin: false,
      role: 'TECHNICIAN',
      accessEnabled: false,
      canManageAccess: false,
    })

    const res = await GET(makeRequest(''))

    expect(res.status).toBe(403)
    expect(prisma.access_scan_events.findMany).not.toHaveBeenCalled()
  })

  it('rechaza con 403 un familyId fuera del scope del usuario', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1', role: 'TECHNICIAN' } })
    ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({
      isActive: true,
      isSuperAdmin: false,
      role: 'TECHNICIAN',
      accessEnabled: true,
      canManageAccess: false,
    })
    const { resolveModuleFamilyScopeIds } = jest.requireMock('@/lib/auth/user-family-access')
    ;(resolveModuleFamilyScopeIds as jest.Mock).mockResolvedValue(['family-allowed'])

    const res = await GET(
      makeRequest(`?familyId=${'b'.repeat(8)}-0000-4000-8000-${'c'.repeat(12)}`)
    )

    expect(res.status).toBe(403)
    expect(prisma.access_scan_events.findMany).not.toHaveBeenCalled()
  })

  it('rechaza con 400 un `result` de filtro que no es un AccessScanResult válido', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } })
    ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({
      isActive: true,
      isSuperAdmin: true,
      role: 'ADMIN',
      accessEnabled: true,
      canManageAccess: true,
    })

    const res = await GET(makeRequest('?result=NOT_A_REAL_RESULT'))

    expect(res.status).toBe(400)
    expect(prisma.access_scan_events.findMany).not.toHaveBeenCalled()
  })

  it('combina accessType y search bajo un AND explícito, sin pisarse', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } })
    ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({
      isActive: true,
      isSuperAdmin: true,
      role: 'ADMIN',
      accessEnabled: true,
      canManageAccess: true,
    })

    const res = await GET(makeRequest('?accessType=CONTRACTOR&search=Ana'))

    expect(res.status).toBe(200)
    const [[callArgs]] = (prisma.access_scan_events.findMany as jest.Mock).mock.calls
    const and = callArgs.where.AND as Record<string, unknown>[]
    expect(and.some(clause => JSON.stringify(clause).includes('CONTRACTOR'))).toBe(true)
    expect(and.some(clause => Boolean((clause as { OR?: unknown }).OR))).toBe(true)
  })
})
