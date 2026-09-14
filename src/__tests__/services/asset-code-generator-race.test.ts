/**
 * generateAssetCode (src/lib/inventory/asset-code-generator.ts)
 *
 * El secuencial se calculaba con `prisma.equipment.count(...)` — dos
 * creaciones concurrentes de la misma familia+subtipo+año leen el mismo
 * conteo y generan el MISMO código, que solo se detecta al chocar contra el
 * `@unique` de `equipment.code` (500 genérico, no una colisión limpia).
 *
 * Fix: `equipment_code_counters.upsert` con `lastSequence: { increment: 1 }`
 * — un único `INSERT ... ON CONFLICT DO UPDATE SET last_sequence =
 * last_sequence + 1`, atómico a nivel de Postgres, sin ventana de carrera.
 */

jest.mock('@/lib/prisma', () => {
  const client = {
    families: { findUnique: jest.fn() },
    equipment: { count: jest.fn() },
    consumables: { count: jest.fn() },
    software_licenses: { count: jest.fn() },
    equipment_code_counters: { upsert: jest.fn() },
  }
  return { __esModule: true, default: client, prisma: client }
})

import { prisma } from '@/lib/prisma'
import { generateAssetCode } from '@/lib/inventory/asset-code-generator'

describe('generateAssetCode', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.families.findUnique as jest.Mock).mockResolvedValue({
      code: 'TECH',
      formConfig: null,
    })
  })

  it('regresión: no cuenta filas de equipment — usa el contador atómico dedicado', async () => {
    ;(prisma.equipment_code_counters.upsert as jest.Mock).mockResolvedValue({ lastSequence: 7 })

    const code = await generateAssetCode('family-1', 'EQUIPMENT', 'FIXED_ASSET')

    expect(prisma.equipment.count).not.toHaveBeenCalled()
    expect(code).toMatch(/^TECH-EQ-FA-\d{4}-0007$/)
  })

  it('el upsert incrementa relativo al valor en BD (atómico), no a un valor leído antes en JS', async () => {
    ;(prisma.equipment_code_counters.upsert as jest.Mock).mockImplementation(
      ({ where, update, create }) =>
        Promise.resolve({
          ...create,
          counterKey: where.counterKey,
          lastSequence: update.lastSequence,
        })
    )

    await generateAssetCode('family-1', 'EQUIPMENT', 'FIXED_ASSET')

    const call = (prisma.equipment_code_counters.upsert as jest.Mock).mock.calls[0][0]
    expect(call.update).toEqual({ lastSequence: { increment: 1 } })
  })

  it('dos llamadas concurrentes con el mismo contador reciben secuenciales distintos (simulado)', async () => {
    let lastSequence = 0
    ;(prisma.equipment_code_counters.upsert as jest.Mock).mockImplementation(async () => {
      lastSequence += 1 // simula el incremento atómico de Postgres, una llamada a la vez
      return { lastSequence }
    })

    const [codeA, codeB] = await Promise.all([
      generateAssetCode('family-1', 'EQUIPMENT', 'FIXED_ASSET'),
      generateAssetCode('family-1', 'EQUIPMENT', 'FIXED_ASSET'),
    ])

    expect(codeA).not.toBe(codeB)
  })
})
