/**
 * Seed: Categorías para Familia ARQUITECTURA (ARCHITECTURE)
 *
 * Mismo criterio aplicado a Mantenimiento (categories-maintenance.seed.ts): el nivel
 * 1/2 se mantiene (agrupa por tipo de espacio/trabajo real — Estructuras, Locales
 * Comerciales, Zonas Comunes, Sanitarios, Fachada — que determina a qué técnico se
 * asigna), pero se elimina el nivel 3 de síntoma (ej. "Grietas en Muros"/
 * "Desprendimiento de Material"/"Filtración en Techo"/"Daños por Humedad", las
 * cuatro bajo "Estructuras" y atendidas por el mismo equipo), plegando ese texto en
 * la descripción de la categoría de nivel 2. Arquitectura y Mantenimiento son
 * equipos separados con responsabilidades distintas (confirmado con el usuario) —
 * no se fusionan aunque cubran temas superficialmente similares (ambos atienden
 * fugas de agua o ascensores, por ejemplo, pero en áreas distintas).
 *
 * Las 9 categorías de nivel 2 (ahora hojas) + "Consulta o Asesoría" (nivel 1, ya era
 * hoja) llevan un `priorityCeiling` inicial con el mismo criterio que Mantenimiento:
 * HIGH en fallas con riesgo estructural/de seguridad/agua, MEDIUM en fallas de
 * confort/estética, LOW en todo el lado Solicitud/Consulta.
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
  const fallaArquitectura = await create({
    name: 'Falla o Daño',
    description: 'Daño o desperfecto en infraestructura arquitectónica',
    level: 1,
    parentId: null,
    departmentId: deptArquitectura,
    order: 1,
    color: '#EF4444',
  })

  const solicitudArquitectura = await create({
    name: 'Solicitud o Requerimiento',
    description: 'Solicitudes de obras, remodelaciones y adecuaciones',
    level: 1,
    parentId: null,
    departmentId: deptArquitectura,
    order: 2,
    color: '#3B82F6',
  })

  await create({
    name: 'Consulta o Asesoría',
    description: 'Consultas y asesorías técnicas',
    level: 1,
    parentId: null,
    departmentId: deptArquitectura,
    order: 3,
    color: '#10B981',
    priorityCeiling: TicketPriority.LOW,
  })

  // Nivel 2 - Fallas Arquitectura (hojas: absorben los síntomas que antes eran nivel 3)
  await create({
    name: 'Estructuras',
    description:
      'Fallas en estructuras, muros, columnas, techos: grietas o fisuras en muros o columnas, desprendimiento de yeso, pintura o revestimiento, goteras o filtraciones en techos o cubiertas, humedad o moho por agua',
    level: 2,
    parentId: fallaArquitectura.id,
    departmentId: deptArquitectura,
    order: 1,
    color: '#EF4444',
    priorityCeiling: TicketPriority.HIGH,
  })

  await create({
    name: 'Locales Comerciales',
    description:
      'Fallas en locales, vitrinas, divisiones: vitrina rota o dañada, divisiones/paneles/mamparas dañadas, puerta/cerradura/bisagra dañada, piso dañado o baldosas rotas',
    level: 2,
    parentId: fallaArquitectura.id,
    departmentId: deptArquitectura,
    order: 2,
    color: '#EF4444',
    priorityCeiling: TicketPriority.MEDIUM,
  })

  await create({
    name: 'Zonas Comunes',
    description:
      'Fallas en pasillos, escaleras, ascensores: escaleras/barandas/escalones dañados, piso de pasillo dañado, iluminación de pasillos o zonas comunes, problemas con ascensores o montacargas',
    level: 2,
    parentId: fallaArquitectura.id,
    departmentId: deptArquitectura,
    order: 3,
    color: '#EF4444',
    priorityCeiling: TicketPriority.HIGH,
  })

  await create({
    name: 'Sanitarios',
    description:
      'Fallas en baños, sanitarios, duchas: fuga de agua en inodoro, lavabo obstruido o con fugas, grifería rota o con fugas, sanitario que requiere limpieza urgente',
    level: 2,
    parentId: fallaArquitectura.id,
    departmentId: deptArquitectura,
    order: 4,
    color: '#EF4444',
    priorityCeiling: TicketPriority.HIGH,
  })

  await create({
    name: 'Fachada y Exterior',
    description: 'Fallas en fachada, letreros, exterior',
    level: 2,
    parentId: fallaArquitectura.id,
    departmentId: deptArquitectura,
    order: 5,
    color: '#EF4444',
    priorityCeiling: TicketPriority.MEDIUM,
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

  // ==================== RETIRO DE LAS CATEGORÍAS DE SÍNTOMA (nivel 3) ====================
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
