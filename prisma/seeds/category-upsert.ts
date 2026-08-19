/**
 * Upsert canónico de categorías de tickets para seeds.
 *
 * Unicidad: name + level + parentId + departmentId
 * — evita colisiones entre familias/áreas (p.ej. "Falla o Daño" en Arquitectura vs Mantenimiento).
 *
 * Usado por todos los `categories-*.seed.ts`. Tras seeds, correr sync de familyId
 * (ensure-categories / seed.ts).
 */

import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const now = new Date()

export type CategorySeedData = {
  name: string
  description: string
  level: number
  parentId: string | null
  departmentId: string
  order: number
  color: string
  /** Nombres previos en el mismo padre/área: permite renombrar sin duplicar. */
  formerNames?: string[]
}

export type UpsertCounters = { created: number; updated: number }

export async function upsertCategory(
  prisma: PrismaClient,
  data: CategorySeedData,
  counters?: UpsertCounters
) {
  const nameCandidates = [data.name, ...(data.formerNames ?? [])]
  const existing = await prisma.categories.findFirst({
    where: {
      level: data.level,
      parentId: data.parentId,
      departmentId: data.departmentId,
      name: { in: nameCandidates },
    },
  })

  if (existing) {
    if (counters) counters.updated++
    return prisma.categories.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        description: data.description,
        departmentId: data.departmentId,
        order: data.order,
        color: data.color,
        isActive: true,
        updatedAt: now,
      },
    })
  }

  if (counters) counters.created++
  const { formerNames: _formerNames, ...createData } = data
  return prisma.categories.create({
    data: {
      id: randomUUID(),
      ...createData,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  })
}

/** Oculta una categoría mal ubicada o duplicada (conserva historial de tickets). */
export async function deactivateCategory(
  prisma: PrismaClient,
  where: { name: string; departmentId: string; level: number; parentId?: string | null }
) {
  await prisma.categories.updateMany({
    where: {
      name: where.name,
      departmentId: where.departmentId,
      level: where.level,
      ...(where.parentId !== undefined ? { parentId: where.parentId } : {}),
      isActive: true,
    },
    data: { isActive: false, updatedAt: now },
  })
}
