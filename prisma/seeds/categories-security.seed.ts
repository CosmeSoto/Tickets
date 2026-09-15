/**
 * Seed: Categorías para Familia OPERACIONES — Seguridad
 *
 * Categorías completas para centro comercial: seguridad física, CCTV, control de acceso.
 *
 * Mismo criterio aplicado a Mantenimiento/Arquitectura/Comercial: se mantiene el nivel
 * 1/2 (agrupa por tipo de incidente/solicitud real, que determina a qué guardia o
 * técnico se asigna) y se elimina el nivel 3 de síntoma (ej. "Intruso Detectado"/
 * "Pase Falsificado" bajo "Acceso No Autorizado"), plegando su texto en la
 * descripción de la categoría de nivel 2, que pasa a ser la hoja seleccionable.
 *
 * Las hojas resultantes llevan `priorityCeiling`: URGENT en emergencias reales
 * (incendio, evacuación, emergencia médica, persona desaparecida — puede ser un
 * menor), HIGH en incidentes de seguridad con riesgo real (acceso no autorizado,
 * robo, altercado, falla de control de acceso), MEDIUM/LOW en solicitudes rutinarias
 * y fallas de CCTV que no son una emergencia inmediata.
 */

import { PrismaClient, TicketPriority } from '@prisma/client'
import { upsertCategory, type CategorySeedData } from './category-upsert'

