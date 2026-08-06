/**
 * API unificada /api/admin/users/[id]/family-access
 * Usa request mock (evita conflicto NextRequest vs polyfill Request de jest.setup).
 */

import { getServerSession } from 'next-auth'
import type { NextRequest } from 'next/server'

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
  },
}))

jest.mock('@/lib/auth/user-family-access', () => ({
  getUserFamilyAccessSnapshot: jest.fn(),
  assignUserModuleFamily: jest.fn(),
  unassignUserModuleFamily: jest.fn(),
  setUserModuleFamilies: jest.fn(),
}))

jest.mock('@/lib/auth/admin-scope', () => ({
  getUserFamilyScope: jest.fn(),
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
import { GET, POST, PUT, DELETE } from '@/app/api/admin/users/[id]/family-access/route'
import {
  getUserFamilyAccessSnapshot,
  assignUserModuleFamily,
  unassignUserModuleFamily,
  setUserModuleFamilies,
} from '@/lib/auth/user-family-access'
import { getUserFamilyScope } from '@/lib/auth/admin-scope'

const mockSession = getServerSession as jest.MockedFunction<typeof getServerSession>
const userId = 'user-target-1'
const params = Promise.resolve({ id: userId })

function adminSession(isSuperAdmin = true) {
  return {
    user: { id: 'admin-1', role: 'ADMIN', isSuperAdmin },
  } as any
}

function makeRequest(
  url: string,
  init?: { method?: string; body?: Record<string, unknown> }
): NextRequest {
  const parsed = new URL(url, 'http://localhost:3000')
  return {
    method: init?.method ?? 'GET',
    url: parsed.toString(),
    nextUrl: parsed,
    json: async () => init?.body ?? {},
    headers: new Headers({ 'Content-Type': 'application/json' }),
  } as unknown as NextRequest
}

describe('/api/admin/users/[id]/family-access', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.users.findUnique as jest.Mock).mockImplementation(async ({ where }: any) => {
      if (where.id === userId) return { id: userId, role: 'TECHNICIAN' }
      if (where.id === 'admin-1') return { id: 'admin-1', isSuperAdmin: true }
      return null
    })
    ;(getUserFamilyAccessSnapshot as jest.Mock).mockResolvedValue([
      { module: 'tickets', familyIds: ['fam-a'], nativeFamilyId: 'fam-native' },
      { module: 'content', familyIds: [], nativeFamilyId: 'fam-native' },
    ])
    ;(getUserFamilyScope as jest.Mock).mockResolvedValue({
      familyIds: ['fam-a', 'fam-b'],
      nativeFamilyId: 'fam-native',
    })
    ;(assignUserModuleFamily as jest.Mock).mockResolvedValue(undefined)
    ;(unassignUserModuleFamily as jest.Mock).mockResolvedValue(undefined)
    ;(setUserModuleFamilies as jest.Mock).mockResolvedValue(['fam-a'])
  })

  describe('GET', () => {
    it('401 sin sesión', async () => {
      mockSession.mockResolvedValue(null)
      const res = await GET(makeRequest('/api/admin/users/x/family-access'), { params })
      expect(res.status).toBe(401)
    })

    it('403 si no es ADMIN', async () => {
      mockSession.mockResolvedValue({ user: { id: 'u1', role: 'CLIENT' } } as any)
      const res = await GET(makeRequest('/api/admin/users/x/family-access'), { params })
      expect(res.status).toBe(403)
    })

    it('404 si usuario no existe', async () => {
      mockSession.mockResolvedValue(adminSession())
      ;(prisma.users.findUnique as jest.Mock).mockResolvedValue(null)
      const res = await GET(makeRequest('/api/admin/users/x/family-access'), { params })
      expect(res.status).toBe(404)
    })

    it('200 con snapshot + registry', async () => {
      mockSession.mockResolvedValue(adminSession())
      const res = await GET(makeRequest('/api/admin/users/x/family-access'), { params })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.userId).toBe(userId)
      expect(body.data.modules).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ module: 'tickets' }),
          expect.objectContaining({ module: 'content' }),
        ])
      )
      expect(body.data.registry.map((r: { key: string }) => r.key)).toEqual(
        expect.arrayContaining(['tickets', 'inventory', 'patrols', 'content'])
      )
    })
  })

  describe('POST', () => {
    it('400 sin module/familyId', async () => {
      mockSession.mockResolvedValue(adminSession())
      const res = await POST(makeRequest('/api', { method: 'POST', body: {} }), { params })
      expect(res.status).toBe(400)
    })

    it('asigna content (news → content) como Super Admin', async () => {
      mockSession.mockResolvedValue(adminSession(true))
      const res = await POST(
        makeRequest('/api', {
          method: 'POST',
          body: { module: 'news', familyId: 'fam-a' },
        }),
        { params }
      )
      expect(res.status).toBe(200)
      expect(assignUserModuleFamily).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          familyId: 'fam-a',
          moduleInput: 'news',
          role: 'TECHNICIAN',
        })
      )
      const body = await res.json()
      expect(body.data.module).toBe('content')
    })

    it('403 admin normal fuera de scope', async () => {
      mockSession.mockResolvedValue(adminSession(false))
      ;(prisma.users.findUnique as jest.Mock).mockImplementation(async ({ where }: any) => {
        if (where.id === userId) return { id: userId, role: 'CLIENT' }
        if (where.id === 'admin-1') return { id: 'admin-1', isSuperAdmin: false }
        return null
      })
      ;(getUserFamilyScope as jest.Mock).mockResolvedValue({ familyIds: ['fam-a'] })

      const res = await POST(
        makeRequest('/api', {
          method: 'POST',
          body: { module: 'tickets', familyId: 'fam-outside' },
        }),
        { params }
      )
      expect(res.status).toBe(403)
      expect(assignUserModuleFamily).not.toHaveBeenCalled()
    })
  })

  describe('PUT', () => {
    it('reemplaza set de inventory', async () => {
      mockSession.mockResolvedValue(adminSession(true))
      ;(setUserModuleFamilies as jest.Mock).mockResolvedValue(['fam-a', 'fam-b'])

      const res = await PUT(
        makeRequest('/api', {
          method: 'PUT',
          body: { module: 'inventory', familyIds: ['fam-a', 'fam-b'] },
        }),
        { params }
      )
      expect(res.status).toBe(200)
      expect(setUserModuleFamilies).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          moduleInput: 'inventory',
          familyIds: ['fam-a', 'fam-b'],
        })
      )
    })

    it('400 si familyIds no es array', async () => {
      mockSession.mockResolvedValue(adminSession())
      const res = await PUT(
        makeRequest('/api', {
          method: 'PUT',
          body: { module: 'inventory', familyIds: 'x' as any },
        }),
        { params }
      )
      expect(res.status).toBe(400)
    })
  })

  describe('DELETE', () => {
    it('desasigna con query module+familyId', async () => {
      mockSession.mockResolvedValue(adminSession())
      const res = await DELETE(
        makeRequest('/api/admin/users/u/family-access?module=patrols&familyId=fam-a'),
        { params }
      )
      expect(res.status).toBe(200)
      expect(unassignUserModuleFamily).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          familyId: 'fam-a',
          moduleInput: 'patrols',
        })
      )
    })

    it('400 sin query params', async () => {
      mockSession.mockResolvedValue(adminSession())
      const res = await DELETE(makeRequest('/api/admin/users/u/family-access'), { params })
      expect(res.status).toBe(400)
    })
  })
})
