/**
 * Seed: Categorías para Familia ÁREAS VERDES (GREEN_AREAS)
 *
 * Categorías completas para centro comercial: jardinería, mantenimiento de áreas verdes.
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

export async function seedCategoriesGreenAreas(prisma: PrismaClient, deptMap: Map<string, string>) {
  const deptAreasVerdes = deptMap.get('Áreas Verdes')

  if (!deptAreasVerdes) {
    console.log('⚠️  Departamento de GREEN_AREAS no encontrado, saltando seed...')
    return
  }

  // ==================== DEPARTAMENTO ÁREAS VERDES ====================
  const fallaAreasVerdes = await upsertCategory(prisma, {
    name: 'Problema en Áreas Verdes',
    description: 'Problemas o daños en jardinería o áreas verdes',
    level: 1,
    parentId: null,
    departmentId: deptAreasVerdes,
    order: 1,
    color: '#EF4444',
  })

  const solicitudAreasVerdes = await upsertCategory(prisma, {
    name: 'Solicitud de Jardinería',
    description: 'Solicitudes de servicio de jardinería y mantenimiento',
    level: 1,
    parentId: null,
    departmentId: deptAreasVerdes,
    order: 2,
    color: '#3B82F6',
  })

  // Nivel 2 - Problemas en Áreas Verdes
  const plantasEnfermas = await upsertCategory(prisma, {
    name: 'Plantas Enfermas o Dañadas',
    description: 'Plantas con enfermedades o daños',
    level: 2,
    parentId: fallaAreasVerdes.id,
    departmentId: deptAreasVerdes,
    order: 1,
    color: '#EF4444',
  })

  const sistemaRiego = await upsertCategory(prisma, {
    name: 'Sistema de Riego',
    description: 'Fallas en sistema de riego',
    level: 2,
    parentId: fallaAreasVerdes.id,
    departmentId: deptAreasVerdes,
    order: 2,
    color: '#EF4444',
  })

  const residuosJardineria = await upsertCategory(prisma, {
    name: 'Residuos o Desecho',
    description: 'Acumulación de hojas, ramas o desechos',
    level: 2,
    parentId: fallaAreasVerdes.id,
    departmentId: deptAreasVerdes,
    order: 3,
    color: '#EF4444',
  })

  // Nivel 3 - Plantas
  await upsertCategory(prisma, {
    name: 'Planta Seca',
    description: 'Planta seca o marchita',
    level: 3,
    parentId: plantasEnfermas.id,
    departmentId: deptAreasVerdes,
    order: 1,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Plaga o Enfermedad',
    description: 'Presencia de plagas o enfermedades en plantas',
    level: 3,
    parentId: plantasEnfermas.id,
    departmentId: deptAreasVerdes,
    order: 2,
    color: '#EF4444',
  })

  // Nivel 3 - Sistema de Riego
  await upsertCategory(prisma, {
    name: 'Fuga de Agua',
    description: 'Fuga en sistema de riego',
    level: 3,
    parentId: sistemaRiego.id,
    departmentId: deptAreasVerdes,
    order: 1,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Aspersor No Funciona',
    description: 'Aspersor o rociador defectuoso',
    level: 3,
    parentId: sistemaRiego.id,
    departmentId: deptAreasVerdes,
    order: 2,
    color: '#EF4444',
  })

  // Nivel 2 - Solicitudes de Jardinería
  const mantenimientoJardineria = await upsertCategory(prisma, {
    name: 'Mantenimiento',
    description: 'Mantenimiento preventivo de jardinería',
    level: 2,
    parentId: solicitudAreasVerdes.id,
    departmentId: deptAreasVerdes,
    order: 1,
    color: '#3B82F6',
  })

  const poda = await upsertCategory(prisma, {
    name: 'Poda',
    description: 'Solicitud de poda de árboles o arbustos',
    level: 2,
    parentId: solicitudAreasVerdes.id,
    departmentId: deptAreasVerdes,
    order: 2,
    color: '#3B82F6',
  })

  const nuevaPlantacion = await upsertCategory(prisma, {
    name: 'Nueva Plantación',
    description: 'Solicitud de plantar nuevas especies',
    level: 2,
    parentId: solicitudAreasVerdes.id,
    departmentId: deptAreasVerdes,
    order: 3,
    color: '#3B82F6',
  })

  const decoracion = await upsertCategory(prisma, {
    name: 'Decoración Temporal',
    description: 'Decoración navideña o eventos especiales',
    level: 2,
    parentId: solicitudAreasVerdes.id,
    departmentId: deptAreasVerdes,
    order: 4,
    color: '#3B82F6',
  })

  console.log('✅ Categorías GREEN_AREAS (Áreas Verdes)')
}
