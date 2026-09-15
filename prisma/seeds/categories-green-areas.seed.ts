/**
 * Seed: Categorías para Familia OPERACIONES — Áreas Verdes
 *
 * Categorías completas para centro comercial: jardinería, mantenimiento de áreas verdes.
 *
 * Mismo criterio aplicado a TI/Mantenimiento/Arquitectura/Seguridad/Comercial/
 * Administrativa: se pliega el nivel 3 de síntoma (Planta Seca, Plaga o
 * Enfermedad bajo Plantas Enfermas; Fuga de Agua, Aspersor No Funciona bajo
 * Sistema de Riego) en la descripción de su padre de nivel 2 — el mismo
 * jardinero atiende todos esos casos y el buscador de sugerencias ya indexa
 * por name+description. Se agrega `priorityCeiling` y el retiro en bloque de
 * las categorías viejas (este archivo no lo tenía).
 */

import { PrismaClient, TicketPriority } from '@prisma/client'
import { upsertCategory, type CategorySeedData } from './category-upsert'

export async function seedCategoriesGreenAreas(prisma: PrismaClient, deptMap: Map<string, string>) {
  const deptAreasVerdes = deptMap.get('Áreas Verdes')

  if (!deptAreasVerdes) {
    console.log('⚠️  Departamento Áreas Verdes no encontrado, saltando seed...')
    return
  }

  const currentIds: string[] = []
  async function create(data: CategorySeedData) {
    const category = await upsertCategory(prisma, data)
    currentIds.push(category.id)
    return category
  }

  // ==================== DEPARTAMENTO ÁREAS VERDES ====================
  const fallaAreasVerdes = await create({
    name: 'Problema en Áreas Verdes',
    description: 'Problemas o daños en jardinería o áreas verdes',
    level: 1,
    parentId: null,
    departmentId: deptAreasVerdes,
    order: 1,
    color: '#EF4444',
  })

  const solicitudAreasVerdes = await create({
    name: 'Solicitud de Jardinería',
    description: 'Solicitudes de servicio de jardinería y mantenimiento',
    level: 1,
    parentId: null,
    departmentId: deptAreasVerdes,
    order: 2,
    color: '#3B82F6',
  })

  // Nivel 2 - Problemas en Áreas Verdes
  await create({
    name: 'Plantas Enfermas o Dañadas',
    description: 'Plantas con enfermedades o daños: planta seca o marchita, plaga o enfermedad',
    level: 2,
    parentId: fallaAreasVerdes.id,
    departmentId: deptAreasVerdes,
    order: 1,
    color: '#EF4444',
    priorityCeiling: TicketPriority.MEDIUM,
  })

  await create({
    name: 'Sistema de Riego',
    description: 'Fallas en sistema de riego: fuga de agua, aspersor o rociador defectuoso',
    level: 2,
    parentId: fallaAreasVerdes.id,
    departmentId: deptAreasVerdes,
    order: 2,
    color: '#EF4444',
    priorityCeiling: TicketPriority.MEDIUM,
  })

  await create({
    name: 'Residuos o Desecho',
    description: 'Acumulación de hojas, ramas o desechos',
    level: 2,
    parentId: fallaAreasVerdes.id,
    departmentId: deptAreasVerdes,
    order: 3,
    color: '#EF4444',
    priorityCeiling: TicketPriority.LOW,
  })

  // Nivel 2 - Solicitudes de Jardinería
  await create({
    name: 'Mantenimiento',
    description: 'Mantenimiento preventivo de jardinería',
    level: 2,
    parentId: solicitudAreasVerdes.id,
    departmentId: deptAreasVerdes,
    order: 1,
    color: '#3B82F6',
    priorityCeiling: TicketPriority.LOW,
  })

  await create({
    name: 'Poda',
    description: 'Solicitud de poda de árboles o arbustos',
    level: 2,
    parentId: solicitudAreasVerdes.id,
    departmentId: deptAreasVerdes,
    order: 2,
    color: '#3B82F6',
    priorityCeiling: TicketPriority.LOW,
  })

  await create({
    name: 'Nueva Plantación',
    description: 'Solicitud de plantar nuevas especies',
    level: 2,
    parentId: solicitudAreasVerdes.id,
    departmentId: deptAreasVerdes,
    order: 3,
    color: '#3B82F6',
    priorityCeiling: TicketPriority.LOW,
  })

  await create({
    name: 'Decoración Temporal',
    description: 'Decoración navideña o eventos especiales',
    level: 2,
    parentId: solicitudAreasVerdes.id,
    departmentId: deptAreasVerdes,
    order: 4,
    color: '#3B82F6',
    priorityCeiling: TicketPriority.LOW,
  })

  // ==================== RETIRO DE CATEGORÍAS VIEJAS ====================
  const oldCategories = await prisma.categories.findMany({
    where: { departmentId: deptAreasVerdes, isActive: true, id: { notIn: currentIds } },
    select: { id: true },
  })
  if (oldCategories.length > 0) {
    await prisma.categories.updateMany({
      where: { id: { in: oldCategories.map(c => c.id) } },
      data: { isActive: false, updatedAt: new Date() },
    })
  }

  console.log(
    `✅ Categorías OPERATIONS — Áreas Verdes: ${currentIds.length} vigentes, ${oldCategories.length} retiradas`
  )
}
