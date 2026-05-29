/**
 * Seed: Categorías para Familia COMERCIAL Y MARKETING (COMMERCIAL)
 *
 * Categorías completas para centro comercial: comercial, marketing, eventos, activaciones.
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

export async function seedCategoriesCommercial(prisma: PrismaClient, deptMap: Map<string, string>) {
  const deptComercial = deptMap.get('Comercial')
  const deptMarketing = deptMap.get('Marketing')

  if (!deptComercial && !deptMarketing) {
    console.log('⚠️  Departamentos de COMMERCIAL no encontrados, saltando seed...')
    return
  }

  const deptPrincipal = deptComercial || deptMarketing!

  // ==================== DEPARTAMENTO COMERCIAL/MARKETING ====================
  const solicitudComercial = await upsertCategory(prisma, {
    name: 'Solicitud Comercial o de Marketing',
    description: 'Solicitudes al área comercial o de marketing',
    level: 1,
    parentId: null,
    departmentId: deptPrincipal,
    order: 1,
    color: '#EC4899',
  })

  // Nivel 2 - Solicitudes Comerciales
  const arrendamiento = await upsertCategory(prisma, {
    name: 'Arrendamiento de Locales',
    description: 'Consultas y solicitudes sobre arrendamiento',
    level: 2,
    parentId: solicitudComercial.id,
    departmentId: deptComercial || deptPrincipal,
    order: 1,
    color: '#EC4899',
  })

  const eventos = await upsertCategory(prisma, {
    name: 'Eventos y Activaciones',
    description: 'Solicitudes para eventos o activaciones',
    level: 2,
    parentId: solicitudComercial.id,
    departmentId: deptMarketing || deptPrincipal,
    order: 2,
    color: '#EC4899',
  })

  const publicidad = await upsertCategory(prisma, {
    name: 'Publicidad y Promociones',
    description: 'Solicitudes de publicidad o espacios promocionales',
    level: 2,
    parentId: solicitudComercial.id,
    departmentId: deptMarketing || deptPrincipal,
    order: 3,
    color: '#EC4899',
  })

  const redesSociales = await upsertCategory(prisma, {
    name: 'Redes Sociales y Contenido',
    description: 'Solicitudes relacionadas con redes sociales',
    level: 2,
    parentId: solicitudComercial.id,
    departmentId: deptMarketing || deptPrincipal,
    order: 4,
    color: '#EC4899',
  })

  // Nivel 3 - Arrendamiento
  await upsertCategory(prisma, {
    name: 'Consulta de Disponibilidad',
    description: 'Consultar locales disponibles',
    level: 3,
    parentId: arrendamiento.id,
    departmentId: deptComercial || deptPrincipal,
    order: 1,
    color: '#EC4899',
  })

  await upsertCategory(prisma, {
    name: 'Solicitud de Información',
    description: 'Solicitar información de arrendamiento',
    level: 3,
    parentId: arrendamiento.id,
    departmentId: deptComercial || deptPrincipal,
    order: 2,
    color: '#EC4899',
  })

  // Nivel 3 - Eventos
  await upsertCategory(prisma, {
    name: 'Reserva de Espacio',
    description: 'Reservar espacio para evento o activación',
    level: 3,
    parentId: eventos.id,
    departmentId: deptMarketing || deptPrincipal,
    order: 1,
    color: '#EC4899',
  })

  await upsertCategory(prisma, {
    name: 'Coordinación de Evento',
    description: 'Coordinar logística de evento',
    level: 3,
    parentId: eventos.id,
    departmentId: deptMarketing || deptPrincipal,
    order: 2,
    color: '#EC4899',
  })

  // Nivel 3 - Publicidad
  await upsertCategory(prisma, {
    name: 'Solicitud de Espacio Publicitario',
    description: 'Solicitar espacio para publicidad',
    level: 3,
    parentId: publicidad.id,
    departmentId: deptMarketing || deptPrincipal,
    order: 1,
    color: '#EC4899',
  })

  await upsertCategory(prisma, {
    name: 'Promoción Conjunta',
    description: 'Proponer promoción conjunta',
    level: 3,
    parentId: publicidad.id,
    departmentId: deptMarketing || deptPrincipal,
    order: 2,
    color: '#EC4899',
  })

  console.log('✅ Categorías COMMERCIAL (Comercial y Marketing)')
}
