/**
 * FamilyService.delete (src/lib/services/family.service.ts)
 *
 * TOCTOU: cuenta tickets/tipos de equipo y luego, sin transacción, hace
 * `prisma.families.delete`. Una fila colada entre el conteo y el delete
 * (otro ticket/tipo creado en ese instante) chocaba contra la FK real de
 * Postgres y el error crudo de Prisma (P2003) se filtraba tal cual en vez
 * de traducirse al mismo mensaje amigable que ya usan los conteos previos.
 */

jest.mock('@/lib/prisma', () => {
  const client = {
    tickets: { count: jest.fn().mockResolvedValue(0) },
    equipment_types: { count: jest.fn().mockResolvedValue(0) },
    families: { delete: jest.fn() },
  }
  return { __esModule: true, default: client, prisma: client }
})
jest.mock('@/lib/db/prisma-errors', () => ({
  isPrismaForeignKeyViolation: (err: unknown) => (err as { code?: string })?.code === 'P2003',
}))

import { prisma } from '@/lib/prisma'
import { FamilyService } from '@/lib/services/family.service'

describe('FamilyService.delete — TOCTOU convertido en error controlado', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.tickets.count as jest.Mock).mockResolvedValue(0)
    ;(prisma.equipment_types.count as jest.Mock).mockResolvedValue(0)
  })

  it('regresión: una violación de FK (P2003) en el delete se traduce a un mensaje amigable, no al error crudo de Prisma', async () => {
    ;(prisma.families.delete as jest.Mock).mockRejectedValue({
      code: 'P2003',
      message: 'Foreign key constraint failed on the field: `familyId`',
    })

    await expect(FamilyService.delete('fam-1')).rejects.toThrow(/registros asociados/)
  })

  it('un error que no es P2003 se propaga tal cual (no se enmascara)', async () => {
    ;(prisma.families.delete as jest.Mock).mockRejectedValue(new Error('DB unreachable'))

    await expect(FamilyService.delete('fam-1')).rejects.toThrow('DB unreachable')
  })

  it('sin colisión, elimina normalmente', async () => {
    ;(prisma.families.delete as jest.Mock).mockResolvedValue({ id: 'fam-1' })

    await expect(FamilyService.delete('fam-1')).resolves.toBeUndefined()
    expect(prisma.families.delete).toHaveBeenCalledWith({ where: { id: 'fam-1' } })
  })
})
