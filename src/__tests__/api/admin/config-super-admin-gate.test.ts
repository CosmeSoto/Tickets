/**
 * GET/POST /api/admin/config, /api/admin/config/features, /api/admin/config/secrets
 *
 * Las 3 rutas solo exigían `role === 'ADMIN'`, a diferencia del resto de la
 * superficie de Configuración de Sistema (`admin/settings`, `email-queue`,
 * `test-email`, `telegram-queue`, `test-telegram`, `landing-page/upload`),
 * que exige Super Admin. Un ADMIN scoped a un departamento podía leer/mutar
 * feature flags y secretos globales sin esa barrera.
 */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))
jest.mock('@/lib/auth/require-super-admin', () => ({ requireSuperAdmin: jest.fn() }))
jest.mock('@/lib/logging', () => ({
  ApplicationLogger: {
    apiRequestStart: jest.fn(),
    apiRequestComplete: jest.fn(),
    apiRequestError: jest.fn(),
  },
}))
jest.mock('@/lib/api/response-builder', () => ({
  ApiResponseBuilder: {
    unauthorized: (msg: string) => ({ status: 401, json: async () => ({ error: msg }) }),
    forbidden: (msg: string) => ({ status: 403, json: async () => ({ error: msg }) }),
    success: (data: unknown) => ({ status: 200, json: async () => data }),
    internalError: (msg: string) => ({ status: 500, json: async () => ({ error: msg }) }),
  },
}))
jest.mock('@/lib/config', () => ({
  configurationService: {
    getConfigurationSummary: jest.fn().mockReturnValue({}),
    validateConfiguration: jest.fn().mockReturnValue({ valid: true }),
    getEnvironment: jest.fn().mockReturnValue('test'),
    isProduction: jest.fn().mockReturnValue(false),
  },
  featureFlagsService: {
    listFlags: jest.fn().mockReturnValue([]),
    getStatistics: jest.fn().mockReturnValue({}),
    createFlag: jest.fn(),
  },
  secretsManager: {
    listSecrets: jest.fn().mockReturnValue([]),
    getStatistics: jest.fn().mockReturnValue({}),
    setSecret: jest.fn(),
  },
}))

import { getServerSession } from 'next-auth'
import { requireSuperAdmin } from '@/lib/auth/require-super-admin'
import { GET as configGET } from '@/app/api/admin/config/route'
import { GET as featuresGET } from '@/app/api/admin/config/features/route'
import { GET as secretsGET } from '@/app/api/admin/config/secrets/route'

function req() {
  return { url: 'http://localhost/api/admin/config', json: async () => ({}) } as any
}

function scopedAdminSession() {
  return { user: { id: 'admin-1', role: 'ADMIN', isSuperAdmin: false } }
}

describe.each([
  ['GET /api/admin/config', configGET],
  ['GET /api/admin/config/features', featuresGET],
  ['GET /api/admin/config/secrets', secretsGET],
])('%s — requiere Super Admin', (_name, handler) => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('regresión: un ADMIN scoped (no super) recibe 403', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(scopedAdminSession())
    ;(requireSuperAdmin as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      error: 'Solo el Super Administrador puede realizar esta acción',
    })

    const res = await handler(req())

    expect(res.status).toBe(403)
  })

  it('un Super Admin recibe 200', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'super-1', role: 'ADMIN', isSuperAdmin: true },
    })
    ;(requireSuperAdmin as jest.Mock).mockResolvedValue({ ok: true })

    const res = await handler(req())

    expect(res.status).toBe(200)
  })
})
