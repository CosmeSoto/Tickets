/**
 * POST /api/access-passes/[id]/privacy-invitation — reenvío de invitación
 *
 * Regresión de concurrencia: rotar `privacyAcceptanceTokenHash` era un
 * `update` incondicional. Si la persona aceptaba justo mientras un gestor
 * reenviaba la invitación (o dos gestores reenviaban a la vez), se podía
 * rotar el hash sobre una aceptación en curso o dejar un token huérfano. El
 * fix reclama atómicamente con `where: { id, status: 'PENDING_PRIVACY' }`
 * antes de rotar el token y enviar el correo.
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
    },
  },
}))

jest.mock('@/lib/access/access-invitation', () => ({
  ACCESS_PRIVACY_ACCEPTANCE_TTL_MS: 7 * 24 * 60 * 60 * 1000,
  sendAccessPrivacyInvitation: jest.fn().mockResolvedValue(undefined),
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
import { sendAccessPrivacyInvitation } from '@/lib/access/access-invitation'
import { POST } from '@/app/api/access-passes/[id]/privacy-invitation/route'

const PASS_ID = 'pass-1'
const ADMIN_ID = 'admin-1'

function callRoute() {
  return POST({} as any, { params: Promise.resolve({ id: PASS_ID }) })
}

function basePass(overrides: Record<string, unknown> = {}) {
  return {
    id: PASS_ID,
    familyId: 'family-1',
    status: 'PENDING_PRIVACY',
    credentialCode: 'ACC-2026-ABCD1234',
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 86_400_000),
    subject: {
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@example.com',
      organization: 'ACME',
      accessType: 'AUTHORIZED_VISITOR',
    },
    family: { name: 'Torre A' },
    ...overrides,
  }
}

describe('POST /api/access-passes/[id]/privacy-invitation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: ADMIN_ID, role: 'ADMIN' } })
    ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({
      isActive: true,
      isSuperAdmin: true,
      role: 'ADMIN',
      accessEnabled: true,
      canManageAccess: true,
    })
  })

  it('claim perdido (count: 0) responde 409 y no envía la invitación', async () => {
    ;(prisma.access_passes.findUnique as jest.Mock).mockResolvedValue(basePass())
    ;(prisma.access_passes.updateMany as jest.Mock).mockResolvedValue({ count: 0 })

    const res = await callRoute()

    expect(res.status).toBe(409)
    expect(sendAccessPrivacyInvitation).not.toHaveBeenCalled()
  })

  it('camino feliz: reclama con status PENDING_PRIVACY y envía la invitación', async () => {
    ;(prisma.access_passes.findUnique as jest.Mock).mockResolvedValue(basePass())
    ;(prisma.access_passes.updateMany as jest.Mock).mockResolvedValue({ count: 1 })

    const res = await callRoute()

    expect(res.status).toBe(200)
    expect(prisma.access_passes.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: PASS_ID, status: 'PENDING_PRIVACY' } })
    )
    expect(sendAccessPrivacyInvitation).toHaveBeenCalledTimes(1)
  })

  it('rechaza sin intentar el claim si el pase ya no está pendiente', async () => {
    ;(prisma.access_passes.findUnique as jest.Mock).mockResolvedValue(
      basePass({ status: 'ACTIVE' })
    )

    const res = await callRoute()

    expect(res.status).toBe(409)
    expect(prisma.access_passes.updateMany).not.toHaveBeenCalled()
  })
})
