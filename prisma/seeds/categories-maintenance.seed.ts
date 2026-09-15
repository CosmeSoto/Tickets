/**
 * Seed: Categorías para Familia OPERACIONES — Mantenimiento
 *
 * Categorías completas para centro comercial: mantenimiento civil, eléctrico, mecánico
 * e infraestructura (agua, gas, HVAC, drenaje, estacionamiento).
 *
 * A diferencia de TI (categories-technology.seed.ts, 117 → 15 categorías en un solo
 * departamento), aquí el nivel 1/2 SÍ es significativo y no se toca: agrupa por
 * oficio/especialidad real (civil, eléctrico, mecánico, infraestructura), que es lo
 * que determina a qué técnico se asigna el ticket — Arquitectura y Mantenimiento
 * siguen siendo equipos separados con responsabilidades distintas (confirmado con el
 * usuario). Lo que sí sobraba era el nivel 3 — una categoría por síntoma dentro de
 * cada especialidad (ej. "Baldosa Rota"/"Grieta en Pared"/"Desprendimiento de
 * Revestimiento" bajo "Pisos y Paredes", las tres atendidas por el mismo técnico
 * civil) — se elimina y su texto se pliega en la descripción de la categoría de
 * nivel 2. El selector de categorías arma sus palabras clave de búsqueda a partir de
 * `name`+`description` (src/features/category-selection/utils/search-index.ts), así
 * que la descripción enriquecida sigue permitiendo que el buscador sugiera bien sin
 * necesidad de una categoría por síntoma.
 *
 * Las 23 categorías de nivel 2 (ahora hojas) llevan además un `priorityCeiling`
 * inicial: URGENT en fallas que son una emergencia real (fuga de gas, ascensor con
 * gente atrapada, corte total de energía), HIGH en fallas con riesgo de daño mayor o
 * de seguridad (agua, estructura, electricidad), MEDIUM en fallas de confort/
 * estética, y LOW en todo el lado "Solicitud" (mantenimiento preventivo, reparación
 * programada, pintura, instalación — nunca es una emergencia). Solo se aplica al
 * crear la categoría (ver category-upsert.ts) — si un admin lo ajusta después a
 * mano, el seed no lo revierte.
 */

import { PrismaClient, TicketPriority } from '@prisma/client'
import { upsertCategory, type CategorySeedData } from './category-upsert'

