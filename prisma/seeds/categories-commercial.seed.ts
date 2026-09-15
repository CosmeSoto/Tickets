/**
 * Seed: Categorías para Familia COMERCIAL Y MARKETING (COMMERCIAL)
 *
 * Categorías completas para centro comercial: comercial, marketing, eventos, activaciones,
 * medios digitales, diseño y servicio al cliente.
 *
 * Reescrito por dos problemas reales encontrados (no solo sobre-fragmentación):
 *
 * 1. **Bug de departamento**: las categorías de nivel 1 "Solicitud Comercial o de
 *    Marketing" / "Falla o Problema Comercial" se creaban bajo un `deptPrincipal`
 *    compartido (Comercial), pero sus hijas de nivel 3 de publicidad/redes
 *    sociales/activaciones de marca/problemas con eventos usaban
 *    `deptEventos || deptMarketing || deptPrincipal` — un fallback copiado sin
 *    ajustar de la sección de "Eventos" — así que quedaban archivadas bajo el
 *    departamento Eventos aunque su propia categoría padre (nivel 2) estuviera en
 *    Marketing. Como `categories.familyId` se sincroniza por `departmentId` de
 *    cada fila (no se hereda del padre — ver `syncCategoryFamilies()` en
 *    `prisma/seed.ts` y `buildCategoryFamilyWhere()` en
 *    `src/lib/categories/sync-category-families.ts`), esto tenía un efecto
 *    real: al filtrar categorías por familia MARKETING, esas categorías
 *    aparecían "huérfanas" (su padre no estaba en el mismo filtro) y
 *    `CategoryTree.buildTree()` las descartaba en silencio — invisibles al
 *    crear un ticket. Se corrige eliminando el patrón de nodo padre
 *    compartido entre departamentos: cada categoría final queda directamente
 *    en nivel 1, en su propio departamento, sin depender de un padre ajeno.
 * 2. **Bloque duplicado**: la sección "SERVICIO AL CLIENTE" estaba copiada
 *    dos veces literalmente (bug de copy-paste). Con `upsertCategory` es
 *    inofensivo en runtime (la segunda pasada solo re-actualiza las mismas
 *    filas), pero es código muerto que se elimina.
 *
 * Además, mismo criterio que TI/Mantenimiento/Arquitectura: se elimina el
 * nivel 3 de síntoma (ej. "Consulta de Disponibilidad"/"Solicitud de
 * Información"/"Solicitud de Visita"/... bajo "Arrendamiento de Locales") y
 * su texto se pliega en la descripción de la categoría que lo reemplaza, con
 * un `priorityCeiling` inicial (LOW en solicitudes/consultas rutinarias,
 * MEDIUM/HIGH donde hay una queja o incidencia real en curso).
 */

import { PrismaClient, TicketPriority } from '@prisma/client'
import { upsertCategory, type CategorySeedData } from './category-upsert'

