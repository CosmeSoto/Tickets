/**
 * Seed: Categorías para Familia GESTIÓN ADMINISTRATIVA (ADMINISTRATIVE)
 *
 * Categorías completas para centro comercial: administración, contabilidad, compras, RRHH.
 */

import { PrismaClient, TicketPriority } from '@prisma/client'
import { upsertCategory, type CategorySeedData } from './category-upsert'

export async function seedCategoriesAdministrative(
  prisma: PrismaClient,
  deptMap: Map<string, string>
) {
  const deptAdministracion = deptMap.get('Administración')
  const deptContabilidad = deptMap.get('Contabilidad') || deptMap.get('Financiero')
  const deptCompras = deptMap.get('Compras')
  const deptRRHH = deptMap.get('Recursos Humanos')

  if (!deptAdministracion) {
    console.log('⚠️  Departamentos de ADMINISTRATIVE no encontrados, saltando seed...')
    return
  }

  // ==================== DEPARTAMENTO ADMINISTRACIÓN ====================
  const solicitudAdmin = await upsertCategory(prisma, {
    name: 'Solicitud Administrativa',
    description: 'Solicitudes al área de administración',
    level: 1,
    parentId: null,
    departmentId: deptAdministracion,
    order: 1,
    color: '#6B7280',
  })

  // Nivel 2 - Solicitudes Administrativas
  const documentos = await upsertCategory(prisma, {
    name: 'Documentos y Certificados',
    description: 'Solicitud de documentos o certificados',
    level: 2,
    parentId: solicitudAdmin.id,
    departmentId: deptAdministracion,
    order: 1,
    color: '#6B7280',
  })

  const permisos = await upsertCategory(prisma, {
    name: 'Permisos y Autorizaciones',
    description: 'Solicitud de permisos o autorizaciones',
    level: 2,
    parentId: solicitudAdmin.id,
    departmentId: deptAdministracion,
    order: 2,
    color: '#6B7280',
  })

  const facturacion = await upsertCategory(prisma, {
    name: 'Facturación y Pagos',
    description: 'Consultas o solicitudes de facturación',
    level: 2,
    parentId: solicitudAdmin.id,
    departmentId: deptAdministracion,
    order: 3,
    color: '#6B7280',
  })

  const atencionLocatarios = await upsertCategory(prisma, {
    name: 'Atención a Locatarios',
    description: 'Soporte y atención a locales arrendatarios',
    level: 2,
    parentId: solicitudAdmin.id,
    departmentId: deptAdministracion,
    order: 4,
    color: '#6B7280',
  })

  // Nivel 3 - Documentos
  if (deptContabilidad) {
    await upsertCategory(prisma, {
      name: 'Certificado de Pago',
      description: 'Solicitar certificado de pago o estado de cuenta',
      level: 3,
      parentId: documentos.id,
      departmentId: deptContabilidad,
      order: 1,
      color: '#6B7280',
    })
  }

  await upsertCategory(prisma, {
    name: 'Constancia',
    description: 'Solicitar constancia o documento oficial',
    level: 3,
    parentId: documentos.id,
    departmentId: deptAdministracion,
    order: 2,
    color: '#6B7280',
  })

  // Nivel 3 - Permisos
  await upsertCategory(prisma, {
    name: 'Permiso de Uso de Área',
    description: 'Solicitar permiso para usar área común',
    level: 3,
    parentId: permisos.id,
    departmentId: deptAdministracion,
    order: 1,
    color: '#6B7280',
  })

  await upsertCategory(prisma, {
    name: 'Permiso de Activación',
    description: 'Solicitar permiso para activación o evento',
    level: 3,
    parentId: permisos.id,
    departmentId: deptAdministracion,
    order: 2,
    color: '#6B7280',
  })

  // Nivel 3 - Facturación
  if (deptContabilidad) {
    await upsertCategory(prisma, {
      name: 'Consulta de Estado de Cuenta',
      description: 'Consultar estado de cuenta o pagos',
      level: 3,
      parentId: facturacion.id,
      departmentId: deptContabilidad,
      order: 1,
      color: '#6B7280',
    })

    await upsertCategory(prisma, {
      name: 'Solicitud de Factura',
      description: 'Solicitar factura o comprobante',
      level: 3,
      parentId: facturacion.id,
      departmentId: deptContabilidad,
      order: 2,
      color: '#6B7280',
    })
  }

  // ==================== DEPARTAMENTO RECURSOS HUMANOS (si existe) ====================
  if (deptRRHH) {
    const solicitudRRHH = await upsertCategory(prisma, {
      name: 'Solicitud de RRHH',
      description: 'Solicitudes al departamento de Recursos Humanos',
      level: 1,
      parentId: null,
      departmentId: deptRRHH,
      order: 1,
      color: '#8B5CF6',
    })

    await upsertCategory(prisma, {
      name: 'Permiso Personal',
      description: 'Solicitar permiso personal o vacaciones',
      level: 2,
      parentId: solicitudRRHH.id,
      departmentId: deptRRHH,
      order: 1,
      color: '#8B5CF6',
    })

    await upsertCategory(prisma, {
      name: 'Consulta de Nómina',
      description: 'Consultas sobre nómina o beneficios',
      level: 2,
      parentId: solicitudRRHH.id,
      departmentId: deptRRHH,
      order: 2,
      color: '#8B5CF6',
    })
  }

  // ==================== DEPARTAMENTO FINANCIERO ====================
  const deptFinanciero = deptMap.get('Financiero')
  if (deptFinanciero) {
    const solicitudFin = await upsertCategory(prisma, {
      name: 'Solicitud Financiera',
      description: 'Solicitudes al área financiera',
      level: 1,
      parentId: null,
      departmentId: deptFinanciero,
      order: 1,
      color: '#0EA5E9',
    })

    const consultaFin = await upsertCategory(prisma, {
      name: 'Consulta Financiera',
      description: 'Consultas de presupuestos, flujo de caja y reportes',
      level: 1,
      parentId: null,
      departmentId: deptFinanciero,
      order: 2,
      color: '#0284C7',
    })

    await upsertCategory(prisma, {
      name: 'Aprobación de Gasto',
      description: 'Solicitar aprobación de un gasto o desembolso',
      level: 2,
      parentId: solicitudFin.id,
      departmentId: deptFinanciero,
      order: 1,
      color: '#0EA5E9',
    })

    await upsertCategory(prisma, {
      name: 'Anticipo o Reembolso',
      description: 'Solicitar anticipo de viáticos o reembolso de gastos',
      level: 2,
      parentId: solicitudFin.id,
      departmentId: deptFinanciero,
      order: 2,
      color: '#0EA5E9',
    })

    await upsertCategory(prisma, {
      name: 'Presupuesto',
      description: 'Consulta o ajuste de presupuesto por área',
      level: 2,
      parentId: consultaFin.id,
      departmentId: deptFinanciero,
      order: 1,
      color: '#0284C7',
    })

    await upsertCategory(prisma, {
      name: 'Reporte Financiero',
      description: 'Solicitar reporte de ingresos, egresos o conciliaciones',
      level: 2,
      parentId: consultaFin.id,
      departmentId: deptFinanciero,
      order: 2,
      color: '#0284C7',
    })
  }

  // ==================== DEPARTAMENTO COMPRAS ====================
  if (deptCompras) {
    const solicitudCompras = await upsertCategory(prisma, {
      name: 'Solicitud de Compras',
      description: 'Requerimientos de compra de bienes o servicios',
      level: 1,
      parentId: null,
      departmentId: deptCompras,
      order: 1,
      color: '#06B6D4',
    })

    const seguimientoCompras = await upsertCategory(prisma, {
      name: 'Seguimiento de Compra',
      description: 'Seguimiento de órdenes y proveedores',
      level: 1,
      parentId: null,
      departmentId: deptCompras,
      order: 2,
      color: '#0891B2',
    })

    await upsertCategory(prisma, {
      name: 'Cotización',
      description: 'Solicitar cotización a proveedores',
      level: 2,
      parentId: solicitudCompras.id,
      departmentId: deptCompras,
      order: 1,
      color: '#06B6D4',
    })

    await upsertCategory(prisma, {
      name: 'Orden de Compra',
      description: 'Generar o autorizar orden de compra',
      level: 2,
      parentId: solicitudCompras.id,
      departmentId: deptCompras,
      order: 2,
      color: '#06B6D4',
    })

    await upsertCategory(prisma, {
      name: 'Insumos / Materiales',
      description: 'Compra de insumos, materiales o consumibles',
      level: 2,
      parentId: solicitudCompras.id,
      departmentId: deptCompras,
      order: 3,
      color: '#06B6D4',
    })

    await upsertCategory(prisma, {
      name: 'Estado de Pedido',
      description: 'Consultar estado de una orden o pedido',
      level: 2,
      parentId: seguimientoCompras.id,
      departmentId: deptCompras,
      order: 1,
      color: '#0891B2',
    })

    await upsertCategory(prisma, {
      name: 'Recepción de Mercancía',
      description: 'Reportar recepción o inconsistencia en entrega',
      level: 2,
      parentId: seguimientoCompras.id,
      departmentId: deptCompras,
      order: 2,
      color: '#0891B2',
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
  const deptMensajeria = deptMap.get('Mensajería')
  if (deptMensajeria) {
    const mensajeriaIds: string[] = []
    async function createMensajeria(data: CategorySeedData) {
      const category = await upsertCategory(prisma, data)
      mensajeriaIds.push(category.id)
      return category
    }

    const solicitudMensajeria = await createMensajeria({
      name: 'Solicitud de Mensajería',
      description: 'Solicitudes de servicio de mensajería y envíos',
      level: 1,
      parentId: null,
      departmentId: deptMensajeria,
      order: 1,
      color: '#A855F7',
    })

    await createMensajeria({
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

    await createMensajeria({
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

    await createMensajeria({
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

    await createMensajeria({
      name: 'Recepción de Paquetes',
      description: 'Recepción y gestión de paquetes que llegan al centro comercial',
      level: 2,
      parentId: solicitudMensajeria.id,
      departmentId: deptMensajeria,
      order: 3,
      color: '#A855F7',
      priorityCeiling: TicketPriority.LOW,
    })

    const oldMensajeria = await prisma.categories.findMany({
      where: { departmentId: deptMensajeria, isActive: true, id: { notIn: mensajeriaIds } },
      select: { id: true },
    })
    if (oldMensajeria.length > 0) {
      await prisma.categories.updateMany({
        where: { id: { in: oldMensajeria.map(c => c.id) } },
        data: { isActive: false, updatedAt: new Date() },
      })
    }
    console.log(
      `✅ Categorías Mensajería: ${mensajeriaIds.length} vigentes, ${oldMensajeria.length} retiradas`
    )
  }

  console.log('✅ Categorías ADMINISTRATIVE (Admin, Financiero, Compras, RRHH)')
}
