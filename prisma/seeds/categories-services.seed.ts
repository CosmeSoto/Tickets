/**
 * Seed: Categorías para Familia SERVICIOS GENERALES (SERVICES)
 *
 * Categorías completas para centro comercial: limpieza, mensajería, atención al cliente.
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

export async function seedCategoriesServices(prisma: PrismaClient, deptMap: Map<string, string>) {
  const deptLimpieza = deptMap.get('Limpieza')
  const deptMensajeria = deptMap.get('Mensajería')

  if (!deptLimpieza || !deptMensajeria) {
    console.log('⚠️  Departamentos de SERVICES no encontrados, saltando seed...')
    return
  }

  // ==================== DEPARTAMENTO LIMPIEZA ====================
  const solicitudLimpieza = await upsertCategory(prisma, {
    name: 'Solicitud de Limpieza',
    description: 'Solicitudes de servicio de limpieza',
    level: 1,
    parentId: null,
    departmentId: deptLimpieza,
    order: 1,
    color: '#06B6D4',
  })

  const emergenciaLimpieza = await upsertCategory(prisma, {
    name: 'Emergencia de Limpieza',
    description: 'Limpieza urgente por derrames o incidentes',
    level: 1,
    parentId: null,
    departmentId: deptLimpieza,
    order: 2,
    color: '#EF4444',
  })

  // Nivel 2 - Solicitudes Limpieza
  const limpiezaRegular = await upsertCategory(prisma, {
    name: 'Limpieza Regular',
    description: 'Limpieza programada regular',
    level: 2,
    parentId: solicitudLimpieza.id,
    departmentId: deptLimpieza,
    order: 1,
    color: '#06B6D4',
  })

  const limpiezaProfunda = await upsertCategory(prisma, {
    name: 'Limpieza Profunda',
    description: 'Limpieza a profundidad, sanitización',
    level: 2,
    parentId: solicitudLimpieza.id,
    departmentId: deptLimpieza,
    order: 2,
    color: '#06B6D4',
  })

  const limpiezaEspecial = await upsertCategory(prisma, {
    name: 'Limpieza Especial',
    description: 'Limpieza de vidrios, fachadas, superficies especiales',
    level: 2,
    parentId: solicitudLimpieza.id,
    departmentId: deptLimpieza,
    order: 3,
    color: '#06B6D4',
  })

  // Nivel 3 - Limpieza Regular
  await upsertCategory(prisma, {
    name: 'Limpieza de Oficina',
    description: 'Limpieza de oficinas y escritorios',
    level: 3,
    parentId: limpiezaRegular.id,
    departmentId: deptLimpieza,
    order: 1,
    color: '#06B6D4',
  })

  await upsertCategory(prisma, {
    name: 'Limpieza de Local',
    description: 'Limpieza de local comercial',
    level: 3,
    parentId: limpiezaRegular.id,
    departmentId: deptLimpieza,
    order: 2,
    color: '#06B6D4',
  })

  await upsertCategory(prisma, {
    name: 'Limpieza de Baños',
    description: 'Limpieza y sanitización de sanitarios',
    level: 3,
    parentId: limpiezaRegular.id,
    departmentId: deptLimpieza,
    order: 3,
    color: '#06B6D4',
  })

  await upsertCategory(prisma, {
    name: 'Limpieza de Zonas Comunes',
    description: 'Limpieza de pasillos, escaleras, ascensores',
    level: 3,
    parentId: limpiezaRegular.id,
    departmentId: deptLimpieza,
    order: 4,
    color: '#06B6D4',
  })

  // Nivel 3 - Limpieza Profunda
  await upsertCategory(prisma, {
    name: 'Sanitización Completa',
    description: 'Sanitización profunda por salud o normativa',
    level: 3,
    parentId: limpiezaProfunda.id,
    departmentId: deptLimpieza,
    order: 1,
    color: '#06B6D4',
  })

  await upsertCategory(prisma, {
    name: 'Limpieza de Alfombras',
    description: 'Limpieza y desinfección de alfombras',
    level: 3,
    parentId: limpiezaProfunda.id,
    departmentId: deptLimpieza,
    order: 2,
    color: '#06B6D4',
  })

  // Nivel 3 - Limpieza Especial
  await upsertCategory(prisma, {
    name: 'Limpieza de Vidrios',
    description: 'Limpieza de vidrios y ventanas',
    level: 3,
    parentId: limpiezaEspecial.id,
    departmentId: deptLimpieza,
    order: 1,
    color: '#06B6D4',
  })

  await upsertCategory(prisma, {
    name: 'Limpieza de Fachada',
    description: 'Limpieza de fachada exterior',
    level: 3,
    parentId: limpiezaEspecial.id,
    departmentId: deptLimpieza,
    order: 2,
    color: '#06B6D4',
  })

  // Nivel 2 - Emergencias
  const derrames = await upsertCategory(prisma, {
    name: 'Derrames',
    description: 'Derrames de líquidos o sustancias',
    level: 2,
    parentId: emergenciaLimpieza.id,
    departmentId: deptLimpieza,
    order: 1,
    color: '#EF4444',
  })

  const desechos = await upsertCategory(prisma, {
    name: 'Desechos o Basura',
    description: 'Acumulación de basura o desechos',
    level: 2,
    parentId: emergenciaLimpieza.id,
    departmentId: deptLimpieza,
    order: 2,
    color: '#EF4444',
  })

  const incidentesSanitarios = await upsertCategory(prisma, {
    name: 'Incidente Sanitario',
    description: 'Limpieza por incidente sanitario o vómito',
    level: 2,
    parentId: emergenciaLimpieza.id,
    departmentId: deptLimpieza,
    order: 3,
    color: '#EF4444',
  })

  // ==================== DEPARTAMENTO MENSAJERÍA ====================
  const solicitudMensajeria = await upsertCategory(prisma, {
    name: 'Solicitud de Mensajería',
    description: 'Solicitudes de servicio de mensajería y envíos',
    level: 1,
    parentId: null,
    departmentId: deptMensajeria,
    order: 1,
    color: '#8B5CF6',
  })

  const consultaMensajeria = await upsertCategory(prisma, {
    name: 'Consulta o Seguimiento',
    description: 'Consultas y seguimiento de envíos',
    level: 1,
    parentId: null,
    departmentId: deptMensajeria,
    order: 2,
    color: '#10B981',
  })

  // Nivel 2 - Solicitudes Mensajería
  const entregaInterna = await upsertCategory(prisma, {
    name: 'Entrega Interna',
    description: 'Entregas dentro del centro comercial',
    level: 2,
    parentId: solicitudMensajeria.id,
    departmentId: deptMensajeria,
    order: 1,
    color: '#8B5CF6',
  })

  const entregaExterna = await upsertCategory(prisma, {
    name: 'Entrega Externa',
    description: 'Envíos y entregas fuera del centro comercial',
    level: 2,
    parentId: solicitudMensajeria.id,
    departmentId: deptMensajeria,
    order: 2,
    color: '#8B5CF6',
  })

  const recepcionPaquetes = await upsertCategory(prisma, {
    name: 'Recepción de Paquetes',
    description: 'Recepción y gestión de paquetes',
    level: 2,
    parentId: solicitudMensajeria.id,
    departmentId: deptMensajeria,
    order: 3,
    color: '#8B5CF6',
  })

  // Nivel 3 - Entrega Interna
  await upsertCategory(prisma, {
    name: 'Correspondencia',
    description: 'Entrega de correspondencia entre locales',
    level: 3,
    parentId: entregaInterna.id,
    departmentId: deptMensajeria,
    order: 1,
    color: '#8B5CF6',
  })

  await upsertCategory(prisma, {
    name: 'Documentos',
    description: 'Entrega de documentos importantes',
    level: 3,
    parentId: entregaInterna.id,
    departmentId: deptMensajeria,
    order: 2,
    color: '#8B5CF6',
  })

  await upsertCategory(prisma, {
    name: 'Paquetes Pequeños',
    description: 'Entrega de paquetes pequeños',
    level: 3,
    parentId: entregaInterna.id,
    departmentId: deptMensajeria,
    order: 3,
    color: '#8B5CF6',
  })

  // Nivel 3 - Entrega Externa
  await upsertCategory(prisma, {
    name: 'Envío a Cliente',
    description: 'Envío de productos a clientes',
    level: 3,
    parentId: entregaExterna.id,
    departmentId: deptMensajeria,
    order: 1,
    color: '#8B5CF6',
  })

  await upsertCategory(prisma, {
    name: 'Envío a Proveedor',
    description: 'Envío de devoluciones o documentos a proveedores',
    level: 3,
    parentId: entregaExterna.id,
    departmentId: deptMensajeria,
    order: 2,
    color: '#8B5CF6',
  })

  // Nivel 3 - Consultas
  await upsertCategory(prisma, {
    name: 'Rastreo de Envío',
    description: 'Consultar estado de un envío',
    level: 3,
    parentId: consultaMensajeria.id,
    departmentId: deptMensajeria,
    order: 1,
    color: '#10B981',
  })

  await upsertCategory(prisma, {
    name: 'Confirmación de Entrega',
    description: 'Confirmar entrega realizada',
    level: 3,
    parentId: consultaMensajeria.id,
    departmentId: deptMensajeria,
    order: 2,
    color: '#10B981',
  })

  console.log('✅ Categorías SERVICES (Servicios Generales)')
}