export async function seedCategoriesCommercial(prisma: PrismaClient, deptMap: Map<string, string>) {
  const deptComercial = deptMap.get('Comercial')
  const deptMarketing = deptMap.get('Marketing')
  const deptMediosDigitales = deptMap.get('Medios Digitales')
  const deptDiseno = deptMap.get('Diseño')
  const deptEventos = deptMap.get('Eventos')
  const deptServicioCliente = deptMap.get('Servicio al Cliente')

  if (
    !deptComercial &&
    !deptMarketing &&
    !deptMediosDigitales &&
    !deptDiseno &&
    !deptEventos &&
    !deptServicioCliente
  ) {
    console.log('⚠️  Departamentos de COMMERCIAL/MARKETING no encontrados, saltando seed...')
    return
  }

  const currentIds: string[] = []
  async function create(data: CategorySeedData) {
    const category = await upsertCategory(prisma, data)
    currentIds.push(category.id)
    return category
  }

  // ==================== COMERCIAL ====================
  if (deptComercial) {
    await create({
      name: 'Arrendamiento de Locales',
      description:
        'Consultas y solicitudes sobre arrendamiento: disponibilidad de locales, información general, solicitud de visita, negociación o renovación de contrato',
      level: 1,
      parentId: null,
      departmentId: deptComercial,
      order: 1,
      color: '#EC4899',
      priorityCeiling: TicketPriority.LOW,
    })

    await create({
      name: 'Relaciones con Locatarios',
      description:
        'Solicitudes y consultas de los locales arrendados: consulta de facturación, modificación o mejora del local, horario especial, queja o reclamo',
      level: 1,
      parentId: null,
      departmentId: deptComercial,
      order: 2,
      color: '#EC4899',
      priorityCeiling: TicketPriority.MEDIUM,
    })

    await create({
      name: 'Problema con Arrendamiento',
      description: 'Fallas o problemas relacionados con arrendamiento: pago o contrato',
      level: 1,
      parentId: null,
      departmentId: deptComercial,
      order: 3,
      color: '#F43F5E',
      priorityCeiling: TicketPriority.MEDIUM,
    })
  }

  // ==================== MARKETING ====================
  if (deptMarketing) {
    await create({
      name: 'Publicidad y Promociones',
      description:
        'Solicitudes de publicidad o espacios promocionales: espacio publicitario, promoción conjunta, pantallas digitales, mupis o cartelería, folletos, patrocinio de evento',
      level: 1,
      parentId: null,
      departmentId: deptMarketing,
      order: 1,
      color: '#EC4899',
      priorityCeiling: TicketPriority.LOW,
    })

    await create({
      name: 'Redes Sociales y Contenido',
      description:
        'Solicitudes relacionadas con redes sociales: mención, publicación de contenido, colaboración con influencer, historias o reels',
      level: 1,
      parentId: null,
      departmentId: deptMarketing,
      order: 2,
      color: '#EC4899',
      priorityCeiling: TicketPriority.LOW,
    })

    await create({
      name: 'Activaciones de Marca',
      description:
        'Solicitudes para activaciones y pop-ups de marcas: pop-up store, muestra de productos, lanzamiento de producto, experiencia interactiva',
      level: 1,
      parentId: null,
      departmentId: deptMarketing,
      order: 3,
      color: '#EC4899',
      priorityCeiling: TicketPriority.LOW,
    })

    await create({
      name: 'Problema con Publicidad',
      description:
        'Fallas o problemas con publicidad: no se muestra, tiene errores o error en el contenido',
      level: 1,
      parentId: null,
      departmentId: deptMarketing,
      order: 4,
      color: '#F43F5E',
      priorityCeiling: TicketPriority.MEDIUM,
    })
  }

  // ==================== EVENTOS ====================
  if (deptEventos) {
    await create({
      name: 'Eventos y Activaciones',
      description:
        'Solicitudes para eventos o activaciones: reserva de espacio, coordinación de logística, permisos, evento temporal (Navidad, San Valentín, etc.), conferencia o taller',
      level: 1,
      parentId: null,
      departmentId: deptEventos,
      order: 1,
      color: '#EC4899',
      priorityCeiling: TicketPriority.LOW,
    })

    await create({
      name: 'Problema con Evento',
      description:
        'Fallas o incidencias durante eventos: cancelación, reprogramación o incidencia durante la realización',
      level: 1,
      parentId: null,
      departmentId: deptEventos,
      order: 2,
      color: '#F43F5E',
      // Una incidencia durante un evento en curso es urgente por naturaleza.
      priorityCeiling: TicketPriority.HIGH,
    })
  }

  // ==================== MEDIOS DIGITALES (Marketing) ====================
  if (deptMediosDigitales) {
    const solicitudDigital = await create({
      name: 'Solicitud de Medios Digitales',
      description: 'Pauta, web, redes sociales y contenido digital',
      level: 1,
      parentId: null,
      departmentId: deptMediosDigitales,
      order: 1,
      color: '#DB2777',
    })

    await create({
      name: 'Community Manager',
      description: 'Gestión de redes sociales y comunidad',
      level: 2,
      parentId: solicitudDigital.id,
      departmentId: deptMediosDigitales,
      order: 1,
      color: '#DB2777',
      priorityCeiling: TicketPriority.LOW,
    })

    await create({
      name: 'Pauta / Web',
      description: 'Publicidad digital y actualizaciones web',
      level: 2,
      parentId: solicitudDigital.id,
      departmentId: deptMediosDigitales,
      order: 2,
      color: '#DB2777',
      priorityCeiling: TicketPriority.LOW,
    })
  }

  // ==================== DISEÑO (Marketing) ====================
  if (deptDiseno) {
    const solicitudDiseno = await create({
      name: 'Solicitud de Diseño',
      description: 'Piezas gráficas, branding y material visual',
      level: 1,
      parentId: null,
      departmentId: deptDiseno,
      order: 1,
      color: '#BE185D',
    })

    await create({
      name: 'Material Gráfico',
      description: 'Banners, flyers, señalética y piezas impresas',
      level: 2,
      parentId: solicitudDiseno.id,
      departmentId: deptDiseno,
      order: 1,
      color: '#BE185D',
      priorityCeiling: TicketPriority.LOW,
    })

    await create({
      name: 'Branding / Identidad Visual',
      description: 'Ajustes de marca e identidad corporativa',
      level: 2,
      parentId: solicitudDiseno.id,
      departmentId: deptDiseno,
      order: 2,
      color: '#BE185D',
      priorityCeiling: TicketPriority.LOW,
    })
  }

  // ==================== SERVICIO AL CLIENTE (Marketing) ====================
  if (deptServicioCliente) {
    const atencionCliente = await create({
      name: 'Atención al Cliente',
      description: 'Consultas, orientación y servicio a visitantes o clientes',
      level: 1,
      parentId: null,
      departmentId: deptServicioCliente,
      order: 1,
      color: '#E879F9',
    })

    const puntoCanje = await create({
      name: 'Punto de Canje',
      description: 'Canje de premios, beneficios, cupones y promociones',
      level: 1,
      parentId: null,
      departmentId: deptServicioCliente,
      order: 2,
      color: '#C026D3',
    })

    const reclamoCliente = await create({
      name: 'Reclamo o Queja',
      description: 'Reclamos, quejas y seguimiento de incidencias de servicio',
      level: 1,
      parentId: null,
      departmentId: deptServicioCliente,
      order: 3,
      color: '#EF4444',
    })

    await create({
      name: 'Consulta General',
      description: 'Información general sobre el centro comercial o servicios',
      level: 2,
      parentId: atencionCliente.id,
      departmentId: deptServicioCliente,
      order: 1,
      color: '#E879F9',
      priorityCeiling: TicketPriority.LOW,
    })

    await create({
      name: 'Orientación a Visitantes',
      description: 'Ubicación de locales, horarios y orientación en sitio',
      level: 2,
      parentId: atencionCliente.id,
      departmentId: deptServicioCliente,
      order: 2,
      color: '#E879F9',
      priorityCeiling: TicketPriority.LOW,
    })

    await create({
      name: 'Punto de Información',
      description: 'Información de promociones, eventos y servicios disponibles',
      level: 2,
      parentId: atencionCliente.id,
      departmentId: deptServicioCliente,
      order: 3,
      color: '#E879F9',
      priorityCeiling: TicketPriority.LOW,
    })

    await create({
      name: 'Canje de Premios o Beneficios',
      description: 'Redención de premios, puntos o beneficios de fidelización',
      level: 2,
      parentId: puntoCanje.id,
      departmentId: deptServicioCliente,
      order: 1,
      color: '#C026D3',
      priorityCeiling: TicketPriority.LOW,
    })

    await create({
      name: 'Validación de Cupones o Vouchers',
      description: 'Validación y aplicación de cupones, vouchers o códigos promocionales',
      level: 2,
      parentId: puntoCanje.id,
      departmentId: deptServicioCliente,
      order: 2,
      color: '#C026D3',
      priorityCeiling: TicketPriority.LOW,
    })

    await create({
      name: 'Seguimiento de Reclamo',
      description: 'Consulta o actualización sobre un reclamo en curso',
      level: 2,
      parentId: reclamoCliente.id,
      departmentId: deptServicioCliente,
      order: 1,
      color: '#EF4444',
      priorityCeiling: TicketPriority.MEDIUM,
    })
  }

  // ==================== RETIRO DE CATEGORÍAS VIEJAS ====================
  // Por departamento (este archivo cubre 6 departamentos distintos):
  // isActive:false conserva el historial de cualquier ticket que ya las use.
  let retired = 0
  for (const deptId of [
    deptComercial,
    deptMarketing,
    deptEventos,
    deptMediosDigitales,
    deptDiseno,
    deptServicioCliente,
  ]) {
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
    `✅ Categorías COMMERCIAL/MARKETING: ${currentIds.length} vigentes, ${retired} retiradas`
  )
}
