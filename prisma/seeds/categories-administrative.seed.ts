/**
 * Seed: Categorías para Familia GESTIÓN ADMINISTRATIVA (ADMINISTRATIVE)
 *
 * Categorías completas para centro comercial: administración, contabilidad,
 * financiero, compras, RRHH y mensajería.
 *
 * Mismo criterio aplicado a TI/Mantenimiento/Arquitectura/Seguridad/Comercial:
 * se pliega el nivel 3 de "una categoría por trámite puntual" en la
 * descripción de su padre de nivel 2, con un `priorityCeiling` inicial. Se
 * conservan como nivel 2 los grupos que sí reflejan trámites distintos.
 *
 * Además corrige un bug de departamento equivalente al ya encontrado en
 * Comercial/Marketing/Eventos: "Certificado de Pago", "Consulta de Estado de
 * Cuenta" y "Solicitud de Factura" eran nivel 3 con `departmentId` de
 * Contabilidad, pero colgaban del nivel 2 "Facturación y Pagos" /
 * "Documentos y Certificados" de Administración — un padre de otro
 * departamento. Como Administración y Contabilidad comparten familia
 * (ADMINISTRATIVE), esto no las volvía invisibles como en el caso de
 * Marketing/Eventos (familias distintas), pero es la misma inconsistencia de
 * diseño: el ticket se enrutaba a Contabilidad mientras la categoría vivía
 * visualmente bajo el árbol de Administración. Se corrige dándole a
 * Contabilidad su propia categoría de nivel 1, fuera del árbol de
 * Administración.
 */

import { PrismaClient, TicketPriority } from '@prisma/client'
import { upsertCategory, type CategorySeedData } from './category-upsert'

