/**
 * GET/POST /api/access-passes/[id]/accept (endpoint público, solo token)
 *
 * Regresión de fuga de PII: la revocación (PATCH) no limpia
 * `privacyAcceptanceExpiresAt`, así que un pase revocado/suspendido dentro de
 * las 24h posteriores a su aceptación conservaba una ventana de "comprobante"
 * abierta. La condición vieja (`status !== 'PENDING_PRIVACY' && expired`) no
 * distinguía "revocado" de "recién aceptado" — devolvía 200 con nombre,
 * arrendatario, área y vigencia a quien tuviera el enlace viejo. El fix exige
 * `status === 'ACTIVE'` explícitamente para la rama de comprobante.
 *
 * El POST ya tenía el patrón correcto (updateMany + count!==1) — se agrega
 * cobertura para que no se pierda en un refactor futuro.
 */

import { NextRequest } from 'next/server'

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    access_passes: {
      findFirst: jest.fn(),
      $transaction: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

jest.mock('@/lib/services/digital-signature.service', () => ({
  DigitalSignatureService: {
    isValidAcceptanceToken: jest.fn(() => true),
    extractIpAddress: jest.fn(() => '127.0.0.1'),
    extractUserAgent: jest.fn(() => 'jest'),
  },
}))

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn().mockResolvedValue({ success: true }),
}))

jest.mock('@/lib/services/audit-service-complete', () => ({
  AuditActionsComplete: { ACCESS_PASS_UPDATED: 'access_pass_updated' },
  AuditServiceComplete: { log: jest.fn() },
}))

jest.mock('@/lib/notifications/queue-notification-email', () => ({
  queueNotificationEmail: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/services/email/email-branding', () => ({
  getEmailBranding: jest.fn().mockResolvedValue({ baseUrl: 'https://app.test', privacyUrl: '' }),
}))

jest.mock('qrcode', () => ({ toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,x') }))

jest.mock('@/lib/services/email/templates/access-pass-issued', () => ({
  accessPassEmailSubject: jest.fn(() => 'subject'),
  accessTypeLabel: jest.fn(() => 'Visitante'),
  buildAccessPassIssuedEmail: jest.fn().mockResolvedValue({ html: '<p/>', text: 'txt' }),
}))

jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number; headers?: Record<string, string> }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
  NextRequest: class {
    url: string
    headers = new Map()
    constructor(url: string) {
      this.url = url
    }
  },
}))

import prisma from '@/lib/prisma'
import { GET, POST } from '@/app/api/access-passes/[id]/accept/route'

const PASS_ID = 'pass-1'
const TOKEN = 'a'.repeat(43)

function makeGetRequest() {
  return new NextRequest(`https://app.test/access/passes/${PASS_ID}/accept?token=${TOKEN}`) as any
}

function makePostRequest(body: Record<string, unknown>) {
  return { json: async () => body } as any
}

function basePass(overrides: Record<string, unknown> = {}) {
  return {
    id: PASS_ID,
    status: 'PENDING_PRIVACY',
    credentialCode: 'ACC-2026-ABCD1234',
    validFrom: new Date(),
    validUntil: new Date(Date.now() + 86_400_000),
    privacyAcceptedAt: null,
    privacyAcceptanceExpiresAt: new Date(Date.now() + 86_400_000),
    createdById: 'admin-1',
    subject: {
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@example.com',
      organization: 'ACME',
      accessType: 'AUTHORIZED_VISITOR',
      privacyNoticeVersion: 'v1',
    },
    family: { name: 'Torre A' },
    ...overrides,
  }
}

describe('GET /api/access-passes/[id]/accept', () => {
  beforeEach(() => jest.clearAllMocks())

  it('devuelve 404 sin PII para un pase REVOCADO aunque la ventana de aceptación siga abierta (fuga de PII, regresión)', async () => {
    ;(prisma.access_passes.findFirst as jest.Mock).mockResolvedValue(
      basePass({
        status: 'REVOKED',
        privacyAcceptedAt: new Date(),
        privacyAcceptanceExpiresAt: new Date(Date.now() + 60_000),
      })
    )

    const res = await GET(makeGetRequest(), { params: Promise.resolve({ id: PASS_ID }) })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(JSON.stringify(body)).not.toContain('Ana')
    expect(JSON.stringify(body)).not.toContain('ACME')
  })

  it('devuelve 404 sin PII para un pase SUSPENDIDO con ventana de aceptación abierta', async () => {
    ;(prisma.access_passes.findFirst as jest.Mock).mockResolvedValue(
      basePass({
        status: 'SUSPENDED',
        privacyAcceptedAt: new Date(),
        privacyAcceptanceExpiresAt: new Date(Date.now() + 60_000),
      })
    )

    const res = await GET(makeGetRequest(), { params: Promise.resolve({ id: PASS_ID }) })

    expect(res.status).toBe(404)
  })

  it('PENDING_PRIVACY expirado: 200 con canAccept:false y expired:true', async () => {
    ;(prisma.access_passes.findFirst as jest.Mock).mockResolvedValue(
      basePass({ privacyAcceptanceExpiresAt: new Date(Date.now() - 60_000) })
    )

    const res = await GET(makeGetRequest(), { params: Promise.resolve({ id: PASS_ID }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.canAccept).toBe(false)
    expect(body.expired).toBe(true)
  })

  it('comprobante legítimo: ACTIVE recién aceptado dentro de 24h devuelve 200', async () => {
    ;(prisma.access_passes.findFirst as jest.Mock).mockResolvedValue(
      basePass({
        status: 'ACTIVE',
        privacyAcceptedAt: new Date(),
        privacyAcceptanceExpiresAt: new Date(Date.now() + 60_000),
      })
    )

    const res = await GET(makeGetRequest(), { params: Promise.resolve({ id: PASS_ID }) })

    expect(res.status).toBe(200)
  })
})

describe('POST /api/access-passes/[id]/accept', () => {
  beforeEach(() => jest.clearAllMocks())

  it('claim perdido (updateMany count 0) no encola email — el error del claim se propaga sin efectos secundarios', async () => {
    ;(prisma.access_passes.findFirst as jest.Mock).mockResolvedValue(basePass())
    const tx = { access_passes: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) } }
    ;(prisma.$transaction as jest.Mock).mockImplementation((cb: any) => cb(tx))

    await expect(
      POST(makePostRequest({ token: TOKEN, accepted: true }), {
        params: Promise.resolve({ id: PASS_ID }),
      })
    ).rejects.toThrow('La credencial ya fue procesada.')

    const { queueNotificationEmail } = jest.requireMock(
      '@/lib/notifications/queue-notification-email'
    )
    expect(queueNotificationEmail).not.toHaveBeenCalled()
  })
})
