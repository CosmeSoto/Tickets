/**
 * POST /api/access-passes (alta de pase)
 *
 * `credentialCode()` toma 8 hex de un UUID sobre una columna `@unique` —
 * colisión improbable pero posible. Antes el P2002 resultante se propagaba
 * como 500 genérico. El fix reintenta la transacción completa (subject+pass)
 * hasta 4 veces si el error es una violación de unicidad esperable
 * (credential_code / token_hash / privacy_acceptance_token_hash).
 *
 * Además, `privacyNoticeVersion` venía como dato de ENTRADA del cliente y se
 * persistía tal cual — la versión del aviso legal que queda como evidencia
 * de consentimiento la decidía el navegador. Ahora el servidor la fija
 * (ACCESS_PRIVACY_NOTICE_VERSION) y cualquier valor enviado en el body se
 * ignora.
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
    families: { findFirst: jest.fn() },
    access_organizations: { findFirst: jest.fn() },
    access_passes: { update: jest.fn() },
    $transaction: jest.fn(),
  },
}))

jest.mock('@/lib/access/access-invitation', () => ({
  ACCESS_PRIVACY_ACCEPTANCE_TTL_MS: 7 * 24 * 60 * 60 * 1000,
  sendAccessPrivacyInvitation: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/services/audit-service-complete', () => ({
  AuditActionsComplete: { ACCESS_PASS_CREATED: 'access_pass_created' },
  AuditServiceComplete: { log: jest.fn() },
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
import { POST } from '@/app/api/access-passes/route'

const ADMIN_ID = 'admin-1'
const FAMILY_ID = '11111111-1111-4111-8111-111111111111'

function makeRequest(body: Record<string, unknown>) {
  return { json: async () => body } as any
}

function baseBody(overrides: Record<string, unknown> = {}) {
  return {
    familyId: FAMILY_ID,
    firstName: 'Ana',
    lastName: 'Pérez',
    email: 'ana@example.com',
    accessType: 'AUTHORIZED_VISITOR',
    validFrom: new Date().toISOString(),
    validUntil: new Date(Date.now() + 3_600_000).toISOString(),
    sendEmail: true,
    // Un cliente desactualizado (o malicioso) podría seguir mandando esto —
    // el servidor debe ignorarlo.
    privacyNoticeVersion: 'v999-atacante',
    ...overrides,
  }
}

function createdPass(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pass-1',
    credentialCode: 'ACC-2026-ABCD1234',
    subject: { organization: null },
    ...overrides,
  }
}

describe('POST /api/access-passes', () => {
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
    ;(prisma.families.findFirst as jest.Mock).mockResolvedValue({
      id: FAMILY_ID,
      name: 'Torre A',
    })
  })

  it('reintenta y crea cuando la colisión de credentialCode se resuelve en un intento posterior', async () => {
    ;(prisma.$transaction as jest.Mock)
      .mockRejectedValueOnce({ code: 'P2002', meta: { target: ['credential_code'] } })
      .mockResolvedValueOnce(createdPass())

    const res = await POST(makeRequest(baseBody()))

    expect(res.status).toBe(201)
    expect(prisma.$transaction).toHaveBeenCalledTimes(2)
  })

  it('propaga el error si no es una colisión esperable (no reintenta un error genérico)', async () => {
    ;(prisma.$transaction as jest.Mock).mockRejectedValue(new Error('DB caída'))

    await expect(POST(makeRequest(baseBody()))).rejects.toThrow('DB caída')
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
  })

  it('ignora el privacyNoticeVersion del body y no rompe la validación por su ausencia', async () => {
    ;(prisma.$transaction as jest.Mock).mockResolvedValue(createdPass())

    const res = await POST(makeRequest(baseBody()))

    expect(res.status).toBe(201)
    const { AuditServiceComplete } = jest.requireMock('@/lib/services/audit-service-complete')
    expect(AuditServiceComplete.log).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({ privacyNoticeVersion: 'v1' }),
      })
    )
  })
})
