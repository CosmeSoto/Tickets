/**
 * Seed: Categorías OPERACIONES — Limpieza, Parqueaderos y SSO
 */

import { PrismaClient } from '@prisma/client'
import { upsertCategory } from './category-upsert'

export async function seedCategoriesServices(prisma: PrismaClient, deptMap: Map<string, string>) {
  const deptLimpieza = deptMap.get('Limpieza')
  const deptParqueaderos = deptMap.get('Parqueaderos')
  const deptSSO = deptMap.get('Seguridad y Salud Ocupacional')

  if (!deptLimpieza) {
    console.log('⚠️  Departamento Limpieza no encontrado, saltando seed...')
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

  // ==================== DEPARTAMENTO PARQUEADEROS ====================
  if (deptParqueaderos) {
    const solicitudParqueadero = await upsertCategory(prisma, {
      name: 'Solicitud de Parqueadero',
      description: 'Solicitudes relacionadas con operación de parqueaderos',
      level: 1,
      parentId: null,
      departmentId: deptParqueaderos,
      order: 1,
      color: '#0D9488',
    })

    await upsertCategory(prisma, {
      name: 'Incidente en Parqueadero',
      description: 'Incidentes, daños o novedades en parqueaderos',
      level: 1,
      parentId: null,
      departmentId: deptParqueaderos,
      order: 2,
      color: '#EF4444',
    })

    await upsertCategory(prisma, {
      name: 'Control de Acceso Vehicular',
      description: 'Problemas con barreras, tarjetas o acceso vehicular',
      level: 2,
      parentId: solicitudParqueadero.id,
      departmentId: deptParqueaderos,
      order: 1,
      color: '#0D9488',
    })
  }

  // ==================== DEPARTAMENTO SSO ====================
  if (deptSSO) {
    const solicitudSSO = await upsertCategory(prisma, {
      name: 'Solicitud SSO',
      description: 'Solicitudes de seguridad y salud ocupacional',
      level: 1,
      parentId: null,
      departmentId: deptSSO,
      order: 1,
      color: '#14B8A6',
    })

    await upsertCategory(prisma, {
      name: 'Incidente de Seguridad Laboral',
      description: 'Accidentes, incidentes o riesgos en el trabajo',
      level: 1,
      parentId: null,
      departmentId: deptSSO,
      order: 2,
      color: '#EF4444',
    })

    await upsertCategory(prisma, {
      name: 'Examen Médico Ocupacional',
      description: 'Solicitud o consulta de exámenes médicos',
      level: 2,
      parentId: solicitudSSO.id,
      departmentId: deptSSO,
      order: 1,
      color: '#14B8A6',
    })

    await upsertCategory(prisma, {
      name: 'Capacitación SSO',
      description: 'Solicitud de capacitación en seguridad ocupacional',
      level: 2,
      parentId: solicitudSSO.id,
      departmentId: deptSSO,
      order: 2,
      color: '#14B8A6',
    })
  }

  console.log('✅ Categorías OPERATIONS (Limpieza, Parqueaderos, SSO)')
}
