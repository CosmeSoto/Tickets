import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

type WarehouseSeed = {
  name: string
  location: string
  description: string
  familyId: string
  managerId: string
  isActive: boolean
}

async function upsertWarehouses(prisma: PrismaClient, warehouses: WarehouseSeed[]) {
  for (const warehouse of warehouses) {
    const existing = await prisma.warehouses.findFirst({
      where: { name: warehouse.name, familyId: warehouse.familyId },
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
        data: { id: randomUUID(), ...warehouse },
      })
    }
  }
}

/**
 * Bodegas por familia (organigrama PSF).
 * Solo TECHNOLOGY, ARCHITECTURE y OPERATIONS manejan inventario físico.
 */
export async function seedWarehouses(prisma: PrismaClient, familyMap: Map<string, string>) {
  console.log('🏢 Seeding bodegas por familia...')

  const techFamilyId = familyMap.get('TECHNOLOGY')!
  const architectureFamilyId = familyMap.get('ARCHITECTURE')!
  const operationsFamilyId = familyMap.get('OPERATIONS')!

  const admin = await prisma.users.findFirst({
    where: { email: 'internet.freecom@gmail.com' },
  })

  if (!admin) {
    console.log('⚠️  No se encontró usuario admin, saltando seed de bodegas')
    return
  }

  const base = { managerId: admin.id, isActive: true }

  const techWarehouses: WarehouseSeed[] = [
    {
      name: 'Bodega TI Principal',
      location: 'Edificio A - Piso 2 - Sala 201',
      description: 'Equipos tecnológicos y hardware',
      familyId: techFamilyId,
      ...base,
    },
    {
      name: 'Bodega de Equipos en Reparación',
      location: 'Edificio A - Piso 1 - Taller',
      description: 'Equipos en reparación o mantenimiento',
      familyId: techFamilyId,
      ...base,
    },
    {
      name: 'Bodega de Equipos Obsoletos',
      location: 'Edificio C - Sótano',
      description: 'Equipos dados de baja pendientes de disposición',
      familyId: techFamilyId,
      ...base,
    },
  ]

  const architectureWarehouses: WarehouseSeed[] = [
    {
      name: 'Bodega de Mobiliario',
      location: 'Edificio B - Piso 1',
      description: 'Mobiliario de oficina y muebles',
      familyId: architectureFamilyId,
      ...base,
    },
    {
      name: 'Bodega de Planos y Materiales',
      location: 'Edificio B - Piso 2',
      description: 'Planos, maquetas y materiales de arquitectura',
      familyId: architectureFamilyId,
      ...base,
    },
  ]

  const operationsWarehouses: WarehouseSeed[] = [
    {
      name: 'Bodega de Repuestos Eléctricos',
      location: 'Edificio D - Piso 1',
      description: 'Repuestos y materiales eléctricos',
      familyId: operationsFamilyId,
      ...base,
    },
    {
      name: 'Bodega de Repuestos Mecánicos',
      location: 'Edificio D - Piso 1',
      description: 'Repuestos y materiales mecánicos',
      familyId: operationsFamilyId,
      ...base,
    },
    {
      name: 'Bodega de Materiales de Construcción',
      location: 'Edificio D - Exterior',
      description: 'Materiales para obras civiles',
      familyId: operationsFamilyId,
      ...base,
    },
    {
      name: 'Bodega de Herramientas de Mantenimiento',
      location: 'Edificio D - Taller',
      description: 'Herramientas especializadas de mantenimiento',
      familyId: operationsFamilyId,
      ...base,
    },
    {
      name: 'Bodega de Equipos de Seguridad',
      location: 'Edificio E - Piso 1',
      description: 'Cámaras, sensores y control de acceso',
      familyId: operationsFamilyId,
      ...base,
    },
    {
      name: 'Bodega de Suministros de Limpieza',
      location: 'Edificio D - Bodega 2',
      description: 'Productos de limpieza e higiene',
      familyId: operationsFamilyId,
      ...base,
    },
  ]

  await upsertWarehouses(prisma, techWarehouses)
  console.log(`  ✅ ${techWarehouses.length} bodegas — Tecnología y Comunicaciones`)

  await upsertWarehouses(prisma, architectureWarehouses)
  console.log(`  ✅ ${architectureWarehouses.length} bodegas — Arquitectura`)

  await upsertWarehouses(prisma, operationsWarehouses)
  console.log(`  ✅ ${operationsWarehouses.length} bodegas — Operaciones`)

  const inventoryFamilies = [techFamilyId, architectureFamilyId, operationsFamilyId]
  let receptionCount = 0

  for (const familyId of inventoryFamilies) {
    const existing = await prisma.warehouses.findFirst({
      where: { name: 'Recepción Compras', familyId },
    })
    if (!existing) {
      await prisma.warehouses.create({
        data: {
          id: randomUUID(),
          name: 'Recepción Compras',
          location: 'Área de recepción — Depto. Compras',
          description: 'Bodega transitoria antes de distribuir a la bodega definitiva',
          familyId,
          managerId: admin.id,
          isActive: true,
        },
      })
      receptionCount++
    }
  }

  if (receptionCount > 0) {
    console.log(`  ✅ ${receptionCount} bodegas "Recepción Compras" creadas`)
  }

  console.log('✅ Seed de bodegas completado')
}
