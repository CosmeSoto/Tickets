import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

/**
 * Seed de bodegas por familia
 * Crea bodegas de ejemplo para cada familia que maneja inventario
 */
export async function seedWarehouses(prisma: PrismaClient, familyMap: Map<string, string>) {
  console.log('🏢 Seeding bodegas por familia...')

  const techFamilyId = familyMap.get('TECHNOLOGY')!
  const fixedAssetsFamilyId = familyMap.get('FIXED_ASSETS')!
  const maintenanceFamilyId = familyMap.get('MAINTENANCE')!
  const securityFamilyId = familyMap.get('SECURITY')!

  // Obtener usuario admin para asignar como manager
  const admin = await prisma.users.findFirst({
    where: { email: 'internet.freecom@gmail.com' },
  })

  if (!admin) {
    console.log('⚠️  No se encontró usuario admin, saltando seed de bodegas')
    return
  }

  // ============================================
  // BODEGAS PARA TECNOLOGÍA Y COMUNICACIONES
  // ============================================

  const techWarehouses = [
    {
      name: 'Bodega TI Principal',
      location: 'Edificio A - Piso 2 - Sala 201',
      description: 'Bodega principal de equipos tecnológicos y hardware',
      familyId: techFamilyId,
      managerId: admin.id,
      isActive: true,
    },
    {
      name: 'Bodega de Equipos en Reparación',
      location: 'Edificio A - Piso 1 - Taller',
      description: 'Equipos en proceso de reparación o mantenimiento',
      familyId: techFamilyId,
      managerId: admin.id,
      isActive: true,
    },
    {
      name: 'Bodega de Equipos Obsoletos',
      location: 'Edificio C - Sótano',
      description: 'Equipos dados de baja pendientes de disposición final',
      familyId: techFamilyId,
      managerId: admin.id,
      isActive: true,
    },
  ]

  for (const warehouse of techWarehouses) {
    const existing = await prisma.warehouses.findFirst({
      where: {
        name: warehouse.name,
        familyId: warehouse.familyId,
      },
    })

    if (existing) {
      await prisma.warehouses.update({
        where: { id: existing.id },
        data: {
          location: warehouse.location,
          description: warehouse.description,
          managerId: warehouse.managerId,
          isActive: warehouse.isActive,
        },
      })
    } else {
      await prisma.warehouses.create({
        data: {
          id: randomUUID(),
          ...warehouse,
        },
      })
    }
  }
  console.log(`  ✅ ${techWarehouses.length} bodegas para Tecnología y Comunicaciones`)

  // ============================================
  // BODEGAS PARA ACTIVOS FIJOS E INFRAESTRUCTURA
  // ============================================

  const fixedAssetsWarehouses = [
    {
      name: 'Bodega de Mobiliario',
      location: 'Edificio B - Piso 1',
      description: 'Almacén de mobiliario de oficina y muebles',
      familyId: fixedAssetsFamilyId,
      managerId: admin.id,
      isActive: true,
    },
    {
      name: 'Bodega de Equipos de Infraestructura',
      location: 'Edificio B - Sótano',
      description: 'Equipos de climatización, generadores, UPS, etc.',
      familyId: fixedAssetsFamilyId,
      managerId: admin.id,
      isActive: true,
    },
    {
      name: 'Bodega de Herramientas',
      location: 'Edificio B - Piso 1 - Sala 105',
      description: 'Herramientas y equipos para mantenimiento de infraestructura',
      familyId: fixedAssetsFamilyId,
      managerId: admin.id,
      isActive: true,
    },
  ]

  for (const warehouse of fixedAssetsWarehouses) {
    const existing = await prisma.warehouses.findFirst({
      where: {
        name: warehouse.name,
        familyId: warehouse.familyId,
      },
    })

    if (existing) {
      await prisma.warehouses.update({
        where: { id: existing.id },
        data: {
          location: warehouse.location,
          description: warehouse.description,
          managerId: warehouse.managerId,
          isActive: warehouse.isActive,
        },
      })
    } else {
      await prisma.warehouses.create({
        data: {
          id: randomUUID(),
          ...warehouse,
        },
      })
    }
  }
  console.log(`  ✅ ${fixedAssetsWarehouses.length} bodegas para Activos Fijos e Infraestructura`)

  // ============================================
  // BODEGAS PARA MANTENIMIENTO
  // ============================================

  const maintenanceWarehouses = [
    {
      name: 'Bodega de Repuestos Eléctricos',
      location: 'Edificio D - Piso 1',
      description: 'Repuestos y materiales eléctricos',
      familyId: maintenanceFamilyId,
      managerId: admin.id,
      isActive: true,
    },
    {
      name: 'Bodega de Repuestos Mecánicos',
      location: 'Edificio D - Piso 1',
      description: 'Repuestos y materiales mecánicos',
      familyId: maintenanceFamilyId,
      managerId: admin.id,
      isActive: true,
    },
    {
      name: 'Bodega de Materiales de Construcción',
      location: 'Edificio D - Exterior',
      description: 'Materiales para obras civiles y construcción',
      familyId: maintenanceFamilyId,
      managerId: admin.id,
      isActive: true,
    },
    {
      name: 'Bodega de Herramientas de Mantenimiento',
      location: 'Edificio D - Piso 1 - Taller',
      description: 'Herramientas especializadas para mantenimiento',
      familyId: maintenanceFamilyId,
      managerId: admin.id,
      isActive: true,
    },
  ]

  for (const warehouse of maintenanceWarehouses) {
    const existing = await prisma.warehouses.findFirst({
      where: {
        name: warehouse.name,
        familyId: warehouse.familyId,
      },
    })

    if (existing) {
      await prisma.warehouses.update({
        where: { id: existing.id },
        data: {
          location: warehouse.location,
          description: warehouse.description,
          managerId: warehouse.managerId,
          isActive: warehouse.isActive,
        },
      })
    } else {
      await prisma.warehouses.create({
        data: {
          id: randomUUID(),
          ...warehouse,
        },
      })
    }
  }
  console.log(`  ✅ ${maintenanceWarehouses.length} bodegas para Mantenimiento`)

  // ============================================
  // BODEGAS PARA SEGURIDAD
  // ============================================

  const securityWarehouses = [
    {
      name: 'Bodega de Equipos de Seguridad',
      location: 'Edificio E - Piso 1',
      description: 'Cámaras, sensores, equipos de control de acceso',
      familyId: securityFamilyId,
      managerId: admin.id,
      isActive: true,
    },
    {
      name: 'Bodega de Equipos de Vigilancia',
      location: 'Edificio E - Piso 1',
      description: 'Equipos de comunicación y vigilancia',
      familyId: securityFamilyId,
      managerId: admin.id,
      isActive: true,
    },
  ]

  for (const warehouse of securityWarehouses) {
    const existing = await prisma.warehouses.findFirst({
      where: {
        name: warehouse.name,
        familyId: warehouse.familyId,
      },
    })

    if (existing) {
      await prisma.warehouses.update({
        where: { id: existing.id },
        data: {
          location: warehouse.location,
          description: warehouse.description,
          managerId: warehouse.managerId,
          isActive: warehouse.isActive,
        },
      })
    } else {
      await prisma.warehouses.create({
        data: {
          id: randomUUID(),
          ...warehouse,
        },
      })
    }
  }
  console.log(`  ✅ ${securityWarehouses.length} bodegas para Seguridad`)

  console.log('✅ Seed de bodegas completado')
}
