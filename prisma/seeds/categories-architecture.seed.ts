/**
 * Seed: Categorías para Familia ARQUITECTURA (ARCHITECTURE)
 *
 * Corrección sobre la pasada anterior: Arquitectura y Mantenimiento parecían
 * equipos separados con responsabilidades distintas (confirmado con el usuario en
 * su momento), pero el usuario aclaró después la distinción real — Arquitectura
 * NO ejecuta trabajo físico: solo diseña planos, hace verificaciones y da
 * asesoría técnica. El esfuerzo físico (repararlo de verdad) siempre es de
 * Mantenimiento, sea cual sea el área del edificio (un local comercial, una
 * zona común o la fachada). Por eso la rama "Falla o Daño" que existía aquí
 * (Estructuras, Locales Comerciales, Zonas Comunes, Sanitarios, Fachada y
 * Exterior) se elimina por completo — duplicaba trabajo que ya hace
 * Mantenimiento (grietas, filtraciones, fugas, ascensores...) bajo un
 * departamento que nunca lo ejecuta. Se verificó que esa rama no tenía ningún
 * ticket antes de retirarla. Su vocabulario de síntomas se trasladó a las
 * descripciones de las categorías civiles de Mantenimiento
 * (categories-maintenance.seed.ts: Pisos y Paredes, Puertas y Ventanas,
 * Plomería y Sanitarios, Techos y Cubiertas, Iluminación) para no perder
 * precisión de sugerencia.
 *
 * Arquitectura queda con lo que sí hace: "Solicitud o Requerimiento" (obras,
 * remodelaciones, mobiliario, pintura, señalización — trabajo que sí diseña/
 * coordina, aunque la ejecución física de pintura o instalación pueda
 * tercerizarse o coordinarse con Mantenimiento) y "Consulta o Asesoría"
 * (planos, verificaciones técnicas o estructurales, asesoría).
 */

import { PrismaClient, TicketPriority } from '@prisma/client'
import { upsertCategory, type CategorySeedData } from './category-upsert'

export async function seedCategoriesArchitecture(
  prisma: PrismaClient,
  deptMap: Map<string, string>
) {
  const deptArquitectura = deptMap.get('Arquitectura')

  if (!deptArquitectura) {
    console.log('⚠️  Departamento Arquitectura no encontrado, saltando seed...')
    return
  }

  const currentIds: string[] = []
  async function create(data: CategorySeedData) {
    const category = await upsertCategory(prisma, data)
    currentIds.push(category.id)
    return category
  }

  // ==================== DEPARTAMENTO ARQUITECTURA ====================
  const solicitudArquitectura = await create({
    name: 'Solicitud o Requerimiento',
    description: 'Solicitudes de obras, remodelaciones y adecuaciones',
    level: 1,
    parentId: null,
    departmentId: deptArquitectura,
    order: 1,
    color: '#3B82F6',
  })

  await create({
    name: 'Consulta o Asesoría',
    description:
      'Consultas y asesorías técnicas: elaboración o revisión de planos, verificación técnica o estructural, asesoría de diseño previa a una obra o remodelación',
    level: 1,
    parentId: null,
    departmentId: deptArquitectura,
    order: 2,
    color: '#10B981',
    priorityCeiling: TicketPriority.LOW,
  })

  // Nivel 2 - Solicitudes Arquitectura
  await create({
    name: 'Remodelación o Adecuación',
    description:
      'Solicitudes de remodelación: modificar distribución de local, instalar paneles o divisiones, adecuar zona para nuevo uso',
    level: 2,
    parentId: solicitudArquitectura.id,
    departmentId: deptArquitectura,
    order: 1,
    color: '#3B82F6',
    priorityCeiling: TicketPriority.LOW,
  })

  await create({
    name: 'Instalación de Mobiliario',
    description: 'Instalación de muebles, estantes, divisiones',
    level: 2,
    parentId: solicitudArquitectura.id,
    departmentId: deptArquitectura,
    order: 2,
    color: '#3B82F6',
    priorityCeiling: TicketPriority.LOW,
  })

  await create({
    name: 'Pintura y Acabados',
    description: 'Trabajos de pintura',
    level: 2,
    parentId: solicitudArquitectura.id,
    departmentId: deptArquitectura,
    order: 3,
    color: '#3B82F6',
    priorityCeiling: TicketPriority.LOW,
  })

  await create({
    name: 'Señalización',
    description: 'Instalación o cambio de señalización',
    level: 2,
    parentId: solicitudArquitectura.id,
    departmentId: deptArquitectura,
    order: 4,
    color: '#3B82F6',
    priorityCeiling: TicketPriority.LOW,
  })

  // ==================== RETIRO DE CATEGORÍAS VIEJAS ====================
  // Incluye tanto los viejos niveles 3 de síntoma como, en esta pasada, toda
  // la rama "Falla o Daño" completa (ver comentario del archivo).
  const oldCategories = await prisma.categories.findMany({
    where: { departmentId: deptArquitectura, isActive: true, id: { notIn: currentIds } },
    select: { id: true },
  })
  if (oldCategories.length > 0) {
    await prisma.categories.updateMany({
      where: { id: { in: oldCategories.map(c => c.id) } },
      data: { isActive: false, updatedAt: new Date() },
    })
  }

  console.log(
    `✅ Categorías ARCHITECTURE (Arquitectura): ${currentIds.length} vigentes, ${oldCategories.length} retiradas`
  )
}
