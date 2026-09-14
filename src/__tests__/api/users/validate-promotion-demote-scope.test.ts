/**
 * GET /api/users/[id]/validate-promotion y GET /api/users/[id]/demote/validate
 *
 * Ambos exigían solo `role === 'ADMIN'`, a diferencia de sus POST hermanos
 * (`/promote`, `/demote`) que sí llaman `assertAdminCanManageUser`. Un ADMIN
 * no-super fuera del ámbito del usuario objetivo podía consultar estos GET
 * para cualquier usuario del sistema y obtener conteos/bloqueadores
 * organizacionales fuera de su Union_Scope.
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
    users: { findUnique: jest.fn() },
    tickets: { count: jest.fn().mockResolvedValue(0) },
  },
}))

jest.mock('@/lib/auth/admin-scope', () => ({
  assertAdminCanManageUser: jest.fn(),
}))

jest.mock('@/lib/services/user-module-guard.service', () => ({
  UserModuleGuardService: { assertCanChangeRole: jest.fn().mockResolvedValue(undefined) },
  ModuleDisableBlockedError: class ModuleDisableBlockedError extends Error {
    blockers: unknown[] = []
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
import { assertAdminCanManageUser } from '@/lib/auth/admin-scope'
import { GET as validatePromotionGET } from '@/app/api/users/[id]/validate-promotion/route'
import { GET as demoteValidateGET } from '@/app/api/users/[id]/demote/validate/route'

const TARGET_ID = 'target-1'

function params() {
  return { params: Promise.resolve({ id: TARGET_ID }) }
}

function req() {
  return {} as any
}

describe('GET /api/users/[id]/validate-promotion — scope', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', isSuperAdmin: false },
    })
    ;(prisma.users.findUnique as jest.Mock).mockImplementation(({ where }: any) => {
      if (where.id === TARGET_ID) {
        return Promise.resolve({ id: TARGET_ID, name: 'Target', email: 't@x.com', role: 'CLIENT' })
      }
      return Promise.resolve({ isSuperAdmin: false })
    })
  })

  it('regresión: un ADMIN fuera de scope no puede consultar la promoción de un usuario ajeno', async () => {
    ;(assertAdminCanManageUser as jest.Mock).mockResolvedValue({
      allowed: false,
      status: 403,
      error: 'No autorizado para gestionar este usuario',
    })

    const res = await validatePromotionGET(req(), params())

    expect(res.status).toBe(403)
    expect(prisma.tickets.count).not.toHaveBeenCalled()
  })

  it('dentro de scope responde 200 normalmente', async () => {
    ;(assertAdminCanManageUser as jest.Mock).mockResolvedValue({ allowed: true })

    const res = await validatePromotionGET(req(), params())

    expect(res.status).toBe(200)
  })
})

describe('GET /api/users/[id]/demote/validate — scope', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', isSuperAdmin: false },
    })
    ;(prisma.users.findUnique as jest.Mock).mockImplementation(({ where }: any) => {
      if (where.id === TARGET_ID) {
        return Promise.resolve({
          id: TARGET_ID,
          name: 'Target',
          email: 't@x.com',
          role: 'TECHNICIAN',
        })
      }
      return Promise.resolve({ isSuperAdmin: false })
    })
  })

  it('regresión: un ADMIN fuera de scope no puede consultar la despromoción de un técnico ajeno', async () => {
    ;(assertAdminCanManageUser as jest.Mock).mockResolvedValue({
      allowed: false,
      status: 403,
      error: 'No autorizado para gestionar este usuario',
    })

    const res = await demoteValidateGET(req(), params())

    expect(res.status).toBe(403)
  })

  it('dentro de scope responde 200 normalmente', async () => {
    ;(assertAdminCanManageUser as jest.Mock).mockResolvedValue({ allowed: true })

    const res = await demoteValidateGET(req(), params())

    expect(res.status).toBe(200)
  })
})
