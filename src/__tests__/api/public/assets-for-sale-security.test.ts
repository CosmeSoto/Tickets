/**
 * Security verification test for /api/public/assets-for-sale
 * Verifica la forma de la consulta Prisma (include / where).
 */

import prisma from '@/lib/prisma'

jest.mock('@/lib/prisma', () => {
  const p = {
    equipment: { findMany: jest.fn().mockResolvedValue([]) },
    // El endpoint también resuelve el WhatsApp de contacto (system_settings
    // legacy + landing_page_content) en paralelo con el findMany de equipos.
    system_settings: { findMany: jest.fn().mockResolvedValue([]) },
    landing_page_content: { findFirst: jest.fn().mockResolvedValue(null) },
  }
  return { __esModule: true, default: p, prisma: p }
})

describe('Public API Security - Field Selection', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.equipment.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.system_settings.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.landing_page_content.findFirst as jest.Mock).mockResolvedValue(null)
  })

  it('should call findMany with FOR_SALE filter and expected includes', async () => {
    const { GET } = await import('@/app/api/public/assets-for-sale/route')
    await GET()

    expect(prisma.equipment.findMany).toHaveBeenCalled()
    const callArgs = (prisma.equipment.findMany as jest.Mock).mock.calls[0][0]

    expect(callArgs.where).toMatchObject({ status: 'FOR_SALE' })
    expect(callArgs).toHaveProperty('include')
    // model ya no tiene un campo `name` propio — el nombre se compone de
    // model.brand.name (relación) + model.model (string), ver resolvedBrand/
    // resolvedModel más abajo en la ruta.
    expect(callArgs.include).toMatchObject({
      model: { select: { id: true, brand: true, model: true } },
      type: {
        include: {
          family: true,
          attributes: true,
        },
      },
      customValues: true,
    })
  })

  it('should not use a root-level Prisma select (uses include)', async () => {
    const { GET } = await import('@/app/api/public/assets-for-sale/route')
    await GET()

    const callArgs = (prisma.equipment.findMany as jest.Mock).mock.calls[0][0]
    expect(callArgs.select).toBeUndefined()
  })
})
