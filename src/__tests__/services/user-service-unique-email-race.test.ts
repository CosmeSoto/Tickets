/**
 * UserService.createUser / updateUser — TOCTOU en unicidad de email
 *
 * `email` es `@unique` en el schema, pero la unicidad se aplicaba solo en
 * aplicación (`findUnique` + comprobación) antes del `create`/`update` real,
 * sin manejo del `P2002` que Postgres lanza si dos escrituras concurrentes
 * con el mismo email ganan la carrera contra el `findUnique`. Ese error caía
 * sin traducir al catch genérico de las rutas → 500 en vez de un mensaje
 * limpio. Fix: capturar `P2002` sobre `email` alrededor de la transacción y
 * traducirlo al mismo `Error('Ya existe un usuario con este email')` que ya
 * manejan las rutas para el caso no-concurrente.
 */

jest.mock('@/lib/prisma', () => {
  const client = {
    users: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  }
  return { __esModule: true, default: client, prisma: client }
})

jest.mock('@/lib/services/audit-service-complete', () => ({
  AuditServiceComplete: { log: jest.fn().mockResolvedValue(true) },
  AuditActionsComplete: { USER_CREATED: 'USER_CREATED' },
}))

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed'),
}))

import prisma from '@/lib/prisma'
import { UserService } from '@/lib/services/user-service'

function p2002(field: string) {
  const err: any = new Error('Unique constraint failed')
  err.code = 'P2002'
  err.meta = { target: [field] }
  return err
}

describe('UserService.createUser — carrera en unicidad de email', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.users.findUnique as jest.Mock).mockResolvedValue(null) // pasa el pre-check (perdió la carrera después)
  })

  it('regresión: P2002 real de Postgres se traduce a un Error legible, no se propaga crudo', async () => {
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
      const tx = { users: { create: jest.fn().mockRejectedValue(p2002('email')) } }
      return cb(tx)
    })

    await expect(
      UserService.createUser({
        email: 'dup@x.com',
        name: 'Dup',
        password: 'password123',
        role: 'CLIENT',
      } as any)
    ).rejects.toThrow('Ya existe un usuario con este email')
  })

  it('un P2002 sobre otro campo no se confunde con el de email (se repropaga tal cual)', async () => {
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
      const tx = { users: { create: jest.fn().mockRejectedValue(p2002('telegramChatId')) } }
      return cb(tx)
    })

    await expect(
      UserService.createUser({
        email: 'new@x.com',
        name: 'New',
        password: 'password123',
        role: 'CLIENT',
      } as any)
    ).rejects.toMatchObject({ code: 'P2002' })
  })
})

describe('UserService.updateUser — carrera en unicidad de email', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('regresión: P2002 real de Postgres se traduce a un Error legible, no se propaga crudo', async () => {
    ;(prisma.users.findUnique as jest.Mock)
      .mockResolvedValueOnce({ id: 'u1', email: 'old@x.com', role: 'CLIENT' }) // usuario existente
      .mockResolvedValueOnce(null) // pre-check de email nuevo: pasa (perdió la carrera después)
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
      const tx = { users: { update: jest.fn().mockRejectedValue(p2002('email')) } }
      return cb(tx)
    })

    await expect(UserService.updateUser('u1', { email: 'dup@x.com' } as any)).rejects.toThrow(
      'Ya existe un usuario con este email'
    )
  })
})
