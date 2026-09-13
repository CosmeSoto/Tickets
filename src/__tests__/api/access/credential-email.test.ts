/**
 * POST /api/access-passes/[id]/credential-email — reenvío de QR
 *
 * Regresión de concurrencia: el `update` que rotaba `tokenHash` era
 * incondicional (findUnique → check en JS → update), así que una revocación
 * concurrente podía perder la carrera y terminar enviando por correo un QR
 * "válido" de un pase que en la base de datos ya está REVOKED/SUSPENDED. El
 * fix reemplaza el update por un `updateMany` con `status:'ACTIVE',
 * privacyAcceptedAt:{not:null}` en el where — si el pase cambió, count es 0
 * y se aborta sin invalidar el QR anterior ni encolar el correo.
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

jest.mock('qrcode', () => ({ toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,x') }))

jest.mock('@/lib/services/email/email-branding', () => ({
  getEmailBranding: jest.fn().mockResolvedValue({ baseUrl: 'https://app.test', privacyUrl: '' }),
}))

jest.mock('@/lib/notifications/queue-notification-email', () => ({
  queueNotificationEmail: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/services/email/templates/access-pass-issued', () => ({
  accessPassEmailSubject: jest.fn(() => 'subject'),
  accessTypeLabel: jest.fn(() => 'Visitante'),
  buildAccessPassIssuedEmail: jest.fn().mockResolvedValue({ html: '<p/>', text: 'txt' }),
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
import { POST } from '@/app/api/access-passes/[id]/credential-email/route'

const PASS_ID = 'pass-1'
const ADMIN_ID = 'admin-1'

function callRoute() {
  return POST({} as any, { params: Promise.resolve({ id: PASS_ID }) })
}

function basePass(overrides: Record<string, unknown> = {}) {
  return {
    id: PASS_ID,
    familyId: 'family-1',
    status: 'ACTIVE',
    credentialCode: 'ACC-2026-ABCD1234',
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 86_400_000),
    privacyAcceptedAt: new Date(),
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

describe('POST /api/access-passes/[id]/credential-email', () => {
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

  it('claim perdido (count: 0) responde 409 y no encola el correo', async () => {
    ;(prisma.access_passes.findUnique as jest.Mock).mockResolvedValue(basePass())
    ;(prisma.access_passes.updateMany as jest.Mock).mockResolvedValue({ count: 0 })

    const res = await callRoute()

    expect(res.status).toBe(409)
    const { queueNotificationEmail } = jest.requireMock(
      '@/lib/notifications/queue-notification-email'
    )
    expect(queueNotificationEmail).not.toHaveBeenCalled()
  })

  it('camino feliz: reclama con status ACTIVE + consentimiento y encola el correo', async () => {
    ;(prisma.access_passes.findUnique as jest.Mock).mockResolvedValue(basePass())
    ;(prisma.access_passes.updateMany as jest.Mock).mockResolvedValue({ count: 1 })

    const res = await callRoute()

    expect(res.status).toBe(200)
    expect(prisma.access_passes.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PASS_ID, status: 'ACTIVE', privacyAcceptedAt: { not: null } },
      })
    )
    const { queueNotificationEmail } = jest.requireMock(
      '@/lib/notifications/queue-notification-email'
    )
    expect(queueNotificationEmail).toHaveBeenCalledTimes(1)
  })

  it('rechaza sin intentar el claim si el pase nunca tuvo consentimiento (defensa en profundidad)', async () => {
    ;(prisma.access_passes.findUnique as jest.Mock).mockResolvedValue(
      basePass({ privacyAcceptedAt: null })
    )

    const res = await callRoute()

    expect(res.status).toBe(409)
    expect(prisma.access_passes.updateMany).not.toHaveBeenCalled()
  })
})
