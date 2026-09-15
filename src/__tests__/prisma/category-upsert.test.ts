/**
 * upsertCategory — priorityCeiling se aplica solo al CREAR una categoría.
 *
 * `priorityCeiling` está pensado para que un admin lo ajuste a mano desde el
 * diálogo de categoría después de creada (ver category-form-dialog.tsx). Si
 * `upsertCategory` lo reescribiera también en el `update`, volver a correr
 * el seed (algo que pasa en cada deploy) revertiría silenciosamente ese
 * ajuste manual cada vez. Este test fija ese contrato.
 */

import { upsertCategory } from '../../../prisma/seeds/category-upsert'

describe('upsertCategory — priorityCeiling', () => {
  const baseData = {
    name: 'Impresión y Escaneo',
    description: 'Fallas de impresión',
    level: 1,
    parentId: null,
    departmentId: 'dept-1',
    order: 1,
    color: '#EC4899',
  }

  function makePrismaMock(existing: any) {
    return {
      categories: {
        findFirst: jest.fn().mockResolvedValue(existing),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
      },
    } as any
  }

  it('al crear: guarda el priorityCeiling pasado en el seed', async () => {
    const prisma = makePrismaMock(null)

    await upsertCategory(prisma, { ...baseData, priorityCeiling: 'MEDIUM' as any })

    expect(prisma.categories.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ priorityCeiling: 'MEDIUM' }),
      })
    )
  })

  it('regresión: al actualizar una categoría ya existente, NO toca priorityCeiling (aunque el seed traiga otro valor)', async () => {
    const prisma = makePrismaMock({ id: 'cat-1', name: baseData.name })

    await upsertCategory(prisma, { ...baseData, priorityCeiling: 'HIGH' as any })

    expect(prisma.categories.update).toHaveBeenCalledTimes(1)
    const updateCall = prisma.categories.update.mock.calls[0][0]
    expect(updateCall.data).not.toHaveProperty('priorityCeiling')
  })

  it('sin priorityCeiling en el seed: el create no lo incluye (queda null por default de schema)', async () => {
    const prisma = makePrismaMock(null)

    await upsertCategory(prisma, baseData)

    const createCall = prisma.categories.create.mock.calls[0][0]
    expect(createCall.data).not.toHaveProperty('priorityCeiling')
  })
})