export async function seedCategoriesAdministrative(
  prisma: PrismaClient,
  deptMap: Map<string, string>
) {
  const deptAdministracion = deptMap.get('Administración')
  const deptContabilidad = deptMap.get('Contabilidad') || deptMap.get('Financiero')
  const deptFinanciero = deptMap.get('Financiero')
  const deptCompras = deptMap.get('Compras')
  const deptRRHH = deptMap.get('Recursos Humanos')
  const deptMensajeria = deptMap.get('Mensajería')

  if (!deptAdministracion) {
    console.log('⚠️  Departamentos de ADMINISTRATIVE no encontrados, saltando seed...')
    return
  }

  const currentIds: string[] = []
  async function create(data: CategorySeedData) {
    const category = await upsertCategory(prisma, data)
    currentIds.push(category.id)
    return category
  }

  // ==================== DEPARTAMENTO ADMINISTRACIÓN ====================
  const solicitudAdmin = await create({
    name: 'Solicitud Administrativa',
    description: 'Solicitudes al área de administración',
    level: 1,
    parentId: null,
    departmentId: deptAdministracion,
    order: 1,
    color: '#6B7280',
  })

  await create({
    name: 'Documentos y Certificados',
    description:
      'Solicitud de documentos o certificados oficiales: constancias, cartas o cualquier documento administrativo que no sea de facturación',
    level: 2,
    parentId: solicitudAdmin.id,
    departmentId: deptAdministracion,
    order: 1,
    color: '#6B7280',
    priorityCeiling: TicketPriority.LOW,
  })

  await create({
    name: 'Permisos y Autorizaciones',
    description:
      'Solicitud de permisos o autorizaciones: uso de área común, permiso de activación o evento',
    level: 2,
    parentId: solicitudAdmin.id,
    departmentId: deptAdministracion,
    order: 2,
    color: '#6B7280',
    priorityCeiling: TicketPriority.LOW,
  })

  await create({
    name: 'Atención a Locatarios',
    description: 'Soporte y atención a locales arrendatarios',
    level: 2,
    parentId: solicitudAdmin.id,
    departmentId: deptAdministracion,
    order: 3,
    color: '#6B7280',
    priorityCeiling: TicketPriority.LOW,
  })

  // ==================== DEPARTAMENTO CONTABILIDAD ====================
  if (deptContabilidad) {
    await create({
      name: 'Facturación y Certificados de Pago',
      description:
        'Trámites de facturación y pagos: solicitar certificado de pago, consultar estado de cuenta, solicitar factura o comprobante',
      level: 1,
      parentId: null,
      departmentId: deptContabilidad,
      order: 1,
      color: '#EF4444',
      priorityCeiling: TicketPriority.LOW,
    })
  }

  // ==================== DEPARTAMENTO FINANCIERO ====================
  if (deptFinanciero) {
    const solicitudFin = await create({
      name: 'Solicitud Financiera',
      description: 'Solicitudes al área financiera',
      level: 1,
      parentId: null,
      departmentId: deptFinanciero,
      order: 1,
      color: '#0EA5E9',
    })

    const consultaFin = await create({
      name: 'Consulta Financiera',
      description: 'Consultas de presupuestos, flujo de caja y reportes',
      level: 1,
      parentId: null,
      departmentId: deptFinanciero,
      order: 2,
      color: '#0284C7',
    })

    await create({
      name: 'Aprobación de Gasto',
      description: 'Solicitar aprobación de un gasto o desembolso',
      level: 2,
      parentId: solicitudFin.id,
      departmentId: deptFinanciero,
      order: 1,
      color: '#0EA5E9',
      // Puede bloquear un pago o compra ya comprometida.
      priorityCeiling: TicketPriority.MEDIUM,
    })

    await create({
      name: 'Anticipo o Reembolso',
      description: 'Solicitar anticipo de viáticos o reembolso de gastos',
      level: 2,
      parentId: solicitudFin.id,
      departmentId: deptFinanciero,
      order: 2,
      color: '#0EA5E9',
      priorityCeiling: TicketPriority.LOW,
    })

    await create({
      name: 'Presupuesto',
      description: 'Consulta o ajuste de presupuesto por área',
      level: 2,
      parentId: consultaFin.id,
      departmentId: deptFinanciero,
      order: 1,
      color: '#0284C7',
      priorityCeiling: TicketPriority.LOW,
    })

    await create({
      name: 'Reporte Financiero',
      description: 'Solicitar reporte de ingresos, egresos o conciliaciones',
      level: 2,
      parentId: consultaFin.id,
      departmentId: deptFinanciero,
      order: 2,
      color: '#0284C7',
      priorityCeiling: TicketPriority.LOW,
    })
  }

  // ==================== DEPARTAMENTO COMPRAS ====================
  if (deptCompras) {
    const solicitudCompras = await create({
      name: 'Solicitud de Compras',
      description: 'Requerimientos de compra de bienes o servicios',
      level: 1,
      parentId: null,
      departmentId: deptCompras,
      order: 1,
      color: '#06B6D4',
    })

    const seguimientoCompras = await create({
      name: 'Seguimiento de Compra',
      description: 'Seguimiento de órdenes y proveedores',
      level: 1,
      parentId: null,
      departmentId: deptCompras,
      order: 2,
      color: '#0891B2',
    })

    await create({
      name: 'Cotización',
      description: 'Solicitar cotización a proveedores',
      level: 2,
      parentId: solicitudCompras.id,
      departmentId: deptCompras,
      order: 1,
      color: '#06B6D4',
      priorityCeiling: TicketPriority.LOW,
    })

    await create({
      name: 'Orden de Compra',
      description: 'Generar o autorizar orden de compra',
      level: 2,
      parentId: solicitudCompras.id,
      departmentId: deptCompras,
      order: 2,
      color: '#06B6D4',
      priorityCeiling: TicketPriority.LOW,
    })

    await create({
      name: 'Insumos / Materiales',
      description: 'Compra de insumos, materiales o consumibles',
      level: 2,
      parentId: solicitudCompras.id,
      departmentId: deptCompras,
      order: 3,
      color: '#06B6D4',
      priorityCeiling: TicketPriority.LOW,
    })

    await create({
      name: 'Estado de Pedido',
      description: 'Consultar estado de una orden o pedido',
      level: 2,
      parentId: seguimientoCompras.id,
      departmentId: deptCompras,
      order: 1,
      color: '#0891B2',
      priorityCeiling: TicketPriority.LOW,
    })

    await create({
      name: 'Recepción de Mercancía',
      description: 'Reportar recepción o inconsistencia en entrega',
      level: 2,
      parentId: seguimientoCompras.id,
      departmentId: deptCompras,
      order: 2,
      color: '#0891B2',
      // Inconsistencia o daño en una entrega puede requerir devolución a tiempo.
      priorityCeiling: TicketPriority.MEDIUM,
    })
  }

  // ==================== DEPARTAMENTO RECURSOS HUMANOS ====================
  if (deptRRHH) {
    const solicitudRRHH = await create({
      name: 'Solicitud de RRHH',
      description: 'Solicitudes al departamento de Recursos Humanos',
      level: 1,
      parentId: null,
      departmentId: deptRRHH,
      order: 1,
      color: '#8B5CF6',
    })

    await create({
      name: 'Permiso Personal',
      description: 'Solicitar permiso personal o vacaciones',
      level: 2,
      parentId: solicitudRRHH.id,
      departmentId: deptRRHH,
      order: 1,
      color: '#8B5CF6',
      priorityCeiling: TicketPriority.LOW,
    })

    await create({
      name: 'Consulta de Nómina',
      description: 'Consultas sobre nómina o beneficios',
      level: 2,
      parentId: solicitudRRHH.id,
      departmentId: deptRRHH,
      order: 2,
      color: '#8B5CF6',
      // Un error de nómina afecta el pago de una persona.
      priorityCeiling: TicketPriority.MEDIUM,
    })
  }

  // ==================== DEPARTAMENTO MENSAJERÍA ====================
  // Mismo criterio aplicado antes a TI/Mantenimiento/Arquitectura: se pliega
  // el nivel 3 de "un tipo de entrega por categoría" (Correspondencia,
  // Documentos, Paquetes Pequeños, Envío a Cliente, Envío a Proveedor,
  // Rastreo de Envío, Confirmación de Entrega) en la descripción de su
  // padre de nivel 2 — el mismo mensajero atiende todos esos casos y el
  // buscador de sugerencias ya indexa por name+description, no hace falta
  // una categoría por síntoma para que sugiera bien.
  //
  // Se conservan como nivel 2 los 3 tipos de entrega (interna/externa/
  // recepción) porque sí son flujos distintos en la práctica (entrega
  // dentro del centro comercial vs. envío que sale a un cliente o
  // proveedor vs. algo que llega de afuera y hay que recibir), y
  // "Consulta o Seguimiento" pasa a ser una hoja única — sus 2 hijos
  // (rastreo y confirmación) eran el mismo trámite visto en dos momentos.
  if (deptMensajeria) {
    const solicitudMensajeria = await create({
      name: 'Solicitud de Mensajería',
      description: 'Solicitudes de servicio de mensajería y envíos',
      level: 1,
      parentId: null,
      departmentId: deptMensajeria,
      order: 1,
      color: '#A855F7',
    })

    await create({
      name: 'Consulta o Seguimiento',
      description:
        'Consultas y seguimiento de envíos: rastreo de un envío en curso, confirmación de que una entrega ya se realizó',
      level: 1,
      parentId: null,
      departmentId: deptMensajeria,
      order: 2,
      color: '#10B981',
      priorityCeiling: TicketPriority.LOW,
    })

    await create({
      name: 'Entrega Interna',
      description:
        'Entregas dentro del centro comercial: correspondencia, documentos importantes o paquetes pequeños entre locales',
      level: 2,
      parentId: solicitudMensajeria.id,
      departmentId: deptMensajeria,
      order: 1,
      color: '#A855F7',
      priorityCeiling: TicketPriority.LOW,
    })

    await create({
      name: 'Entrega Externa',
      description:
        'Envíos y entregas fuera del centro comercial: envío de productos a clientes, devolución de mercancía o entrega de documentos a proveedores',
      level: 2,
      parentId: solicitudMensajeria.id,
      departmentId: deptMensajeria,
      order: 2,
      color: '#A855F7',
      priorityCeiling: TicketPriority.MEDIUM,
    })

    await create({
      name: 'Recepción de Paquetes',
      description: 'Recepción y gestión de paquetes que llegan al centro comercial',
      level: 2,
      parentId: solicitudMensajeria.id,
      departmentId: deptMensajeria,
      order: 3,
      color: '#A855F7',
      priorityCeiling: TicketPriority.LOW,
    })
  }

  // ==================== RETIRO DE CATEGORÍAS VIEJAS ====================
  // Por departamento (este archivo cubre 6 departamentos distintos):
  // isActive:false conserva el historial de cualquier ticket que ya las use.
  let retired = 0
  for (const deptId of [
    deptAdministracion,
    deptContabilidad,
    deptFinanciero,
    deptCompras,
    deptRRHH,
    deptMensajeria,
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
    `✅ Categorías ADMINISTRATIVE (Admin, Contabilidad, Financiero, Compras, RRHH, Mensajería): ${currentIds.length} vigentes, ${retired} retiradas`
  )
}
