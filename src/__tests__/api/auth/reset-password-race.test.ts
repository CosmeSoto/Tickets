/**
 * POST /api/auth/reset-password
 *
 * El "un solo uso" del token se aplicaba con lectura (`used === false`) y
 * luego, DESPUÉS de cambiar la contraseña, una escritura separada marcando
 * `used: true` — no atómico. Dos solicitudes concurrentes con el mismo token
 * válido (dos pestañas, doble envío) pasaban ambas el chequeo antes de que
 * ninguna lo marcara, y ambas cambiaban la contraseña. Fix: reclamar el
 * token con `updateMany({ where: { id, used: false } })` ANTES de tocar la
 * contraseña, y abortar si `count === 0`.
 */

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    password_reset_tokens: { findUnique: jest.fn(), updateMany: jest.fn() },
    users: { update: jest.fn() },
    sessions: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
  },
}))

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}))

jest.mock('@/lib/services/audit-service-complete', () => ({
  AuditServiceComplete: { logAction: jest.fn().mockResolvedValue(true) },
  AuditActionsComplete: { PASSWORD_RESET: 'PASSWORD_RESET' },
}))

jest.mock('@/lib/services/security-config-service', () => ({
  SecurityConfigService: {
    validatePasswordLength: jest.fn().mockResolvedValue({ valid: true }),
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

import prisma from '@/lib/prisma'
import { POST } from '@/app/api/auth/reset-password/route'

const TOKEN = 'reset-token-abc'

function makeRequest() {
  return { json: async () => ({ token: TOKEN, newPassword: 'NuevaPassword123' }) } as any
}

function validToken() {
  return {
    id: 'rt-1',
    userId: 'user-1',
    used: false,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    users: { id: 'user-1', email: 'user@x.com', name: 'User' },
  }
}

describe('POST /api/auth/reset-password — un solo uso bajo concurrencia', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.password_reset_tokens.findUnique as jest.Mock).mockResolvedValue(validToken())
  })

  it('regresión: el segundo request con el mismo token pierde la carrera y no cambia la contraseña', async () => {
    // El claim (updateMany con guard used:false) es lo que decide quién gana.
    ;(prisma.password_reset_tokens.updateMany as jest.Mock).mockResolvedValue({ count: 0 })

    const res = await POST(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(prisma.users.update).not.toHaveBeenCalled()
  })

  it('el que gana la carrera reclama el token y sí cambia la contraseña', async () => {
    ;(prisma.password_reset_tokens.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(prisma.users.update as jest.Mock).mockResolvedValue({})

    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(prisma.password_reset_tokens.updateMany).toHaveBeenCalledWith({
      where: { id: 'rt-1', used: false },
      data: { used: true },
    })
    expect(prisma.users.update).toHaveBeenCalledTimes(1)
  })

  it('el claim ocurre ANTES de tocar la contraseña (orden de llamadas)', async () => {
    ;(prisma.password_reset_tokens.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(prisma.users.update as jest.Mock).mockResolvedValue({})

    const calls: string[] = []
    ;(prisma.password_reset_tokens.updateMany as jest.Mock).mockImplementation(async () => {
      calls.push('claim')
      return { count: 1 }
    })
    ;(prisma.users.update as jest.Mock).mockImplementation(async () => {
      calls.push('update-password')
      return {}
    })

    await POST(makeRequest())

    expect(calls).toEqual(['claim', 'update-password'])
  })
})
