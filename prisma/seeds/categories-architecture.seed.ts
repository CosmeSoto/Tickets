/**
 * Seed: Categorías para Familia ARQUITECTURA (ARCHITECTURE)
 */

import { PrismaClient } from '@prisma/client'
import { upsertCategory } from './category-upsert'

export async function seedCategoriesArchitecture(
  prisma: PrismaClient,
  deptMap: Map<string, string>
) {
  const deptArquitectura = deptMap.get('Arquitectura')

  if (!deptArquitectura) {
    console.log('⚠️  Departamento Arquitectura no encontrado, saltando seed...')
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

  console.log('✅ Categorías ARCHITECTURE (Arquitectura)')
}
