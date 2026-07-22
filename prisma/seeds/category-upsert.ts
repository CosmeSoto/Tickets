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
}

export type UpsertCounters = { created: number; updated: number }

export async function upsertCategory(
  prisma: PrismaClient,
  data: CategorySeedData,
  counters?: UpsertCounters
) {
  const existing = await prisma.categories.findFirst({
    where: {
      name: data.name,
      level: data.level,
      parentId: data.parentId,
      departmentId: data.departmentId,
    },
  })

  if (existing) {
    if (counters) counters.updated++
    return prisma.categories.update({
      where: { id: existing.id },
      data: {
        description: data.description,
        departmentId: data.departmentId,
        order: data.order,
        color: data.color,
        updatedAt: now,
      },
    })
  }

  if (counters) counters.created++
  return prisma.categories.create({
    data: {
      id: randomUUID(),
      ...data,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  })
}
