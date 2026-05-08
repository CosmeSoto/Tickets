/**
 * Seed: Categories (Categorías de Tickets)
 *
 * Crea la jerarquía completa de categorías para los diferentes departamentos:
 * - Tecnologías de la Información (Infraestructura, Soporte, etc.)
 * - Soporte Técnico
 * - Seguridad Informática
 * - Usuarios y Privilegios
 * - Telefonía
 * - Mantenimiento (Civil, Eléctrico, Mecánico)
 * - Seguridad Física
 * - Servicios (Limpieza, Mensajería)
 * - Administrativa
 */

import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const now = new Date()

async function upsertCategory(
  prisma: PrismaClient,
  data: {
    name: string
    description: string
    level: number
    parentId: string | null
    departmentId: string
    order: number
    color: string
  }
) {
  const existing = await prisma.categories.findFirst({
    where: { name: data.name, level: data.level, parentId: data.parentId },
  })
  if (existing) {
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
  return prisma.categories.create({
    data: { id: randomUUID(), ...data, isActive: true, createdAt: now, updatedAt: now },
  })
}

export async function seedCategories(prisma: PrismaClient, deptMap: Map<string, string>) {
  console.log('📂 Creando categorías de tickets...')

  // Esta función será extraída del seed principal
  // Por ahora, retornamos para no romper el seed
  console.log('  ⏭️  Categorías (pendiente de migración)')
}

export async function seedCategoriesOtherFamilies(
  prisma: PrismaClient,
  deptMap: Map<string, string>
) {
  console.log('📂 Creando categorías de otras familias...')

  // Esta función será extraída del seed principal
  // Por ahora, retornamos para no romper el seed
  console.log('  ⏭️  Categorías otras familias (pendiente de migración)')
}