export async function seedCategoriesMaintenance(
  prisma: PrismaClient,
  deptMap: Map<string, string>
) {
  const deptMantenimiento = deptMap.get('Mantenimiento')

  if (!deptMantenimiento) {
    console.log('⚠️  Departamento Mantenimiento no encontrado, saltando seed...')
    return
  }

  // Ids de las categorías vigentes — se usan al final para retirar en bloque
  // todo lo demás que quede activo bajo este departamento (los viejos niveles
  // 3 de síntoma). Mismo patrón que categories-technology.seed.ts.
  const currentIds: string[] = []
  async function create(data: CategorySeedData) {
    const category = await upsertCategory(prisma, data)
    currentIds.push(category.id)
    return category
  }

  // ==================== DEPARTAMENTO MANTENIMIENTO CIVIL ====================
  const fallaCivil = await create({
    name: 'Falla o Daño',
    description: 'Daño o desperfecto civil',
    level: 1,
    parentId: null,
    departmentId: deptMantenimiento,
    order: 1,
    color: '#EF4444',
  })

  const solicitudCivil = await create({
    name: 'Solicitud de Mantenimiento',
    description: 'Solicitudes de mantenimiento preventivo o correctivo',
    level: 1,
    parentId: null,
    departmentId: deptMantenimiento,
    order: 2,
    color: '#3B82F6',
  })

  // Nivel 2 - Fallas Civiles (hojas: absorben los síntomas que antes eran nivel 3)
  await create({
    name: 'Pisos y Paredes',
    description:
      'Daños en pisos, baldosas, revestimientos: baldosa rota o suelta, grieta o fisura en pared, desprendimiento de revestimiento o pintura',
    level: 2,
    parentId: fallaCivil.id,
    departmentId: deptMantenimiento,
    order: 1,
    color: '#EF4444',
    priorityCeiling: TicketPriority.MEDIUM,
  })

  await create({
    name: 'Puertas y Ventanas',
    description:
      'Daños en puertas, ventanas, cerraduras: cerradura defectuosa, bisagra rota o ruidosa, vidrio roto',
    level: 2,
    parentId: fallaCivil.id,
    departmentId: deptMantenimiento,
    order: 2,
    color: '#EF4444',
    // Vidrio roto es riesgo de corte para clientes/personal.
    priorityCeiling: TicketPriority.HIGH,
  })

  await create({
    name: 'Plomería y Sanitarios',
    description:
      'Fallas en plomería, tuberías, sanitarios: fuga de agua en tubería o conexión, desagüe obstruido',
    level: 2,
    parentId: fallaCivil.id,
    departmentId: deptMantenimiento,
    order: 3,
    color: '#EF4444',
    priorityCeiling: TicketPriority.HIGH,
  })

  await create({
    name: 'Techos y Cubiertas',
    description: 'Goteras, filtraciones, daños en techos',
    level: 2,
    parentId: fallaCivil.id,
    departmentId: deptMantenimiento,
    order: 4,
    color: '#EF4444',
    priorityCeiling: TicketPriority.HIGH,
  })

  // Nivel 2 - Solicitudes Civiles
  await create({
    name: 'Mantenimiento Preventivo',
    description: 'Solicitudes de mantenimiento programado',
    level: 2,
    parentId: solicitudCivil.id,
    departmentId: deptMantenimiento,
    order: 1,
    color: '#3B82F6',
    priorityCeiling: TicketPriority.LOW,
  })

  await create({
    name: 'Reparación',
    description: 'Solicitudes de reparación',
    level: 2,
    parentId: solicitudCivil.id,
    departmentId: deptMantenimiento,
    order: 2,
    color: '#3B82F6',
    priorityCeiling: TicketPriority.LOW,
  })

  await create({
    name: 'Pintura',
    description: 'Solicitudes de pintura',
    level: 2,
    parentId: solicitudCivil.id,
    departmentId: deptMantenimiento,
    order: 3,
    color: '#3B82F6',
    priorityCeiling: TicketPriority.LOW,
  })

  // ==================== DEPARTAMENTO MANTENIMIENTO ELÉCTRICO ====================
  const fallaElectrico = await create({
    name: 'Falla Eléctrica',
    description: 'Fallas en sistema eléctrico',
    level: 1,
    parentId: null,
    departmentId: deptMantenimiento,
    order: 1,
    color: '#EF4444',
  })

  const solicitudElectrico = await create({
    name: 'Solicitud Eléctrica',
    description: 'Solicitudes de instalación o mantenimiento eléctrico',
    level: 1,
    parentId: null,
    departmentId: deptMantenimiento,
    order: 2,
    color: '#3B82F6',
  })

  // Nivel 2 - Fallas Eléctricas
  await create({
    name: 'Sin Energía',
    description: 'Corte de energía eléctrica: corte total o parcial',
    level: 2,
    parentId: fallaElectrico.id,
    departmentId: deptMantenimiento,
    order: 1,
    color: '#EF4444',
    // Un corte de energía en un centro comercial es crítico.
    priorityCeiling: TicketPriority.URGENT,
  })

  await create({
    name: 'Iluminación',
    description: 'Fallas en luces, focos, luminarias: foco fundido, luz intermitente',
    level: 2,
    parentId: fallaElectrico.id,
    departmentId: deptMantenimiento,
    order: 2,
    color: '#EF4444',
    priorityCeiling: TicketPriority.MEDIUM,
  })

  await create({
    name: 'Tomacorrientes e Interruptores',
    description: 'Fallas en enchufes, tomacorrientes, interruptores',
    level: 2,
    parentId: fallaElectrico.id,
    departmentId: deptMantenimiento,
    order: 3,
    color: '#EF4444',
    // Riesgo eléctrico/incendio.
    priorityCeiling: TicketPriority.HIGH,
  })

  await create({
    name: 'Tableros Eléctricos',
    description: 'Fallas en tableros, breakers, fusibles',
    level: 2,
    parentId: fallaElectrico.id,
    departmentId: deptMantenimiento,
    order: 4,
    color: '#EF4444',
    priorityCeiling: TicketPriority.HIGH,
  })

  // Nivel 2 - Solicitudes Eléctricas
  await create({
    name: 'Instalación',
    description: 'Instalación eléctrica nueva',
    level: 2,
    parentId: solicitudElectrico.id,
    departmentId: deptMantenimiento,
    order: 1,
    color: '#3B82F6',
    priorityCeiling: TicketPriority.LOW,
  })

  await create({
    name: 'Mantenimiento Preventivo',
    description: 'Mantenimiento preventivo eléctrico',
    level: 2,
    parentId: solicitudElectrico.id,
    departmentId: deptMantenimiento,
    order: 2,
    color: '#3B82F6',
    priorityCeiling: TicketPriority.LOW,
  })

  // ==================== DEPARTAMENTO MANTENIMIENTO MECÁNICO ====================
  const fallaMecanico = await create({
    name: 'Falla Mecánica',
    description: 'Fallas en equipos mecánicos',
    level: 1,
    parentId: null,
    departmentId: deptMantenimiento,
    order: 1,
    color: '#EF4444',
  })

  const solicitudMecanico = await create({
    name: 'Solicitud Mecánica',
    description: 'Solicitudes de mantenimiento mecánico',
    level: 1,
    parentId: null,
    departmentId: deptMantenimiento,
    order: 2,
    color: '#3B82F6',
  })

  // Nivel 2 - Fallas Mecánicas
  await create({
    name: 'Ascensores y Montacargas',
    description:
      'Fallas en ascensores, montacargas: atascado entre pisos, puertas no abren o cierran, ruido o vibración anormal',
    level: 2,
    parentId: fallaMecanico.id,
    departmentId: deptMantenimiento,
    order: 1,
    color: '#EF4444',
    // Puede haber gente atrapada — emergencia real.
    priorityCeiling: TicketPriority.URGENT,
  })

  await create({
    name: 'Escaleras Eléctricas',
    description: 'Fallas en escaleras eléctricas',
    level: 2,
    parentId: fallaMecanico.id,
    departmentId: deptMantenimiento,
    order: 2,
    color: '#EF4444',
    priorityCeiling: TicketPriority.HIGH,
  })

  await create({
    name: 'Equipos Mecánicos',
    description: 'Fallas en bombas, compresores, motores',
    level: 2,
    parentId: fallaMecanico.id,
    departmentId: deptMantenimiento,
    order: 3,
    color: '#EF4444',
    priorityCeiling: TicketPriority.HIGH,
  })

  // Nivel 2 - Solicitudes Mecánicas
  await create({
    name: 'Mantenimiento Preventivo',
    description: 'Mantenimiento preventivo de equipos',
    level: 2,
    parentId: solicitudMecanico.id,
    departmentId: deptMantenimiento,
    order: 1,
    color: '#3B82F6',
    priorityCeiling: TicketPriority.LOW,
  })

  await create({
    name: 'Reparación de Equipos',
    description: 'Reparación de equipos mecánicos',
    level: 2,
    parentId: solicitudMecanico.id,
    departmentId: deptMantenimiento,
    order: 2,
    color: '#3B82F6',
    priorityCeiling: TicketPriority.LOW,
  })

  // ==================== INFRAESTRUCTURA (agua, gas, HVAC, drenaje) ====================
  const fallaInfra = await create({
    name: 'Falla de Infraestructura',
    description: 'Fallas en infraestructura (agua, gas, HVAC, drenaje, estacionamiento)',
    level: 1,
    parentId: null,
    departmentId: deptMantenimiento,
    order: 10,
    color: '#EF4444',
  })

  // Nivel 2 - Fallas Infraestructura
  await create({
    name: 'Agua Sanitaria',
    description:
      'Fallas en tuberías, tanques, bombas: fuga de agua, bomba de agua no funciona, problema con tanque de agua',
    level: 2,
    parentId: fallaInfra.id,
    departmentId: deptMantenimiento,
    order: 1,
    color: '#EF4444',
    priorityCeiling: TicketPriority.HIGH,
  })

  await create({
    name: 'Drenaje y Alcantarillado',
    description:
      'Fallas en drenaje, cloacas, sumideros: desagüe o cloaca obstruida, sumidero tapado con residuos',
    level: 2,
    parentId: fallaInfra.id,
    departmentId: deptMantenimiento,
    order: 2,
    color: '#EF4444',
    priorityCeiling: TicketPriority.HIGH,
  })

  await create({
    name: 'Gas Natural',
    description: 'Fugas o problemas con gas: fuga de gas (emergencia), olor a gas',
    level: 2,
    parentId: fallaInfra.id,
    departmentId: deptMantenimiento,
    order: 3,
    color: '#EF4444',
    priorityCeiling: TicketPriority.URGENT,
  })

  await create({
    name: 'Aire Acondicionado y Ventilación',
    description:
      'Fallas en HVAC, unidades de AC, ventilación: no enfría, fuga de refrigerante, ventilación insuficiente o ruidos anormales',
    level: 2,
    parentId: fallaInfra.id,
    departmentId: deptMantenimiento,
    order: 4,
    color: '#EF4444',
    priorityCeiling: TicketPriority.MEDIUM,
  })

  await create({
    name: 'Estacionamiento',
    description:
      'Fallas en estacionamiento, barreras, sensores: barrera no funciona, sensor de detección de vehículo defectuoso, piso dañado o con marcas de aceite',
    level: 2,
    parentId: fallaInfra.id,
    departmentId: deptMantenimiento,
    order: 5,
    color: '#EF4444',
    priorityCeiling: TicketPriority.MEDIUM,
  })

  // ==================== RETIRO DE LAS CATEGORÍAS DE SÍNTOMA (nivel 3) ====================
  // isActive:false conserva el historial de cualquier ticket que ya las use.
  const oldCategories = await prisma.categories.findMany({
    where: { departmentId: deptMantenimiento, isActive: true, id: { notIn: currentIds } },
    select: { id: true },
  })
  if (oldCategories.length > 0) {
    await prisma.categories.updateMany({
      where: { id: { in: oldCategories.map(c => c.id) } },
      data: { isActive: false, updatedAt: new Date() },
    })
  }

  console.log(
    `✅ Categorías OPERATIONS — Mantenimiento: ${currentIds.length} vigentes, ${oldCategories.length} retiradas`
  )
}
