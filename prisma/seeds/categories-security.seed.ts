/**
 * Seed: Categorías para Familia SEGURIDAD (SECURITY)
 *
 * Categorías completas para centro comercial: seguridad física, CCTV, control de acceso.
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

export async function seedCategoriesSecurity(prisma: PrismaClient, deptMap: Map<string, string>) {
  const deptSeguridadFisica = deptMap.get('Seguridad Física')
  const deptCctv = deptMap.get('CCTV y Control de Acceso')

  if (!deptSeguridadFisica || !deptCctv) {
    console.log('⚠️  Departamentos de SECURITY no encontrados, saltando seed...')
    return
  }

  // ==================== DEPARTAMENTO SEGURIDAD FÍSICA ====================
  const incidenteSeguridad = await upsertCategory(prisma, {
    name: 'Incidente de Seguridad',
    description: 'Incidentes de seguridad física',
    level: 1,
    parentId: null,
    departmentId: deptSeguridadFisica,
    order: 1,
    color: '#EF4444',
  })

  const solicitudSeguridad = await upsertCategory(prisma, {
    name: 'Solicitud de Seguridad',
    description: 'Solicitudes al área de seguridad',
    level: 1,
    parentId: null,
    departmentId: deptSeguridadFisica,
    order: 2,
    color: '#3B82F6',
  })

  const emergencia = await upsertCategory(prisma, {
    name: 'Emergencia',
    description: 'Emergencias que requieren atención inmediata',
    level: 1,
    parentId: null,
    departmentId: deptSeguridadFisica,
    order: 3,
    color: '#DC2626',
  })

  // Nivel 2 - Incidentes de Seguridad
  const accesoNoAutorizado = await upsertCategory(prisma, {
    name: 'Acceso No Autorizado',
    description: 'Persona no autorizada en área restringida',
    level: 2,
    parentId: incidenteSeguridad.id,
    departmentId: deptSeguridadFisica,
    order: 1,
    color: '#EF4444',
  })

  const roboHurto = await upsertCategory(prisma, {
    name: 'Robo o Hurto',
    description: 'Robo o hurto de bienes',
    level: 2,
    parentId: incidenteSeguridad.id,
    departmentId: deptSeguridadFisica,
    order: 2,
    color: '#EF4444',
  })

  const vandalismo = await upsertCategory(prisma, {
    name: 'Vandalismo',
    description: 'Daños intencionales a la propiedad',
    level: 2,
    parentId: incidenteSeguridad.id,
    departmentId: deptSeguridadFisica,
    order: 3,
    color: '#EF4444',
  })

  const altercado = await upsertCategory(prisma, {
    name: 'Altercado o Pelea',
    description: 'Conflicto físico o verbal entre personas',
    level: 2,
    parentId: incidenteSeguridad.id,
    departmentId: deptSeguridadFisica,
    order: 4,
    color: '#EF4444',
  })

  const personaDesaparecida = await upsertCategory(prisma, {
    name: 'Persona Desaparecida',
    description: 'Menor o persona perdida en las instalaciones',
    level: 2,
    parentId: incidenteSeguridad.id,
    departmentId: deptSeguridadFisica,
    order: 5,
    color: '#EF4444',
  })

  // Nivel 3 - Acceso No Autorizado
  await upsertCategory(prisma, {
    name: 'Intruso Detectado',
    description: 'Persona sin autorización detectada',
    level: 3,
    parentId: accesoNoAutorizado.id,
    departmentId: deptSeguridadFisica,
    order: 1,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Pase Falsificado',
    description: 'Credencial o pase falsificado',
    level: 3,
    parentId: accesoNoAutorizado.id,
    departmentId: deptSeguridadFisica,
    order: 2,
    color: '#EF4444',
  })

  // Nivel 3 - Robo o Hurto
  await upsertCategory(prisma, {
    name: 'Robo de Mercancía',
    description: 'Hurto de productos o mercancía',
    level: 3,
    parentId: roboHurto.id,
    departmentId: deptSeguridadFisica,
    order: 1,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Robo de Objetos Personales',
    description: 'Hurto de pertenencias de visitantes o personal',
    level: 3,
    parentId: roboHurto.id,
    departmentId: deptSeguridadFisica,
    order: 2,
    color: '#EF4444',
  })

  // Nivel 2 - Solicitudes de Seguridad
  const acompañamiento = await upsertCategory(prisma, {
    name: 'Acompañamiento',
    description: 'Solicitud de acompañamiento de seguridad',
    level: 2,
    parentId: solicitudSeguridad.id,
    departmentId: deptSeguridadFisica,
    order: 1,
    color: '#3B82F6',
  })

  const accesoAreaRestringida = await upsertCategory(prisma, {
    name: 'Acceso a Área Restringida',
    description: 'Solicitud de acceso a área restringida',
    level: 2,
    parentId: solicitudSeguridad.id,
    departmentId: deptSeguridadFisica,
    order: 2,
    color: '#3B82F6',
  })

  const credencial = await upsertCategory(prisma, {
    name: 'Credencial o Carnet',
    description: 'Solicitud de credencial o carnet de acceso',
    level: 2,
    parentId: solicitudSeguridad.id,
    departmentId: deptSeguridadFisica,
    order: 3,
    color: '#3B82F6',
  })

  const revisionCamaras = await upsertCategory(prisma, {
    name: 'Revisión de Cámaras',
    description: 'Solicitud de revisión de grabaciones',
    level: 2,
    parentId: solicitudSeguridad.id,
    departmentId: deptSeguridadFisica,
    order: 4,
    color: '#3B82F6',
  })

  // Nivel 2 - Emergencias
  const incendio = await upsertCategory(prisma, {
    name: 'Incendio',
    description: 'Incendio o principio de incendio',
    level: 2,
    parentId: emergencia.id,
    departmentId: deptSeguridadFisica,
    order: 1,
    color: '#DC2626',
  })

  const evacuacion = await upsertCategory(prisma, {
    name: 'Evacuación',
    description: 'Necesidad de evacuar el edificio',
    level: 2,
    parentId: emergencia.id,
    departmentId: deptSeguridadFisica,
    order: 2,
    color: '#DC2626',
  })

  const emergenciaMedica = await upsertCategory(prisma, {
    name: 'Emergencia Médica',
    description: 'Accidente o problema médico urgente',
    level: 2,
    parentId: emergencia.id,
    departmentId: deptSeguridadFisica,
    order: 3,
    color: '#DC2626',
  })

  // ==================== DEPARTAMENTO CCTV Y CONTROL DE ACCESO ====================
  const fallaCctv = await upsertCategory(prisma, {
    name: 'Falla en CCTV o Control de Acceso',
    description: 'Fallas en equipos de seguridad',
    level: 1,
    parentId: null,
    departmentId: deptCctv,
    order: 1,
    color: '#EF4444',
  })

  const solicitudCctv = await upsertCategory(prisma, {
    name: 'Solicitud de CCTV o Acceso',
    description: 'Solicitudes relacionadas con CCTV o control de acceso',
    level: 1,
    parentId: null,
    departmentId: deptCctv,
    order: 2,
    color: '#3B82F6',
  })

  // Nivel 2 - Fallas CCTV
  const camaraNoFunciona = await upsertCategory(prisma, {
    name: 'Cámara No Funciona',
    description: 'Cámara de seguridad fuera de servicio',
    level: 2,
    parentId: fallaCctv.id,
    departmentId: deptCctv,
    order: 1,
    color: '#EF4444',
  })

  const grabacionNoDisponible = await upsertCategory(prisma, {
    name: 'Grabación No Disponible',
    description: 'No hay grabación o está corrupta',
    level: 2,
    parentId: fallaCctv.id,
    departmentId: deptCctv,
    order: 2,
    color: '#EF4444',
  })

  const controlAcceso = await upsertCategory(prisma, {
    name: 'Control de Acceso',
    description: 'Fallas en lectoras, tarjetas, cerraduras',
    level: 2,
    parentId: fallaCctv.id,
    departmentId: deptCctv,
    order: 3,
    color: '#EF4444',
  })

  // Nivel 3 - Cámara No Funciona
  await upsertCategory(prisma, {
    name: 'Cámara Sin Imagen',
    description: 'Cámara no transmite imagen',
    level: 3,
    parentId: camaraNoFunciona.id,
    departmentId: deptCctv,
    order: 1,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Cámara Desenfocada',
    description: 'Imagen borrosa o desenfocada',
    level: 3,
    parentId: camaraNoFunciona.id,
    departmentId: deptCctv,
    order: 2,
    color: '#EF4444',
  })

  // Nivel 3 - Control de Acceso
  await upsertCategory(prisma, {
    name: 'Lectora No Funciona',
    description: 'Lectora de tarjetas o biometría defectuosa',
    level: 3,
    parentId: controlAcceso.id,
    departmentId: deptCctv,
    order: 1,
    color: '#EF4444',
  })

  await upsertCategory(prisma, {
    name: 'Tarjeta No Funciona',
    description: 'Tarjeta de acceso defectuosa',
    level: 3,
    parentId: controlAcceso.id,
    departmentId: deptCctv,
    order: 2,
    color: '#EF4444',
  })

  // Nivel 2 - Solicitudes CCTV
  const solicitudGrabacion = await upsertCategory(prisma, {
    name: 'Solicitud de Grabación',
    description: 'Solicitar acceso o copia de grabaciones',
    level: 2,
    parentId: solicitudCctv.id,
    departmentId: deptCctv,
    order: 1,
    color: '#3B82F6',
  })

  const mantenimientoCctv = await upsertCategory(prisma, {
    name: 'Mantenimiento de Equipos',
    description: 'Solicitar mantenimiento de CCTV o control de acceso',
    level: 2,
    parentId: solicitudCctv.id,
    departmentId: deptCctv,
    order: 2,
    color: '#3B82F6',
  })

  console.log('✅ Categorías SECURITY (Seguridad)')
}