export async function seedCategoriesSecurity(prisma: PrismaClient, deptMap: Map<string, string>) {
  const deptSeguridadFisica = deptMap.get('Seguridad Física')
  const deptCctv = deptMap.get('CCTV y Control de Accesos')

  if (!deptSeguridadFisica || !deptCctv) {
    console.log('⚠️  Departamentos de Operaciones (Seguridad) no encontrados, saltando seed...')
    return
  }

  const currentIds: string[] = []
  async function create(data: CategorySeedData) {
    const category = await upsertCategory(prisma, data)
    currentIds.push(category.id)
    return category
  }

  // ==================== DEPARTAMENTO SEGURIDAD FÍSICA ====================
  const incidenteSeguridad = await create({
    name: 'Incidente de Seguridad',
    description: 'Incidentes de seguridad física',
    level: 1,
    parentId: null,
    departmentId: deptSeguridadFisica,
    order: 1,
    color: '#EF4444',
  })

  const solicitudSeguridad = await create({
    name: 'Solicitud de Seguridad',
    description: 'Solicitudes al área de seguridad',
    level: 1,
    parentId: null,
    departmentId: deptSeguridadFisica,
    order: 2,
    color: '#3B82F6',
  })

  const emergencia = await create({
    name: 'Emergencia',
    description: 'Emergencias que requieren atención inmediata',
    level: 1,
    parentId: null,
    departmentId: deptSeguridadFisica,
    order: 3,
    color: '#DC2626',
  })

  // Nivel 2 - Incidentes de Seguridad (hojas: absorben los síntomas que antes eran nivel 3)
  await create({
    name: 'Acceso No Autorizado',
    description:
      'Persona no autorizada en área restringida: intruso detectado, pase o credencial falsificado',
    level: 2,
    parentId: incidenteSeguridad.id,
    departmentId: deptSeguridadFisica,
    order: 1,
    color: '#EF4444',
    priorityCeiling: TicketPriority.HIGH,
  })

  await create({
    name: 'Robo o Hurto',
    description: 'Robo o hurto de bienes: mercancía o pertenencias de visitantes/personal',
    level: 2,
    parentId: incidenteSeguridad.id,
    departmentId: deptSeguridadFisica,
    order: 2,
    color: '#EF4444',
    priorityCeiling: TicketPriority.HIGH,
  })

  await create({
    name: 'Vandalismo',
    description: 'Daños intencionales a la propiedad',
    level: 2,
    parentId: incidenteSeguridad.id,
    departmentId: deptSeguridadFisica,
    order: 3,
    color: '#EF4444',
    priorityCeiling: TicketPriority.MEDIUM,
  })

  await create({
    name: 'Altercado o Pelea',
    description: 'Conflicto físico o verbal entre personas',
    level: 2,
    parentId: incidenteSeguridad.id,
    departmentId: deptSeguridadFisica,
    order: 4,
    color: '#EF4444',
    priorityCeiling: TicketPriority.HIGH,
  })

  await create({
    name: 'Persona Desaparecida',
    description: 'Menor o persona perdida en las instalaciones',
    level: 2,
    parentId: incidenteSeguridad.id,
    departmentId: deptSeguridadFisica,
    order: 5,
    color: '#EF4444',
    // Puede tratarse de un menor perdido — atención inmediata.
    priorityCeiling: TicketPriority.URGENT,
  })

  // Nivel 2 - Solicitudes de Seguridad
  await create({
    name: 'Acompañamiento',
    description: 'Solicitud de acompañamiento de seguridad',
    level: 2,
    parentId: solicitudSeguridad.id,
    departmentId: deptSeguridadFisica,
    order: 1,
    color: '#3B82F6',
    priorityCeiling: TicketPriority.LOW,
  })

  await create({
    name: 'Acceso a Área Restringida',
    description: 'Solicitud de acceso a área restringida',
    level: 2,
    parentId: solicitudSeguridad.id,
    departmentId: deptSeguridadFisica,
    order: 2,
    color: '#3B82F6',
    priorityCeiling: TicketPriority.LOW,
  })

  await create({
    name: 'Credencial o Carnet',
    description: 'Solicitud de credencial o carnet de acceso',
    level: 2,
    parentId: solicitudSeguridad.id,
    departmentId: deptSeguridadFisica,
    order: 3,
    color: '#3B82F6',
    priorityCeiling: TicketPriority.LOW,
  })

  await create({
    name: 'Revisión de Cámaras',
    description: 'Solicitud de revisión de grabaciones',
    level: 2,
    parentId: solicitudSeguridad.id,
    departmentId: deptSeguridadFisica,
    order: 4,
    color: '#3B82F6',
    priorityCeiling: TicketPriority.LOW,
  })

  // Nivel 2 - Emergencias
  await create({
    name: 'Incendio',
    description: 'Incendio o principio de incendio',
    level: 2,
    parentId: emergencia.id,
    departmentId: deptSeguridadFisica,
    order: 1,
    color: '#DC2626',
    priorityCeiling: TicketPriority.URGENT,
  })

  await create({
    name: 'Evacuación',
    description: 'Necesidad de evacuar el edificio',
    level: 2,
    parentId: emergencia.id,
    departmentId: deptSeguridadFisica,
    order: 2,
    color: '#DC2626',
    priorityCeiling: TicketPriority.URGENT,
  })

  await create({
    name: 'Emergencia Médica',
    description: 'Accidente o problema médico urgente',
    level: 2,
    parentId: emergencia.id,
    departmentId: deptSeguridadFisica,
    order: 3,
    color: '#DC2626',
    priorityCeiling: TicketPriority.URGENT,
  })

  // ==================== DEPARTAMENTO CCTV Y CONTROL DE ACCESO ====================
  const fallaCctv = await create({
    name: 'Falla en CCTV o Control de Acceso',
    description: 'Fallas en equipos de seguridad',
    level: 1,
    parentId: null,
    departmentId: deptCctv,
    order: 1,
    color: '#EF4444',
  })

  const solicitudCctv = await create({
    name: 'Solicitud de CCTV o Acceso',
    description: 'Solicitudes relacionadas con CCTV o control de acceso',
    level: 1,
    parentId: null,
    departmentId: deptCctv,
    order: 2,
    color: '#3B82F6',
  })

  // Nivel 2 - Fallas CCTV
  await create({
    name: 'Cámara No Funciona',
    description: 'Cámara de seguridad fuera de servicio: sin imagen o imagen desenfocada',
    level: 2,
    parentId: fallaCctv.id,
    departmentId: deptCctv,
    order: 1,
    color: '#EF4444',
    priorityCeiling: TicketPriority.MEDIUM,
  })

  await create({
    name: 'Grabación No Disponible',
    description: 'No hay grabación o está corrupta',
    level: 2,
    parentId: fallaCctv.id,
    departmentId: deptCctv,
    order: 2,
    color: '#EF4444',
    priorityCeiling: TicketPriority.MEDIUM,
  })

  await create({
    name: 'Control de Acceso',
    description:
      'Fallas en lectoras, tarjetas, cerraduras: lectora de tarjetas o biometría defectuosa, tarjeta de acceso defectuosa',
    level: 2,
    parentId: fallaCctv.id,
    departmentId: deptCctv,
    order: 3,
    color: '#EF4444',
    // Puede dejar a alguien encerrado o afuera, o abrir un hueco de seguridad.
    priorityCeiling: TicketPriority.HIGH,
  })

  // Nivel 2 - Solicitudes CCTV
  await create({
    name: 'Solicitud de Grabación',
    description: 'Solicitar acceso o copia de grabaciones',
    level: 2,
    parentId: solicitudCctv.id,
    departmentId: deptCctv,
    order: 1,
    color: '#3B82F6',
    priorityCeiling: TicketPriority.LOW,
  })

  await create({
    name: 'Mantenimiento de Equipos',
    description: 'Solicitar mantenimiento de CCTV o control de acceso',
    level: 2,
    parentId: solicitudCctv.id,
    departmentId: deptCctv,
    order: 2,
    color: '#3B82F6',
    priorityCeiling: TicketPriority.LOW,
  })

  // ==================== RETIRO DE LAS CATEGORÍAS DE SÍNTOMA (nivel 3) ====================
  let retired = 0
  for (const deptId of [deptSeguridadFisica, deptCctv]) {
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
    `✅ Categorías OPERATIONS — Seguridad: ${currentIds.length} vigentes, ${retired} retiradas`
  )
}
