/**
 * Seed: Categorías para Familia GESTIÓN ADMINISTRATIVA (ADMINISTRATIVE)
 *
 * Categorías completas para centro comercial: administración, contabilidad, compras, RRHH.
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

export async function seedCategoriesAdministrative(
  prisma: PrismaClient,
  deptMap: Map<string, string>
) {
  const deptAdministracion = deptMap.get('Administración')
  const deptContabilidad = deptMap.get('Contabilidad')
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

  console.log('✅ Categorías ADMINISTRATIVE (Gestión Administrativa)')
}
