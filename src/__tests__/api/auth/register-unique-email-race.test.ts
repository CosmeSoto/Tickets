/**
 * POST /api/auth/register
 *
 * `findUnique` por email → luego `create`, sin manejo de `P2002`. Dos
 * registros concurrentes con el mismo email (doble clic, reintento de red)
 * podían pasar ambos el `findUnique` antes de que cualquiera creara la fila;
 * la segunda escritura choca contra la constraint única de Postgres y sin
 * manejo específico cae al catch genérico → 500 en vez del 409 "email ya
 * registrado" que sí se da en el caso no-concurrente.
 */

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    users: { findUnique: jest.fn(), create: jest.fn() },
    departments: { findFirst: jest.fn() },
    audit_logs: { create: jest.fn().mockResolvedValue({}) },
  },
}))

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed'),
}))

jest.mock('@/lib/services/security-config-service', () => ({
  SecurityConfigService: {
    getConfig: jest.fn().mockResolvedValue({ passwordMinLength: 8 }),
  },
}))

jest.mock('@/lib/services/email/email-service', () => ({
  EmailService: { sendEmail: jest.fn().mockResolvedValue(undefined) },
}))

jest.mock('@/lib/services/email/email-branding', () => ({
  getEmailBranding: jest.fn().mockResolvedValue({ systemName: 'Tickets' }),
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
import { POST } from '@/app/api/auth/register/route'

function makeRequest() {
  return {
    json: async () => ({
      name: 'Nuevo Usuario',
      email: 'dup@x.com',
      password: 'password123',
      phone: '099-999-9999',
      departmentId: 'dept-1',
    }),
  } as any
}

function p2002Email() {
  const err: any = new Error('Unique constraint failed on the fields: (`email`)')
  err.code = 'P2002'
  err.meta = { target: ['email'] }
  return err
}

describe('POST /api/auth/register — carrera en unicidad de email', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.users.findUnique as jest.Mock).mockResolvedValue(null) // pasa el pre-check
    ;(prisma.departments.findFirst as jest.Mock).mockResolvedValue({ id: 'dept-1', isActive: true })
  })

  it('regresión: el P2002 real de Postgres responde 409 legible, no 500', async () => {
    ;(prisma.users.create as jest.Mock).mockRejectedValue(p2002Email())

    const res = await POST(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.success).toBe(false)
    expect(body.field).toBe('email')
  })

  it('sin colisión, crea el usuario normalmente (201)', async () => {
    ;(prisma.users.create as jest.Mock).mockResolvedValue({
      id: 'u1',
      name: 'Nuevo Usuario',
      email: 'dup@x.com',
      role: 'CLIENT',
      departmentId: 'dept-1',
      createdAt: new Date(),
    })

    const res = await POST(makeRequest())

    expect(res.status).toBe(201)
  })
})
