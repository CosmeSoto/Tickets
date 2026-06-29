/**
 * Seed: Categorías para Familia COMERCIAL Y MARKETING (COMMERCIAL)
 *
 * Categorías completas para centro comercial: comercial, marketing, eventos, activaciones.
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
  },
  counters: { created: number; updated: number }
) {
  const existing = await prisma.categories.findFirst({
    where: { name: data.name, level: data.level, parentId: data.parentId },
  })
  if (existing) {
    counters.updated++
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
  counters.created++
  return prisma.categories.create({
    data: { id: randomUUID(), ...data, isActive: true, createdAt: now, updatedAt: now },
  })
}

export async function seedCategoriesCommercial(prisma: PrismaClient, deptMap: Map<string, string>) {
  const counters = { created: 0, updated: 0 }
  const deptComercial = deptMap.get('Comercial')
  const deptMarketing = deptMap.get('Marketing')
  const deptMediosDigitales = deptMap.get('Medios Digitales')
  const deptDiseno = deptMap.get('Diseño')

  if (!deptComercial && !deptMarketing && !deptMediosDigitales && !deptDiseno) {
    console.log('⚠️  Departamentos de COMMERCIAL/MARKETING no encontrados, saltando seed...')
    return
  }

  const deptPrincipal = deptComercial || deptMarketing || deptMediosDigitales || deptDiseno!

  // ==================== DEPARTAMENTO COMERCIAL/MARKETING ====================
  const solicitudComercial = await upsertCategory(
    prisma,
    {
      name: 'Solicitud Comercial o de Marketing',
      description: 'Solicitudes al área comercial o de marketing',
      level: 1,
      parentId: null,
      departmentId: deptPrincipal,
      order: 1,
      color: '#EC4899',
    },
    counters
  )

  const fallaComercial = await upsertCategory(
    prisma,
    {
      name: 'Falla o Problema Comercial',
      description: 'Incidentes o fallas relacionadas con área comercial',
      level: 1,
      parentId: null,
      departmentId: deptPrincipal,
      order: 2,
      color: '#F43F5E',
    },
    counters
  )

  // Nivel 2 - Solicitudes Comerciales
  const arrendamiento = await upsertCategory(
    prisma,
    {
      name: 'Arrendamiento de Locales',
      description: 'Consultas y solicitudes sobre arrendamiento',
      level: 2,
      parentId: solicitudComercial.id,
      departmentId: deptComercial || deptPrincipal,
      order: 1,
      color: '#EC4899',
    },
    counters
  )

  const eventos = await upsertCategory(
    prisma,
    {
      name: 'Eventos y Activaciones',
      description: 'Solicitudes para eventos o activaciones',
      level: 2,
      parentId: solicitudComercial.id,
      departmentId: deptMarketing || deptPrincipal,
      order: 2,
      color: '#EC4899',
    },
    counters
  )

  const publicidad = await upsertCategory(
    prisma,
    {
      name: 'Publicidad y Promociones',
      description: 'Solicitudes de publicidad o espacios promocionales',
      level: 2,
      parentId: solicitudComercial.id,
      departmentId: deptMarketing || deptPrincipal,
      order: 3,
      color: '#EC4899',
    },
    counters
  )

  const redesSociales = await upsertCategory(
    prisma,
    {
      name: 'Redes Sociales y Contenido',
      description: 'Solicitudes relacionadas con redes sociales',
      level: 2,
      parentId: solicitudComercial.id,
      departmentId: deptMarketing || deptPrincipal,
      order: 4,
      color: '#EC4899',
    },
    counters
  )

  const relacionesLocatarios = await upsertCategory(
    prisma,
    {
      name: 'Relaciones con Locatarios',
      description: 'Solicitudes y consultas de los locales arrendados',
      level: 2,
      parentId: solicitudComercial.id,
      departmentId: deptComercial || deptPrincipal,
      order: 5,
      color: '#EC4899',
    },
    counters
  )

  const activacionesMarca = await upsertCategory(
    prisma,
    {
      name: 'Activaciones de Marca',
      description: 'Solicitudes para activaciones y pop-ups de marcas',
      level: 2,
      parentId: solicitudComercial.id,
      departmentId: deptMarketing || deptPrincipal,
      order: 6,
      color: '#EC4899',
    },
    counters
  )

  // Nivel 2 - Fallas Comerciales
  const problemaArrendamiento = await upsertCategory(
    prisma,
    {
      name: 'Problema con Arrendamiento',
      description: 'Fallas o problemas relacionados con arrendamiento',
      level: 2,
      parentId: fallaComercial.id,
      departmentId: deptComercial || deptPrincipal,
      order: 1,
      color: '#F43F5E',
    },
    counters
  )

  const problemaEvento = await upsertCategory(
    prisma,
    {
      name: 'Problema con Evento',
      description: 'Fallas o incidencias durante eventos',
      level: 2,
      parentId: fallaComercial.id,
      departmentId: deptMarketing || deptPrincipal,
      order: 2,
      color: '#F43F5E',
    },
    counters
  )

  const problemaPublicidad = await upsertCategory(
    prisma,
    {
      name: 'Problema con Publicidad',
      description: 'Fallas o problemas con publicidad',
      level: 2,
      parentId: fallaComercial.id,
      departmentId: deptMarketing || deptPrincipal,
      order: 3,
      color: '#F43F5E',
    },
    counters
  )

  // Nivel 3 - Arrendamiento
  await upsertCategory(
    prisma,
    {
      name: 'Consulta de Disponibilidad',
      description: 'Consultar locales disponibles',
      level: 3,
      parentId: arrendamiento.id,
      departmentId: deptComercial || deptPrincipal,
      order: 1,
      color: '#EC4899',
    },
    counters
  )

  await upsertCategory(
    prisma,
    {
      name: 'Solicitud de Información',
      description: 'Solicitar información de arrendamiento',
      level: 3,
      parentId: arrendamiento.id,
      departmentId: deptComercial || deptPrincipal,
      order: 2,
      color: '#EC4899',
    },
    counters
  )

  await upsertCategory(
    prisma,
    {
      name: 'Solicitud de Visita',
      description: 'Solicitar visita a local disponible',
      level: 3,
      parentId: arrendamiento.id,
      departmentId: deptComercial || deptPrincipal,
      order: 3,
      color: '#EC4899',
    },
    counters
  )

  await upsertCategory(
    prisma,
    {
      name: 'Negociación de Contrato',
      description: 'Negociación de términos de contrato',
      level: 3,
      parentId: arrendamiento.id,
      departmentId: deptComercial || deptPrincipal,
      order: 4,
      color: '#EC4899',
    },
    counters
  )

  await upsertCategory(
    prisma,
    {
      name: 'Renovación de Contrato',
      description: 'Solicitud de renovación de contrato de arrendamiento',
      level: 3,
      parentId: arrendamiento.id,
      departmentId: deptComercial || deptPrincipal,
      order: 5,
      color: '#EC4899',
    },
    counters
  )

  // Nivel 3 - Eventos
  await upsertCategory(
    prisma,
    {
      name: 'Reserva de Espacio',
      description: 'Reservar espacio para evento o activación',
      level: 3,
      parentId: eventos.id,
      departmentId: deptMarketing || deptPrincipal,
      order: 1,
      color: '#EC4899',
    },
    counters
  )

  await upsertCategory(
    prisma,
    {
      name: 'Coordinación de Evento',
      description: 'Coordinar logística de evento',
      level: 3,
      parentId: eventos.id,
      departmentId: deptMarketing || deptPrincipal,
      order: 2,
      color: '#EC4899',
    },
    counters
  )

  await upsertCategory(
    prisma,
    {
      name: 'Solicitud de Permisos',
      description: 'Solicitar permisos para evento',
      level: 3,
      parentId: eventos.id,
      departmentId: deptMarketing || deptPrincipal,
      order: 3,
      color: '#EC4899',
    },
    counters
  )

  await upsertCategory(
    prisma,
    {
      name: 'Evento Temporal',
      description: 'Solicitud para evento temporal (Navidad, San Valentín, etc.)',
      level: 3,
      parentId: eventos.id,
      departmentId: deptMarketing || deptPrincipal,
      order: 4,
      color: '#EC4899',
    },
    counters
  )

  await upsertCategory(
    prisma,
    {
      name: 'Conferencia o Taller',
      description: 'Solicitud para conferencia, taller o capacitación',
      level: 3,
      parentId: eventos.id,
      departmentId: deptMarketing || deptPrincipal,
      order: 5,
      color: '#EC4899',
    },
    counters
  )

  // Nivel 3 - Publicidad
  await upsertCategory(
    prisma,
    {
      name: 'Solicitud de Espacio Publicitario',
      description: 'Solicitar espacio para publicidad',
      level: 3,
      parentId: publicidad.id,
      departmentId: deptMarketing || deptPrincipal,
      order: 1,
      color: '#EC4899',
    },
    counters
  )

  await upsertCategory(
    prisma,
    {
      name: 'Promoción Conjunta',
      description: 'Proponer promoción conjunta',
      level: 3,
      parentId: publicidad.id,
      departmentId: deptMarketing || deptPrincipal,
      order: 2,
      color: '#EC4899',
    },
    counters
  )

  await upsertCategory(
    prisma,
    {
      name: 'Pantallas Digitales',
      description: 'Solicitud de espacio en pantallas digitales',
      level: 3,
      parentId: publicidad.id,
      departmentId: deptMarketing || deptPrincipal,
      order: 3,
      color: '#EC4899',
    },
    counters
  )

  await upsertCategory(
    prisma,
    {
      name: 'Mupi o Cartelería',
      description: 'Solicitud de espacio en mupis o cartelería',
      level: 3,
      parentId: publicidad.id,
      departmentId: deptMarketing || deptPrincipal,
      order: 4,
      color: '#EC4899',
    },
    counters
  )

  await upsertCategory(
    prisma,
    {
      name: 'Folletos y Publicidad Impresa',
      description: 'Solicitud de distribución de folletos o publicidad impresa',
      level: 3,
      parentId: publicidad.id,
      departmentId: deptMarketing || deptPrincipal,
      order: 5,
      color: '#EC4899',
    },
    counters
  )

  await upsertCategory(
    prisma,
    {
      name: 'Patrocinio de Evento',
      description: 'Solicitud de patrocinio de evento del centro',
      level: 3,
      parentId: publicidad.id,
      departmentId: deptMarketing || deptPrincipal,
      order: 6,
      color: '#EC4899',
    },
    counters
  )

  // Nivel 3 - Redes Sociales
  await upsertCategory(
    prisma,
    {
      name: 'Solicitud de Mención',
      description: 'Solicitar mención en redes sociales del centro',
      level: 3,
      parentId: redesSociales.id,
      departmentId: deptMarketing || deptPrincipal,
      order: 1,
      color: '#EC4899',
    },
    counters
  )

  await upsertCategory(
    prisma,
    {
      name: 'Publicación de Contenido',
      description: 'Solicitar publicación de contenido en redes',
      level: 3,
      parentId: redesSociales.id,
      departmentId: deptMarketing || deptPrincipal,
      order: 2,
      color: '#EC4899',
    },
    counters
  )

  await upsertCategory(
    prisma,
    {
      name: 'Colaboración Influencer',
      description: 'Solicitud de colaboración con influencers',
      level: 3,
      parentId: redesSociales.id,
      departmentId: deptMarketing || deptPrincipal,
      order: 3,
      color: '#EC4899',
    },
    counters
  )

  await upsertCategory(
    prisma,
    {
      name: 'Historias o Reels',
      description: 'Solicitud de publicación en Historias o Reels',
      level: 3,
      parentId: redesSociales.id,
      departmentId: deptMarketing || deptPrincipal,
      order: 4,
      color: '#EC4899',
    },
    counters
  )

  // Nivel 3 - Relaciones con Locatarios
  await upsertCategory(
    prisma,
    {
      name: 'Consulta de Facturación',
      description: 'Consulta sobre facturas o pagos',
      level: 3,
      parentId: relacionesLocatarios.id,
      departmentId: deptComercial || deptPrincipal,
      order: 1,
      color: '#EC4899',
    },
    counters
  )

  await upsertCategory(
    prisma,
    {
      name: 'Modificación de Local',
      description: 'Solicitud de modificación o mejora del local',
      level: 3,
      parentId: relacionesLocatarios.id,
      departmentId: deptComercial || deptPrincipal,
      order: 2,
      color: '#EC4899',
    },
    counters
  )

  await upsertCategory(
    prisma,
    {
      name: 'Horario Especial',
      description: 'Solicitud de horario especial para el local',
      level: 3,
      parentId: relacionesLocatarios.id,
      departmentId: deptComercial || deptPrincipal,
      order: 3,
      color: '#EC4899',
    },
    counters
  )

  await upsertCategory(
    prisma,
    {
      name: 'Queja o Reclamo',
      description: 'Queja o reclamo de locatario',
      level: 3,
      parentId: relacionesLocatarios.id,
      departmentId: deptComercial || deptPrincipal,
      order: 4,
      color: '#EC4899',
    },
    counters
  )

  // Nivel 3 - Activaciones de Marca
  await upsertCategory(
    prisma,
    {
      name: 'Pop-Up Store',
      description: 'Solicitud de pop-up store temporal',
      level: 3,
      parentId: activacionesMarca.id,
      departmentId: deptMarketing || deptPrincipal,
      order: 1,
      color: '#EC4899',
    },
    counters
  )

  await upsertCategory(
    prisma,
    {
      name: 'Muestra de Productos',
      description: 'Solicitud de muestra o degustación de productos',
      level: 3,
      parentId: activacionesMarca.id,
      departmentId: deptMarketing || deptPrincipal,
      order: 2,
      color: '#EC4899',
    },
    counters
  )

  await upsertCategory(
    prisma,
    {
      name: 'Lanzamiento de Producto',
      description: 'Solicitud para lanzamiento de nuevo producto',
      level: 3,
      parentId: activacionesMarca.id,
      departmentId: deptMarketing || deptPrincipal,
      order: 3,
      color: '#EC4899',
    },
    counters
  )

  await upsertCategory(
    prisma,
    {
      name: 'Experiencia Interactiva',
      description: 'Solicitud de experiencia interactiva para clientes',
      level: 3,
      parentId: activacionesMarca.id,
      departmentId: deptMarketing || deptPrincipal,
      order: 4,
      color: '#EC4899',
    },
    counters
  )

  // Nivel 3 - Problemas con Arrendamiento
  await upsertCategory(
    prisma,
    {
      name: 'Problema con Pago',
      description: 'Incidencia relacionada con pago de arriendo',
      level: 3,
      parentId: problemaArrendamiento.id,
      departmentId: deptComercial || deptPrincipal,
      order: 1,
      color: '#F43F5E',
    },
    counters
  )

  await upsertCategory(
    prisma,
    {
      name: 'Problema con Contrato',
      description: 'Falla o problema relacionado con el contrato',
      level: 3,
      parentId: problemaArrendamiento.id,
      departmentId: deptComercial || deptPrincipal,
      order: 2,
      color: '#F43F5E',
    },
    counters
  )

  // Nivel 3 - Problemas con Eventos
  await upsertCategory(
    prisma,
    {
      name: 'Cancelación de Evento',
      description: 'Cancelación o reprogramación de evento',
      level: 3,
      parentId: problemaEvento.id,
      departmentId: deptMarketing || deptPrincipal,
      order: 1,
      color: '#F43F5E',
    },
    counters
  )

  await upsertCategory(
    prisma,
    {
      name: 'Incidencia Durante Evento',
      description: 'Falla o problema durante la realización del evento',
      level: 3,
      parentId: problemaEvento.id,
      departmentId: deptMarketing || deptPrincipal,
      order: 2,
      color: '#F43F5E',
    },
    counters
  )

  // Nivel 3 - Problemas con Publicidad
  await upsertCategory(
    prisma,
    {
      name: 'Publicidad No Mostrada',
      description: 'Publicidad no se muestra o tiene errores',
      level: 3,
      parentId: problemaPublicidad.id,
      departmentId: deptMarketing || deptPrincipal,
      order: 1,
      color: '#F43F5E',
    },
    counters
  )

  await upsertCategory(
    prisma,
    {
      name: 'Error en Contenido',
      description: 'Error en el contenido de la publicidad',
      level: 3,
      parentId: problemaPublicidad.id,
      departmentId: deptMarketing || deptPrincipal,
      order: 2,
      color: '#F43F5E',
    },
    counters
  )

  // ==================== MEDIOS DIGITALES (Marketing) ====================
  if (deptMediosDigitales) {
    const solicitudDigital = await upsertCategory(
      prisma,
      {
        name: 'Solicitud de Medios Digitales',
        description: 'Pauta, web, redes sociales y contenido digital',
        level: 1,
        parentId: null,
        departmentId: deptMediosDigitales,
        order: 1,
        color: '#DB2777',
      },
      counters
    )

    await upsertCategory(
      prisma,
      {
        name: 'Community Manager',
        description: 'Gestión de redes sociales y comunidad',
        level: 2,
        parentId: solicitudDigital.id,
        departmentId: deptMediosDigitales,
        order: 1,
        color: '#DB2777',
      },
      counters
    )

    await upsertCategory(
      prisma,
      {
        name: 'Pauta / Web',
        description: 'Publicidad digital y actualizaciones web',
        level: 2,
        parentId: solicitudDigital.id,
        departmentId: deptMediosDigitales,
        order: 2,
        color: '#DB2777',
      },
      counters
    )
  }

  // ==================== DISEÑO (Marketing) ====================
  if (deptDiseno) {
    const solicitudDiseno = await upsertCategory(
      prisma,
      {
        name: 'Solicitud de Diseño',
        description: 'Piezas gráficas, branding y material visual',
        level: 1,
        parentId: null,
        departmentId: deptDiseno,
        order: 1,
        color: '#BE185D',
      },
      counters
    )

    await upsertCategory(
      prisma,
      {
        name: 'Material Gráfico',
        description: 'Banners, flyers, señalética y piezas impresas',
        level: 2,
        parentId: solicitudDiseno.id,
        departmentId: deptDiseno,
        order: 1,
        color: '#BE185D',
      },
      counters
    )

    await upsertCategory(
      prisma,
      {
        name: 'Branding / Identidad Visual',
        description: 'Ajustes de marca e identidad corporativa',
        level: 2,
        parentId: solicitudDiseno.id,
        departmentId: deptDiseno,
        order: 2,
        color: '#BE185D',
      },
      counters
    )
  }

  console.log(
    `✅ Categorías COMMERCIAL/MARKETING: ${counters.created} creadas, ${counters.updated} actualizadas`
  )
}
