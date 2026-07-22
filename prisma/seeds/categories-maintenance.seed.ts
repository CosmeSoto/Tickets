/**
 * Seed: Categorías para Familia OPERACIONES — Mantenimiento
 *
 * Categorías completas para centro comercial: mantenimiento civil, eléctrico, mecánico.
 */

import { PrismaClient } from '@prisma/client'
import { upsertCategory } from './category-upsert'

export async function seedCategoriesMaintenance(
  prisma: PrismaClient,
  deptMap: Map<string, string>
) {
  const deptMantenimiento = deptMap.get('Mantenimiento')

  if (!deptMantenimiento) {
    console.log('⚠️  Departamento Mantenimiento no encontrado, saltando seed...')
    return
  }

  // ==================== DEPARTAMENTO MANTENIMIENTO CIVIL ====================
  const fallaCivil = await upsertCategory(prisma, {
    name: 'Falla o Daño',
    description: 'Daño o desperfecto civil',
    level: 1,
    parentId: null,
    departmentId: deptMantenimiento,
    order: 1,
    color: '#EF4444',
  })

  const solicitudCivil = await upsertCategory(prisma, {
    name: 'Solicitud de Mantenimiento',
    description: 'Solicitudes de mantenimiento preventivo o correctivo',
    level: 1,
    parentId: null,
    departmentId: deptMantenimiento,
    order: 2,
    color: '#3B82F6',
  })

  // Nivel 2 - Fallas Civiles
  const pisosParedes = await upsertCategory(prisma, {
    name: 'Pisos y Paredes',
    description: 'Daños en pisos, baldosas, revestimientos',
    level: 2,
    parentId: fallaCivil.id,
    departmentId: deptMantenimiento,
    order: 1,
    color: '#EF4444',
  })

  const puertasVentanas = await upsertCategory(prisma, {
    name: 'Puertas y Ventanas',
    description: 'Daños en puertas, ventanas, cerraduras',
    level: 2,
    parentId: fallaCivil.id,
    departmentId: deptMantenimiento,
    order: 2,
    color: '#EF4444',
  })

  const sanitariosCivil = await upsertCategory(prisma, {
    name: 'Plomería y Sanitarios',
    description: 'Fallas en plomería, tuberías, sanitarios',
    level: 2,
    parentId: fallaCivil.id,
    departmentId: deptMantenimiento,
    order: 3,
    color: '#EF4444',
  })

  const techosCubiertas = await upsertCategory(prisma, {
    name: 'Techos y Cubiertas',
    description: 'Goteras, filtraciones, daños en techos',
    level: 2,
    parentId: fallaCivil.id,
    departmentId: deptMantenimiento,
    order: 4,
    color: '#EF4444',
  })

  // Nivel 3 - Fallas Pisos y Paredes
  await upsertCategory(prisma, {
    name: 'Baldosa Rota',
    description: 'Baldosa de piso rota o suelta',
    level: 3,
    parentId: pisosParedes.id,
    departmentId: deptMantenimiento,
    order: 1,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Grieta en Pared',
    description: 'Grieta o fisura en pared',
    level: 3,
    parentId: pisosParedes.id,
    departmentId: deptMantenimiento,
    order: 2,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Desprendimiento de Revestimiento',
    description: 'Revestimiento o pintura desprendida',
    level: 3,
    parentId: pisosParedes.id,
    departmentId: deptMantenimiento,
    order: 3,
    color: '#EF4444',
  })

  // Nivel 3 - Fallas Puertas y Ventanas
  await upsertCategory(prisma, {
    name: 'Cerradura Defectuosa',
    description: 'Cerradura no funciona',
    level: 3,
    parentId: puertasVentanas.id,
    departmentId: deptMantenimiento,
    order: 1,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Bisagra Rota',
    description: 'Bisagra dañada o ruidosa',
    level: 3,
    parentId: puertasVentanas.id,
    departmentId: deptMantenimiento,
    order: 2,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Vidrio Roto',
    description: 'Vidrio de ventana o puerta roto',
    level: 3,
    parentId: puertasVentanas.id,
    departmentId: deptMantenimiento,
    order: 3,
    color: '#EF4444',
  })

  // Nivel 3 - Fallas Plomería
  await upsertCategory(prisma, {
    name: 'Fuga de Agua',
    description: 'Fuga en tubería o conexión',
    level: 3,
    parentId: sanitariosCivil.id,
    departmentId: deptMantenimiento,
    order: 1,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Desagüe Obstruido',
    description: 'Desagüe tapado',
    level: 3,
    parentId: sanitariosCivil.id,
    departmentId: deptMantenimiento,
    order: 2,
    color: '#EF4444',
  })

  // Nivel 2 - Solicitudes Civiles
  const mantenimientoPreventivo = await upsertCategory(prisma, {
    name: 'Mantenimiento Preventivo',
    description: 'Solicitudes de mantenimiento programado',
    level: 2,
    parentId: solicitudCivil.id,
    departmentId: deptMantenimiento,
    order: 1,
    color: '#3B82F6',
  })

  const reparacion = await upsertCategory(prisma, {
    name: 'Reparación',
    description: 'Solicitudes de reparación',
    level: 2,
    parentId: solicitudCivil.id,
    departmentId: deptMantenimiento,
    order: 2,
    color: '#3B82F6',
  })

  const pinturaCivil = await upsertCategory(prisma, {
    name: 'Pintura',
    description: 'Solicitudes de pintura',
    level: 2,
    parentId: solicitudCivil.id,
    departmentId: deptMantenimiento,
    order: 3,
    color: '#3B82F6',
  })

  // ==================== DEPARTAMENTO MANTENIMIENTO ELÉCTRICO ====================
  const fallaElectrico = await upsertCategory(prisma, {
    name: 'Falla Eléctrica',
    description: 'Fallas en sistema eléctrico',
    level: 1,
    parentId: null,
    departmentId: deptMantenimiento,
    order: 1,
    color: '#EF4444',
  })

  const solicitudElectrico = await upsertCategory(prisma, {
    name: 'Solicitud Eléctrica',
    description: 'Solicitudes de instalación o mantenimiento eléctrico',
    level: 1,
    parentId: null,
    departmentId: deptMantenimiento,
    order: 2,
    color: '#3B82F6',
  })

  // Nivel 2 - Fallas Eléctricas
  const sinEnergia = await upsertCategory(prisma, {
    name: 'Sin Energía',
    description: 'Corte de energía eléctrica',
    level: 2,
    parentId: fallaElectrico.id,
    departmentId: deptMantenimiento,
    order: 1,
    color: '#EF4444',
  })

  const iluminacion = await upsertCategory(prisma, {
    name: 'Iluminación',
    description: 'Fallas en luces, focos, luminarias',
    level: 2,
    parentId: fallaElectrico.id,
    departmentId: deptMantenimiento,
    order: 2,
    color: '#EF4444',
  })

  const tomacorrientes = await upsertCategory(prisma, {
    name: 'Tomacorrientes e Interruptores',
    description: 'Fallas en enchufes, tomacorrientes, interruptores',
    level: 2,
    parentId: fallaElectrico.id,
    departmentId: deptMantenimiento,
    order: 3,
    color: '#EF4444',
  })

  const tableros = await upsertCategory(prisma, {
    name: 'Tableros Eléctricos',
    description: 'Fallas en tableros, breakers, fusibles',
    level: 2,
    parentId: fallaElectrico.id,
    departmentId: deptMantenimiento,
    order: 4,
    color: '#EF4444',
  })

  // Nivel 3 - Fallas Sin Energía
  await upsertCategory(prisma, {
    name: 'Corte Total',
    description: 'Corte total de energía',
    level: 3,
    parentId: sinEnergia.id,
    departmentId: deptMantenimiento,
    order: 1,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Corte Parcial',
    description: 'Corte parcial de energía',
    level: 3,
    parentId: sinEnergia.id,
    departmentId: deptMantenimiento,
    order: 2,
    color: '#EF4444',
  })

  // Nivel 3 - Fallas Iluminación
  await upsertCategory(prisma, {
    name: 'Foco Fundido',
    description: 'Foco o luminaria fundida',
    level: 3,
    parentId: iluminacion.id,
    departmentId: deptMantenimiento,
    order: 1,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Luz Intermitente',
    description: 'Luz parpadea o es intermitente',
    level: 3,
    parentId: iluminacion.id,
    departmentId: deptMantenimiento,
    order: 2,
    color: '#EF4444',
  })

  // Nivel 2 - Solicitudes Eléctricas
  const instalacionElectrica = await upsertCategory(prisma, {
    name: 'Instalación',
    description: 'Instalación eléctrica nueva',
    level: 2,
    parentId: solicitudElectrico.id,
    departmentId: deptMantenimiento,
    order: 1,
    color: '#3B82F6',
  })

  const mantenimientoElectrico = await upsertCategory(prisma, {
    name: 'Mantenimiento Preventivo',
    description: 'Mantenimiento preventivo eléctrico',
    level: 2,
    parentId: solicitudElectrico.id,
    departmentId: deptMantenimiento,
    order: 2,
    color: '#3B82F6',
  })

  // ==================== DEPARTAMENTO MANTENIMIENTO MECÁNICO ====================
  const fallaMecanico = await upsertCategory(prisma, {
    name: 'Falla Mecánica',
    description: 'Fallas en equipos mecánicos',
    level: 1,
    parentId: null,
    departmentId: deptMantenimiento,
    order: 1,
    color: '#EF4444',
  })

  const solicitudMecanico = await upsertCategory(prisma, {
    name: 'Solicitud Mecánica',
    description: 'Solicitudes de mantenimiento mecánico',
    level: 1,
    parentId: null,
    departmentId: deptMantenimiento,
    order: 2,
    color: '#3B82F6',
  })

  // Nivel 2 - Fallas Mecánicas
  const ascensores = await upsertCategory(prisma, {
    name: 'Ascensores y Montacargas',
    description: 'Fallas en ascensores, montacargas',
    level: 2,
    parentId: fallaMecanico.id,
    departmentId: deptMantenimiento,
    order: 1,
    color: '#EF4444',
  })

  const escalerasElectricas = await upsertCategory(prisma, {
    name: 'Escaleras Eléctricas',
    description: 'Fallas en escaleras eléctricas',
    level: 2,
    parentId: fallaMecanico.id,
    departmentId: deptMantenimiento,
    order: 2,
    color: '#EF4444',
  })

  const equiposMecanicos = await upsertCategory(prisma, {
    name: 'Equipos Mecánicos',
    description: 'Fallas en bombas, compresores, motores',
    level: 2,
    parentId: fallaMecanico.id,
    departmentId: deptMantenimiento,
    order: 3,
    color: '#EF4444',
  })

  // Nivel 3 - Fallas Ascensores
  await upsertCategory(prisma, {
    name: 'Ascensor Atascado',
    description: 'Ascensor atascado entre pisos',
    level: 3,
    parentId: ascensores.id,
    departmentId: deptMantenimiento,
    order: 1,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Puertas de Ascensor',
    description: 'Puertas no abren o cierran',
    level: 3,
    parentId: ascensores.id,
    departmentId: deptMantenimiento,
    order: 2,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Ruido Anormal',
    description: 'Ruido o vibración anormal',
    level: 3,
    parentId: ascensores.id,
    departmentId: deptMantenimiento,
    order: 3,
    color: '#EF4444',
  })

  // Nivel 2 - Solicitudes Mecánicas
  const mantenimientoMecanico = await upsertCategory(prisma, {
    name: 'Mantenimiento Preventivo',
    description: 'Mantenimiento preventivo de equipos',
    level: 2,
    parentId: solicitudMecanico.id,
    departmentId: deptMantenimiento,
    order: 1,
    color: '#3B82F6',
  })

  const reparacionMecanica = await upsertCategory(prisma, {
    name: 'Reparación de Equipos',
    description: 'Reparación de equipos mecánicos',
    level: 2,
    parentId: solicitudMecanico.id,
    departmentId: deptMantenimiento,
    order: 2,
    color: '#3B82F6',
  })

  // ==================== INFRAESTRUCTURA (agua, gas, HVAC, drenaje) ====================
  const fallaInfra = await upsertCategory(prisma, {
    name: 'Falla de Infraestructura',
    description: 'Fallas en infraestructura (agua, gas, HVAC, drenaje, estacionamiento)',
    level: 1,
    parentId: null,
    departmentId: deptMantenimiento,
    order: 10,
    color: '#EF4444',
  })

  // Nivel 2 - Fallas Infraestructura
  const aguaSanitaria = await upsertCategory(prisma, {
    name: 'Agua Sanitaria',
    description: 'Fallas en tuberías, tanques, bombas',
    level: 2,
    parentId: fallaInfra.id,
    departmentId: deptMantenimiento,
    order: 1,
    color: '#EF4444',
  })

  const drenaje = await upsertCategory(prisma, {
    name: 'Drenaje y Alcantarillado',
    description: 'Fallas en drenaje, cloacas, sumideros',
    level: 2,
    parentId: fallaInfra.id,
    departmentId: deptMantenimiento,
    order: 2,
    color: '#EF4444',
  })

  const gas = await upsertCategory(prisma, {
    name: 'Gas Natural',
    description: 'Fugas o problemas con gas',
    level: 2,
    parentId: fallaInfra.id,
    departmentId: deptMantenimiento,
    order: 3,
    color: '#EF4444',
  })

  const aireAcondicionado = await upsertCategory(prisma, {
    name: 'Aire Acondicionado y Ventilación',
    description: 'Fallas en HVAC, unidades de AC, ventilación',
    level: 2,
    parentId: fallaInfra.id,
    departmentId: deptMantenimiento,
    order: 4,
    color: '#EF4444',
  })

  const estacionamiento = await upsertCategory(prisma, {
    name: 'Estacionamiento',
    description: 'Fallas en estacionamiento, barreras, sensores',
    level: 2,
    parentId: fallaInfra.id,
    departmentId: deptMantenimiento,
    order: 5,
    color: '#EF4444',
  })

  // Nivel 3 - Fallas Agua Sanitaria
  await upsertCategory(prisma, {
    name: 'Fuga de Agua',
    description: 'Fuga en tubería o conexión',
    level: 3,
    parentId: aguaSanitaria.id,
    departmentId: deptMantenimiento,
    order: 1,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Bomba de Agua',
    description: 'Bomba de agua no funciona',
    level: 3,
    parentId: aguaSanitaria.id,
    departmentId: deptMantenimiento,
    order: 2,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Tanque de Agua',
    description: 'Problema con tanque de agua',
    level: 3,
    parentId: aguaSanitaria.id,
    departmentId: deptMantenimiento,
    order: 3,
    color: '#EF4444',
  })

  // Nivel 3 - Fallas Drenaje
  await upsertCategory(prisma, {
    name: 'Desagüe Obstruido',
    description: 'Desagüe o cloaca obstruida',
    level: 3,
    parentId: drenaje.id,
    departmentId: deptMantenimiento,
    order: 1,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Sumidero Tapado',
    description: 'Sumidero tapado con residuos',
    level: 3,
    parentId: drenaje.id,
    departmentId: deptMantenimiento,
    order: 2,
    color: '#EF4444',
  })

  // Nivel 3 - Fallas Gas
  await upsertCategory(prisma, {
    name: 'Fuga de Gas',
    description: 'Fuga de gas - EMERGENCIA',
    level: 3,
    parentId: gas.id,
    departmentId: deptMantenimiento,
    order: 1,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Olor a Gas',
    description: 'Detección de olor a gas',
    level: 3,
    parentId: gas.id,
    departmentId: deptMantenimiento,
    order: 2,
    color: '#EF4444',
  })

  // Nivel 3 - Fallas Aire Acondicionado
  await upsertCategory(prisma, {
    name: 'Unidad de AC No Enfría',
    description: 'Aire acondicionado no enfría',
    level: 3,
    parentId: aireAcondicionado.id,
    departmentId: deptMantenimiento,
    order: 1,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Fuga de Refrigerante',
    description: 'Fuga de gas refrigerante',
    level: 3,
    parentId: aireAcondicionado.id,
    departmentId: deptMantenimiento,
    order: 2,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Ventilación Deficiente',
    description: 'Ventilación insuficiente o ruidos anormales',
    level: 3,
    parentId: aireAcondicionado.id,
    departmentId: deptMantenimiento,
    order: 3,
    color: '#EF4444',
  })

  // Nivel 3 - Fallas Estacionamiento
  await upsertCategory(prisma, {
    name: 'Barrera No Funciona',
    description: 'Barrera de estacionamiento defectuosa',
    level: 3,
    parentId: estacionamiento.id,
    departmentId: deptMantenimiento,
    order: 1,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Sensor de Vehículo',
    description: 'Sensor de detección de vehículo defectuoso',
    level: 3,
    parentId: estacionamiento.id,
    departmentId: deptMantenimiento,
    order: 2,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Piso Estacionamiento',
    description: 'Piso dañado o marcas de aceite',
    level: 3,
    parentId: estacionamiento.id,
    departmentId: deptMantenimiento,
    order: 3,
    color: '#EF4444',
  })

  console.log('✅ Categorías OPERATIONS — Mantenimiento')
}
