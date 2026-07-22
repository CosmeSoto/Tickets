/**
 * Seed: Categorías para Familia ARQUITECTURA (ARCHITECTURE)
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

export async function seedCategoriesArchitecture(
  prisma: PrismaClient,
  deptMap: Map<string, string>
) {
  const deptArquitectura = deptMap.get('Arquitectura')
  const deptMantenimientoInfra = deptMap.get('Mantenimiento')

  if (!deptArquitectura || !deptMantenimientoInfra) {
    console.log('⚠️  Departamentos de ARCHITECTURE/OPERATIONS no encontrados, saltando seed...')
    return
  }

  // ==================== DEPARTAMENTO ARQUITECTURA ====================
  const fallaArquitectura = await upsertCategory(prisma, {
    name: 'Falla o Daño',
    description: 'Daño o desperfecto en infraestructura arquitectónica',
    level: 1,
    parentId: null,
    departmentId: deptArquitectura,
    order: 1,
    color: '#EF4444',
  })

  const solicitudArquitectura = await upsertCategory(prisma, {
    name: 'Solicitud o Requerimiento',
    description: 'Solicitudes de obras, remodelaciones y adecuaciones',
    level: 1,
    parentId: null,
    departmentId: deptArquitectura,
    order: 2,
    color: '#3B82F6',
  })

  const consultaArquitectura = await upsertCategory(prisma, {
    name: 'Consulta o Asesoría',
    description: 'Consultas y asesorías técnicas',
    level: 1,
    parentId: null,
    departmentId: deptArquitectura,
    order: 3,
    color: '#10B981',
  })

  // Nivel 2 - Fallas Arquitectura
  const estructuras = await upsertCategory(prisma, {
    name: 'Estructuras',
    description: 'Fallas en estructuras, muros, columnas, techos',
    level: 2,
    parentId: fallaArquitectura.id,
    departmentId: deptArquitectura,
    order: 1,
    color: '#EF4444',
  })

  const locales = await upsertCategory(prisma, {
    name: 'Locales Comerciales',
    description: 'Fallas en locales, vitrinas, divisiones',
    level: 2,
    parentId: fallaArquitectura.id,
    departmentId: deptArquitectura,
    order: 2,
    color: '#EF4444',
  })

  const zonasComunes = await upsertCategory(prisma, {
    name: 'Zonas Comunes',
    description: 'Fallas en pasillos, escaleras, ascensores',
    level: 2,
    parentId: fallaArquitectura.id,
    departmentId: deptArquitectura,
    order: 3,
    color: '#EF4444',
  })

  const sanitarios = await upsertCategory(prisma, {
    name: 'Sanitarios',
    description: 'Fallas en baños, sanitarios, duchas',
    level: 2,
    parentId: fallaArquitectura.id,
    departmentId: deptArquitectura,
    order: 4,
    color: '#EF4444',
  })

  const fachada = await upsertCategory(prisma, {
    name: 'Fachada y Exterior',
    description: 'Fallas en fachada, letreros, exterior',
    level: 2,
    parentId: fallaArquitectura.id,
    departmentId: deptArquitectura,
    order: 5,
    color: '#EF4444',
  })

  // Nivel 3 - Fallas Estructuras
  await upsertCategory(prisma, {
    name: 'Grietas en Muros',
    description: 'Grietas o fisuras en muros o columnas',
    level: 3,
    parentId: estructuras.id,
    departmentId: deptArquitectura,
    order: 1,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Desprendimiento de Material',
    description: 'Desprendimiento de yeso, pintura o revestimiento',
    level: 3,
    parentId: estructuras.id,
    departmentId: deptArquitectura,
    order: 2,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Filtración en Techo',
    description: 'Goteras o filtraciones en techos o cubiertas',
    level: 3,
    parentId: estructuras.id,
    departmentId: deptArquitectura,
    order: 3,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Daños por Humedad',
    description: 'Humedad, moho o deterioro por agua',
    level: 3,
    parentId: estructuras.id,
    departmentId: deptArquitectura,
    order: 4,
    color: '#EF4444',
  })

  // Nivel 3 - Fallas Locales
  await upsertCategory(prisma, {
    name: 'Daño en Vitrina',
    description: 'Vitrina rota o dañada',
    level: 3,
    parentId: locales.id,
    departmentId: deptArquitectura,
    order: 1,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Problema con Divisiones',
    description: 'Divisiones, paneles o mamparas dañadas',
    level: 3,
    parentId: locales.id,
    departmentId: deptArquitectura,
    order: 2,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Puerta de Local',
    description: 'Puerta, cerradura o bisagra dañada',
    level: 3,
    parentId: locales.id,
    departmentId: deptArquitectura,
    order: 3,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Piso de Local',
    description: 'Piso dañado, baldosas rotas',
    level: 3,
    parentId: locales.id,
    departmentId: deptArquitectura,
    order: 4,
    color: '#EF4444',
  })

  // Nivel 3 - Fallas Zonas Comunes
  await upsertCategory(prisma, {
    name: 'Escaleras Dañadas',
    description: 'Escaleras, barandas o escalones dañados',
    level: 3,
    parentId: zonasComunes.id,
    departmentId: deptArquitectura,
    order: 1,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Piso de Pasillo',
    description: 'Piso de pasillo dañado',
    level: 3,
    parentId: zonasComunes.id,
    departmentId: deptArquitectura,
    order: 2,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Iluminación de Zonas',
    description: 'Luces de pasillos o zonas comunes',
    level: 3,
    parentId: zonasComunes.id,
    departmentId: deptArquitectura,
    order: 3,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Ascensor o Montacargas',
    description: 'Problemas con ascensores o montacargas',
    level: 3,
    parentId: zonasComunes.id,
    departmentId: deptArquitectura,
    order: 4,
    color: '#EF4444',
  })

  // Nivel 3 - Fallas Sanitarios
  await upsertCategory(prisma, {
    name: 'Inodoro con Fuga',
    description: 'Fuga de agua en inodoro',
    level: 3,
    parentId: sanitarios.id,
    departmentId: deptArquitectura,
    order: 1,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Lavabo Obstruido',
    description: 'Lavabo obstruido o con fugas',
    level: 3,
    parentId: sanitarios.id,
    departmentId: deptArquitectura,
    order: 2,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Grifería Dañada',
    description: 'Grifería rota o con fugas',
    level: 3,
    parentId: sanitarios.id,
    departmentId: deptArquitectura,
    order: 3,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Limpieza Urgente',
    description: 'Sanitario requiere limpieza urgente',
    level: 3,
    parentId: sanitarios.id,
    departmentId: deptArquitectura,
    order: 4,
    color: '#EF4444',
  })

  // Nivel 2 - Solicitudes Arquitectura
  const remodelacion = await upsertCategory(prisma, {
    name: 'Remodelación o Adecuación',
    description: 'Solicitudes de remodelación',
    level: 2,
    parentId: solicitudArquitectura.id,
    departmentId: deptArquitectura,
    order: 1,
    color: '#3B82F6',
  })

  const instalacionMobiliario = await upsertCategory(prisma, {
    name: 'Instalación de Mobiliario',
    description: 'Instalación de muebles, estantes, divisiones',
    level: 2,
    parentId: solicitudArquitectura.id,
    departmentId: deptArquitectura,
    order: 2,
    color: '#3B82F6',
  })

  const pintura = await upsertCategory(prisma, {
    name: 'Pintura y Acabados',
    description: 'Trabajos de pintura',
    level: 2,
    parentId: solicitudArquitectura.id,
    departmentId: deptArquitectura,
    order: 3,
    color: '#3B82F6',
  })

  const señalizacion = await upsertCategory(prisma, {
    name: 'Señalización',
    description: 'Instalación o cambio de señalización',
    level: 2,
    parentId: solicitudArquitectura.id,
    departmentId: deptArquitectura,
    order: 4,
    color: '#3B82F6',
  })

  // Nivel 3 - Solicitudes Remodelación
  await upsertCategory(prisma, {
    name: 'Modificación de Local',
    description: 'Modificar distribución de local',
    level: 3,
    parentId: remodelacion.id,
    departmentId: deptArquitectura,
    order: 1,
    color: '#3B82F6',
  })

  await upsertCategory(prisma, {
    name: 'Instalación de Divisiones',
    description: 'Instalar paneles o divisiones',
    level: 3,
    parentId: remodelacion.id,
    departmentId: deptArquitectura,
    order: 2,
    color: '#3B82F6',
  })

  await upsertCategory(prisma, {
    name: 'Adecuación de Zona',
    description: 'Adecuar zona para nuevo uso',
    level: 3,
    parentId: remodelacion.id,
    departmentId: deptArquitectura,
    order: 3,
    color: '#3B82F6',
  })

  // ==================== DEPARTAMENTO MANTENIMIENTO INFRAESTRUCTURA ====================
  const fallaInfra = await upsertCategory(prisma, {
    name: 'Falla o Daño',
    description: 'Fallas en infraestructura del centro comercial',
    level: 1,
    parentId: null,
    departmentId: deptMantenimientoInfra,
    order: 1,
    color: '#EF4444',
  })

  const solicitudInfra = await upsertCategory(prisma, {
    name: 'Solicitud o Requerimiento',
    description: 'Solicitudes de mantenimiento',
    level: 1,
    parentId: null,
    departmentId: deptMantenimientoInfra,
    order: 2,
    color: '#3B82F6',
  })

  // Nivel 2 - Fallas Infraestructura
  const aguaSanitaria = await upsertCategory(prisma, {
    name: 'Agua Sanitaria',
    description: 'Fallas en tuberías, tanques, bombas',
    level: 2,
    parentId: fallaInfra.id,
    departmentId: deptMantenimientoInfra,
    order: 1,
    color: '#EF4444',
  })

  const drenaje = await upsertCategory(prisma, {
    name: 'Drenaje y Alcantarillado',
    description: 'Fallas en drenaje, cloacas, sumideros',
    level: 2,
    parentId: fallaInfra.id,
    departmentId: deptMantenimientoInfra,
    order: 2,
    color: '#EF4444',
  })

  const gas = await upsertCategory(prisma, {
    name: 'Gas Natural',
    description: 'Fugas o problemas con gas',
    level: 2,
    parentId: fallaInfra.id,
    departmentId: deptMantenimientoInfra,
    order: 3,
    color: '#EF4444',
  })

  const aireAcondicionado = await upsertCategory(prisma, {
    name: 'Aire Acondicionado y Ventilación',
    description: 'Fallas en HVAC, unidades de AC, ventilación',
    level: 2,
    parentId: fallaInfra.id,
    departmentId: deptMantenimientoInfra,
    order: 4,
    color: '#EF4444',
  })

  const estacionamiento = await upsertCategory(prisma, {
    name: 'Estacionamiento',
    description: 'Fallas en estacionamiento, barreras, sensores',
    level: 2,
    parentId: fallaInfra.id,
    departmentId: deptMantenimientoInfra,
    order: 5,
    color: '#EF4444',
  })

  // Nivel 3 - Fallas Agua Sanitaria
  await upsertCategory(prisma, {
    name: 'Fuga de Agua',
    description: 'Fuga en tubería o conexión',
    level: 3,
    parentId: aguaSanitaria.id,
    departmentId: deptMantenimientoInfra,
    order: 1,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Bomba de Agua',
    description: 'Bomba de agua no funciona',
    level: 3,
    parentId: aguaSanitaria.id,
    departmentId: deptMantenimientoInfra,
    order: 2,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Tanque de Agua',
    description: 'Problema con tanque de agua',
    level: 3,
    parentId: aguaSanitaria.id,
    departmentId: deptMantenimientoInfra,
    order: 3,
    color: '#EF4444',
  })

  // Nivel 3 - Fallas Drenaje
  await upsertCategory(prisma, {
    name: 'Desagüe Obstruido',
    description: 'Desagüe o cloaca obstruida',
    level: 3,
    parentId: drenaje.id,
    departmentId: deptMantenimientoInfra,
    order: 1,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Sumidero Tapado',
    description: 'Sumidero tapado con residuos',
    level: 3,
    parentId: drenaje.id,
    departmentId: deptMantenimientoInfra,
    order: 2,
    color: '#EF4444',
  })

  // Nivel 3 - Fallas Gas
  await upsertCategory(prisma, {
    name: 'Fuga de Gas',
    description: 'Fuga de gas - EMERGENCIA',
    level: 3,
    parentId: gas.id,
    departmentId: deptMantenimientoInfra,
    order: 1,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Olor a Gas',
    description: 'Detección de olor a gas',
    level: 3,
    parentId: gas.id,
    departmentId: deptMantenimientoInfra,
    order: 2,
    color: '#EF4444',
  })

  // Nivel 3 - Fallas Aire Acondicionado
  await upsertCategory(prisma, {
    name: 'Unidad de AC No Enfría',
    description: 'Aire acondicionado no enfría',
    level: 3,
    parentId: aireAcondicionado.id,
    departmentId: deptMantenimientoInfra,
    order: 1,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Fuga de Refrigerante',
    description: 'Fuga de gas refrigerante',
    level: 3,
    parentId: aireAcondicionado.id,
    departmentId: deptMantenimientoInfra,
    order: 2,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Ventilación Deficiente',
    description: 'Ventilación insuficiente o ruidos anormales',
    level: 3,
    parentId: aireAcondicionado.id,
    departmentId: deptMantenimientoInfra,
    order: 3,
    color: '#EF4444',
  })

  // Nivel 3 - Fallas Estacionamiento
  await upsertCategory(prisma, {
    name: 'Barrera No Funciona',
    description: 'Barrera de estacionamiento defectuosa',
    level: 3,
    parentId: estacionamiento.id,
    departmentId: deptMantenimientoInfra,
    order: 1,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Sensor de Vehículo',
    description: 'Sensor de detección de vehículo defectuoso',
    level: 3,
    parentId: estacionamiento.id,
    departmentId: deptMantenimientoInfra,
    order: 2,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Piso Estacionamiento',
    description: 'Piso dañado o marcas de aceite',
    level: 3,
    parentId: estacionamiento.id,
    departmentId: deptMantenimientoInfra,
    order: 3,
    color: '#EF4444',
  })

  console.log('✅ Categorías ARCHITECTURE (Arquitectura)')
}
