/**
 * PATCH /api/access-passes/[id]
 *
 * Regresión de seguridad real: el endpoint solo bloqueaba la transición desde
 * REVOKED, así que nada impedía `PENDING_PRIVACY → ACTIVE` — un gestor podía
 * activar un pase sin que la persona hubiera aceptado el aviso de privacidad.
 * El escáner luego respondía VALID y `credential-email` permitía emitir el QR
 * real. El fix usa `assertAccessStatusTransition` (src/lib/access/access-pass-state.ts)
 * para exigir `privacyAcceptedAt` antes de activar cualquier pase.
 *
 * Regresión de concurrencia: el `update` final era incondicional
 * (findUnique → check en JS → update), así que dos PATCH casi simultáneos
 * sobre el mismo pase podían pisarse. El fix reemplaza el update por un
 * `updateMany` con `status: existing.status` en el where como token
 * optimista — si el status cambió entre la lectura y la escritura, count es 0
 * y se aborta con 409 sin aplicar nada.
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
    access_passes: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
  },
}))

jest.mock('@/lib/auth/user-family-access', () => ({
  resolveModuleFamilyScopeIds: jest.fn().mockResolvedValue([]),
}))

jest.mock('@/lib/services/audit-service-complete', () => ({
  AuditActionsComplete: {
    ACCESS_PASS_REVOKED: 'access_pass_revoked',
    ACCESS_PASS_QR_REISSUED: 'access_pass_qr_reissued',
    ACCESS_PASS_UPDATED: 'access_pass_updated',
  },
  AuditServiceComplete: { log: jest.fn() },
}))

jest.mock('@/lib/access/delete-access-passes', () => ({
  hardDeleteAccessPasses: jest.fn(),
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
import { AuditServiceComplete } from '@/lib/services/audit-service-complete'
import { PATCH } from '@/app/api/access-passes/[id]/route'

const PASS_ID = 'pass-1'
const ADMIN_ID = 'admin-1'

function makeRequest(body: Record<string, unknown>) {
  return { json: async () => body } as any
}

function callPatch(body: Record<string, unknown>) {
  return PATCH(makeRequest(body), { params: Promise.resolve({ id: PASS_ID }) })
}

function basePass(overrides: Record<string, unknown> = {}) {
  const now = Date.now()
  return {
    id: PASS_ID,
    familyId: 'family-1',
    status: 'PENDING_PRIVACY',
    validFrom: new Date(now - 60_000),
    validUntil: new Date(now + 3_600_000),
    privacyAcceptedAt: null,
    subject: { firstName: 'Ana', lastName: 'Pérez' },
    ...overrides,
  }
}

describe('PATCH /api/access-passes/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: ADMIN_ID, role: 'ADMIN' },
    })
    // Super Admin global: sin scope de familia, canManage true — así los tests
    // se concentran en la máquina de estados sin acoplarse a resolveModuleFamilyScopeIds.
    ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({
      isActive: true,
      isSuperAdmin: true,
      role: 'ADMIN',
      accessEnabled: true,
      canManageAccess: true,
    })
  })

  describe('bypass de consentimiento (regresión)', () => {
    it('bloquea activar un pase PENDING_PRIVACY sin consentimiento', async () => {
      ;(prisma.access_passes.findUnique as jest.Mock).mockResolvedValue(basePass())

      const res = await callPatch({ status: 'ACTIVE' })

      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.code).toBe('CONSENT_REQUIRED')
      expect(prisma.access_passes.updateMany).not.toHaveBeenCalled()
      expect(AuditServiceComplete.log).not.toHaveBeenCalled()
    })

    it('bloquea reactivar un pase REVOKED con reissueQr si nunca hubo consentimiento', async () => {
      ;(prisma.access_passes.findUnique as jest.Mock).mockResolvedValue(
        basePass({ status: 'REVOKED', privacyAcceptedAt: null })
      )

      const res = await callPatch({ reissueQr: true })

      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.code).toBe('CONSENT_REQUIRED')
      expect(prisma.access_passes.updateMany).not.toHaveBeenCalled()
    })

    it('permite reactivar un pase REVOKED con reissueQr cuando sí hubo consentimiento previo', async () => {
      ;(prisma.access_passes.findUnique as jest.Mock).mockResolvedValue(
        basePass({ status: 'REVOKED', privacyAcceptedAt: new Date('2026-01-01') })
      )
      ;(prisma.access_passes.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
      ;(prisma.access_passes.findUniqueOrThrow as jest.Mock).mockResolvedValue(
        basePass({ status: 'ACTIVE', privacyAcceptedAt: new Date('2026-01-01') })
      )

      const res = await callPatch({ reissueQr: true })

      expect(res.status).toBe(200)
      expect(prisma.access_passes.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: PASS_ID, status: 'REVOKED' } })
      )
    })

    it('rechaza reactivar un REVOKED sin reissueQr (regla existente, no debe romperse)', async () => {
      ;(prisma.access_passes.findUnique as jest.Mock).mockResolvedValue(
        basePass({ status: 'REVOKED', privacyAcceptedAt: new Date('2026-01-01') })
      )

      const res = await callPatch({ status: 'ACTIVE' })

      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.code).toBe('REVOKED_NEEDS_REISSUE')
      expect(prisma.access_passes.updateMany).not.toHaveBeenCalled()
    })
  })

  describe('claim atómico (regresión de concurrencia)', () => {
    it('aborta con 409 si el status cambió entre la lectura y la escritura (count: 0)', async () => {
      ;(prisma.access_passes.findUnique as jest.Mock).mockResolvedValue(
        basePass({ status: 'ACTIVE', privacyAcceptedAt: new Date('2026-01-01') })
      )
      ;(prisma.access_passes.updateMany as jest.Mock).mockResolvedValue({ count: 0 })

      const res = await callPatch({ status: 'SUSPENDED' })

      expect(res.status).toBe(409)
      expect(prisma.access_passes.findUniqueOrThrow).not.toHaveBeenCalled()
      expect(AuditServiceComplete.log).not.toHaveBeenCalled()
    })

    it('camino feliz: SUSPENDED → ACTIVE con consentimiento previo', async () => {
      ;(prisma.access_passes.findUnique as jest.Mock).mockResolvedValue(
        basePass({ status: 'SUSPENDED', privacyAcceptedAt: new Date('2026-01-01') })
      )
      ;(prisma.access_passes.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
      ;(prisma.access_passes.findUniqueOrThrow as jest.Mock).mockResolvedValue(
        basePass({ status: 'ACTIVE', privacyAcceptedAt: new Date('2026-01-01') })
      )

      const res = await callPatch({ status: 'ACTIVE' })

      expect(res.status).toBe(200)
      expect(prisma.access_passes.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: PASS_ID, status: 'SUSPENDED' } })
      )
      expect(AuditServiceComplete.log).toHaveBeenCalledTimes(1)
    })
  })

  describe('autorización', () => {
    it('rechaza con 403 un pase de una familia fuera del scope del gestor', async () => {
      ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({
        isActive: true,
        isSuperAdmin: false,
        role: 'ADMIN',
        accessEnabled: false,
        canManageAccess: true,
      })
      const { resolveModuleFamilyScopeIds } = jest.requireMock('@/lib/auth/user-family-access')
      ;(resolveModuleFamilyScopeIds as jest.Mock).mockResolvedValue(['family-allowed'])
      ;(prisma.access_passes.findUnique as jest.Mock).mockResolvedValue(
        basePass({ familyId: 'family-other', status: 'ACTIVE', privacyAcceptedAt: new Date() })
      )

      const res = await callPatch({ status: 'SUSPENDED' })

      expect(res.status).toBe(403)
      expect(prisma.access_passes.updateMany).not.toHaveBeenCalled()
    })
  })
})
