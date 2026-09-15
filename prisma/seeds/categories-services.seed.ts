/**
 * Seed: Categorías OPERACIONES — Limpieza, Parqueaderos y SSO
 *
 * Mismo criterio aplicado a TI/Mantenimiento/Arquitectura/Seguridad/
 * Comercial/Administrativa/Áreas Verdes: se pliega el nivel 3 de síntoma en
 * Limpieza (Oficina/Local/Baños/Zonas Comunes bajo Limpieza Regular;
 * Sanitización Completa/Alfombras bajo Limpieza Profunda; Vidrios/Fachada
 * bajo Limpieza Especial) en la descripción de su padre de nivel 2 — el
 * mismo personal de limpieza atiende todos esos casos y el buscador de
 * sugerencias ya indexa por name+description. Parqueaderos y SSO ya estaban
 * a lo sumo en 2 niveles, sin fragmentación — solo se agrega
 * `priorityCeiling`. Se agrega también el retiro en bloque de categorías
 * viejas (este archivo no lo tenía).
 */

import { PrismaClient, TicketPriority } from '@prisma/client'
import { upsertCategory, type CategorySeedData } from './category-upsert'

export async function seedCategoriesServices(prisma: PrismaClient, deptMap: Map<string, string>) {
  const deptLimpieza = deptMap.get('Limpieza')
  const deptParqueaderos = deptMap.get('Parqueaderos')
  const deptSSO = deptMap.get('Seguridad y Salud Ocupacional')

  if (!deptLimpieza) {
    console.log('⚠️  Departamento Limpieza no encontrado, saltando seed...')
    return
  }

  const currentIds: string[] = []
  async function create(data: CategorySeedData) {
    const category = await upsertCategory(prisma, data)
    currentIds.push(category.id)
    return category
  }

  // ==================== DEPARTAMENTO LIMPIEZA ====================
  const solicitudLimpieza = await create({
    name: 'Solicitud de Limpieza',
    description: 'Solicitudes de servicio de limpieza',
    level: 1,
    parentId: null,
    departmentId: deptLimpieza,
    order: 1,
    color: '#06B6D4',
  })

  const emergenciaLimpieza = await create({
    name: 'Emergencia de Limpieza',
    description: 'Limpieza urgente por derrames o incidentes',
    level: 1,
    parentId: null,
    departmentId: deptLimpieza,
    order: 2,
    color: '#EF4444',
  })

  // Nivel 2 - Solicitudes Limpieza
  await create({
    name: 'Limpieza Regular',
    description:
      'Limpieza programada regular: oficinas, locales comerciales, baños o zonas comunes (pasillos, escaleras, ascensores)',
    level: 2,
    parentId: solicitudLimpieza.id,
    departmentId: deptLimpieza,
    order: 1,
    color: '#06B6D4',
    priorityCeiling: TicketPriority.LOW,
  })

  await create({
    name: 'Limpieza Profunda',
    description:
      'Limpieza a profundidad y sanitización: sanitización completa por salud o normativa, limpieza y desinfección de alfombras',
    level: 2,
    parentId: solicitudLimpieza.id,
    departmentId: deptLimpieza,
    order: 2,
    color: '#06B6D4',
    priorityCeiling: TicketPriority.LOW,
  })

  await create({
    name: 'Limpieza Especial',
    description:
      'Limpieza de vidrios, fachadas y superficies especiales: ventanas, fachada exterior',
    level: 2,
    parentId: solicitudLimpieza.id,
    departmentId: deptLimpieza,
    order: 3,
    color: '#06B6D4',
    priorityCeiling: TicketPriority.LOW,
  })

  // Nivel 2 - Emergencias
  await create({
    name: 'Derrames',
    description: 'Derrames de líquidos o sustancias — riesgo de resbalón o caída',
    level: 2,
    parentId: emergenciaLimpieza.id,
    departmentId: deptLimpieza,
    order: 1,
    color: '#EF4444',
    priorityCeiling: TicketPriority.HIGH,
  })

  await create({
    name: 'Desechos o Basura',
    description: 'Acumulación de basura o desechos',
    level: 2,
    parentId: emergenciaLimpieza.id,
    departmentId: deptLimpieza,
    order: 2,
    color: '#EF4444',
    priorityCeiling: TicketPriority.MEDIUM,
  })

  await create({
    name: 'Incidente Sanitario',
    description: 'Limpieza por incidente sanitario o vómito — riesgo de salud',
    level: 2,
    parentId: emergenciaLimpieza.id,
    departmentId: deptLimpieza,
    order: 3,
    color: '#EF4444',
    priorityCeiling: TicketPriority.HIGH,
  })

  // ==================== DEPARTAMENTO PARQUEADEROS ====================
  if (deptParqueaderos) {
    const solicitudParqueadero = await create({
      name: 'Solicitud de Parqueadero',
      description: 'Solicitudes relacionadas con operación de parqueaderos',
      level: 1,
      parentId: null,
      departmentId: deptParqueaderos,
      order: 1,
      color: '#0D9488',
    })

    await create({
      name: 'Incidente en Parqueadero',
      description: 'Incidentes, daños o novedades en parqueaderos',
      level: 1,
      parentId: null,
      departmentId: deptParqueaderos,
      order: 2,
      color: '#EF4444',
      priorityCeiling: TicketPriority.HIGH,
    })

    await create({
      name: 'Control de Acceso Vehicular',
      description: 'Problemas con barreras, tarjetas o acceso vehicular',
      level: 2,
      parentId: solicitudParqueadero.id,
      departmentId: deptParqueaderos,
      order: 1,
      color: '#0D9488',
      priorityCeiling: TicketPriority.MEDIUM,
    })
  }

  // ==================== DEPARTAMENTO SSO ====================
  if (deptSSO) {
    const solicitudSSO = await create({
      name: 'Solicitud SSO',
      description: 'Solicitudes de seguridad y salud ocupacional',
      level: 1,
      parentId: null,
      departmentId: deptSSO,
      order: 1,
      color: '#14B8A6',
    })

    await create({
      name: 'Incidente de Seguridad Laboral',
      description: 'Accidentes, incidentes o riesgos en el trabajo',
      level: 1,
      parentId: null,
      departmentId: deptSSO,
      order: 2,
      color: '#EF4444',
      priorityCeiling: TicketPriority.HIGH,
    })

    await create({
      name: 'Examen Médico Ocupacional',
      description: 'Solicitud o consulta de exámenes médicos',
      level: 2,
      parentId: solicitudSSO.id,
      departmentId: deptSSO,
      order: 1,
      color: '#14B8A6',
      priorityCeiling: TicketPriority.LOW,
    })

    await create({
      name: 'Capacitación SSO',
      description: 'Solicitud de capacitación en seguridad ocupacional',
      level: 2,
      parentId: solicitudSSO.id,
      departmentId: deptSSO,
      order: 2,
      color: '#14B8A6',
      priorityCeiling: TicketPriority.LOW,
    })
  }

  // ==================== RETIRO DE CATEGORÍAS VIEJAS ====================
  let retired = 0
  for (const deptId of [deptLimpieza, deptParqueaderos, deptSSO]) {
    if (!deptId) continue
    const old = await prisma.categories.findMany({
      where: { departmentId: deptId, isActive: true, id: { notIn: currentIds } },
      select: { id: true },
    })
    if (old.length > 0) {
      await prisma.categories.updateMany({
        where: { id: { in: old.map(c => c.id) } },
        data: { isActive: false, updatedAt: new Date() },
      })
      retired += old.length
    }
  }

  console.log(
    `✅ Categorías OPERATIONS (Limpieza, Parqueaderos, SSO): ${currentIds.length} vigentes, ${retired} retiradas`
  )
}
