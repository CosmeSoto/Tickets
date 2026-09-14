/**
 * PUT/PATCH/DELETE /api/inventory/families/[familyId], POST /api/inventory/families
 *
 * Estas rutas operan sobre la MISMA tabla `families` que administra
 * `/api/families/*` — que ya restringe creación/edición/eliminación a Super
 * Admin ("Solo el Administrador Principal puede editar/eliminar familias").
 * Antes, estas rutas gemelas de Inventario solo exigían `role === 'ADMIN'`,
 * sin `isSuperAdmin` — un ADMIN scoped a un departamento podía editar,
 * desactivar, eliminar o crear familias de TODA la organización llamando
 * directo a estos endpoints (no expuestos en la UI, pero vivos en el
 * servidor).
 */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/auth/require-super-admin', () => ({ requireSuperAdmin: jest.fn() }))
jest.mock('@/lib/inventory/inventory-resource-access', () => ({
  assertInventoryFamilyRoute: jest.fn(),
  InventoryAccessError: class InventoryAccessError extends Error {},
  toInventoryAccessUser: (u: unknown) => u,
  inventoryAccessToResponse: jest.fn(),
}))
jest.mock('@/lib/inventory-access', () => ({
  canManageInventory: jest.fn().mockResolvedValue(false),
}))
jest.mock('@/lib/inventory/family-access', () => ({
  getAccessibleFamilyIds: jest.fn(),
  getInventoryManageFamilyIds: jest.fn(),
}))
jest.mock('@/lib/auth/family-scope', () => ({
  getNativeFamilyId: jest.fn().mockResolvedValue(null),
}))
jest.mock('@/lib/api-cache', () => ({
  withCache: (_key: string, _ttl: number, fn: () => unknown) => fn(),
  buildCacheKey: (...parts: unknown[]) => JSON.stringify(parts),
  invalidateCache: jest.fn(),
}))
jest.mock('@/lib/db/prisma-errors', () => ({
  isPrismaForeignKeyViolation: (err: unknown) => (err as { code?: string })?.code === 'P2003',
}))

jest.mock('@/lib/prisma', () => {
  const client = {
    families: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn(), create: jest.fn() },
    equipment_types: { count: jest.fn().mockResolvedValue(0) },
    consumable_types: { count: jest.fn().mockResolvedValue(0) },
    license_types: { count: jest.fn().mockResolvedValue(0) },
    audit_logs: { create: jest.fn().mockResolvedValue({}) },
  }
  return { __esModule: true, default: client, prisma: client }
})

jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}))

import { getServerSession } from 'next-auth'
import { requireSuperAdmin } from '@/lib/auth/require-super-admin'
import prisma from '@/lib/prisma'
import { PUT, PATCH, DELETE } from '@/app/api/inventory/families/[familyId]/route'
import { POST } from '@/app/api/inventory/families/route'

const FAMILY_ID = 'fam-1'

function params() {
  return { params: Promise.resolve({ familyId: FAMILY_ID }) }
}

function scopedAdminSession() {
  return { user: { id: 'admin-1', role: 'ADMIN', isSuperAdmin: false } }
}

function putRequest(body: Record<string, unknown>) {
  return { json: async () => body } as any
}

describe('Familias de inventario — requieren Super Admin (misma tabla que /api/families)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.families.findUnique as jest.Mock).mockResolvedValue({
      id: FAMILY_ID,
      name: 'Vehículos',
      isActive: true,
    })
  })

  it('regresión PUT: un ADMIN scoped (no super) recibe 403 y no edita la familia', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(scopedAdminSession())
    ;(requireSuperAdmin as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      error: 'Solo el Super Administrador puede realizar esta acción',
    })

    const res = await PUT(putRequest({ name: 'Hackeado' }), params())

    expect(res.status).toBe(403)
    expect(prisma.families.update).not.toHaveBeenCalled()
  })

  it('regresión PATCH: un ADMIN scoped recibe 403 y no desactiva la familia', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(scopedAdminSession())
    ;(requireSuperAdmin as jest.Mock).mockResolvedValue({ ok: false, status: 403, error: 'no' })

    const res = await PATCH({} as any, params())

    expect(res.status).toBe(403)
    expect(prisma.families.update).not.toHaveBeenCalled()
  })

  it('regresión DELETE: un ADMIN scoped recibe 403 y no elimina la familia', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(scopedAdminSession())
    ;(requireSuperAdmin as jest.Mock).mockResolvedValue({ ok: false, status: 403, error: 'no' })

    const res = await DELETE({} as any, params())

    expect(res.status).toBe(403)
    expect(prisma.families.delete).not.toHaveBeenCalled()
  })

  it('regresión POST: un ADMIN scoped recibe 403 y no crea la familia', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(scopedAdminSession())
    ;(requireSuperAdmin as jest.Mock).mockResolvedValue({ ok: false, status: 403, error: 'no' })

    const res = await POST(putRequest({ name: 'Nueva familia global' }))

    expect(res.status).toBe(403)
    expect(prisma.families.create).not.toHaveBeenCalled()
  })

  it('un Super Admin sí puede editar la familia', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'super-1', role: 'ADMIN', isSuperAdmin: true },
    })
    ;(requireSuperAdmin as jest.Mock).mockResolvedValue({ ok: true })
    ;(prisma.families.update as jest.Mock).mockResolvedValue({ id: FAMILY_ID, name: 'Editado' })

    const res = await PUT(putRequest({ name: 'Editado' }), params())

    expect(res.status).toBe(200)
    expect(prisma.families.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: FAMILY_ID } })
    )
  })

  it('DELETE: una violación de FK simulada (P2003) responde 409 controlado, no 500', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'super-1', role: 'ADMIN', isSuperAdmin: true },
    })
    ;(requireSuperAdmin as jest.Mock).mockResolvedValue({ ok: true })
    ;(prisma.families.delete as jest.Mock).mockRejectedValue({ code: 'P2003' })

    const res = await DELETE({} as any, params())
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toMatch(/tipos de activo asignados/)
  })
})
