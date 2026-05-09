/**
 * Script para limpiar atributos duplicados
 * Elimina atributos duplicados manteniendo solo el más reciente
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanDuplicateAttributes() {
  console.log('🧹 Limpiando atributos duplicados...\n')

  try {
    // Limpiar equipment_type_attributes
    console.log('📦 Limpiando equipment_type_attributes...')
    const equipmentTypes = await prisma.equipment_types.findMany({
      select: { id: true, name: true },
    })

    for (const type of equipmentTypes) {
      const attributes = await prisma.equipment_type_attributes.findMany({
        where: { equipmentTypeId: type.id },
        orderBy: { createdAt: 'desc' },
      })

      // Agrupar por attributeName
      const grouped = new Map<string, typeof attributes>()
      for (const attr of attributes) {
        if (!grouped.has(attr.attributeName)) {
          grouped.set(attr.attributeName, [])
        }
        grouped.get(attr.attributeName)!.push(attr)
      }

      // Eliminar duplicados (mantener el más reciente)
      for (const [name, attrs] of grouped.entries()) {
        if (attrs.length > 1) {
          const toDelete = attrs.slice(1) // Mantener el primero (más reciente)
          console.log(
            `  ⚠️  ${type.name}: Eliminando ${toDelete.length} duplicados de "${name}"`
          )
          await prisma.equipment_type_attributes.deleteMany({
            where: {
              id: { in: toDelete.map(a => a.id) },
            },
          })
        }
      }
    }

    // Limpiar license_type_attributes
    console.log('\n📜 Limpiando license_type_attributes...')
    const licenseTypes = await prisma.license_types.findMany({
      select: { id: true, name: true },
    })

    for (const type of licenseTypes) {
      const attributes = await prisma.license_type_attributes.findMany({
        where: { licenseTypeId: type.id },
        orderBy: { createdAt: 'desc' },
      })

      const grouped = new Map<string, typeof attributes>()
      for (const attr of attributes) {
        if (!grouped.has(attr.attributeName)) {
          grouped.set(attr.attributeName, [])
        }
        grouped.get(attr.attributeName)!.push(attr)
      }

      for (const [name, attrs] of grouped.entries()) {
        if (attrs.length > 1) {
          const toDelete = attrs.slice(1)
          console.log(
            `  ⚠️  ${type.name}: Eliminando ${toDelete.length} duplicados de "${name}"`
          )
          await prisma.license_type_attributes.deleteMany({
            where: {
              id: { in: toDelete.map(a => a.id) },
            },
          })
        }
      }
    }

    // Limpiar consumable_type_attributes
    console.log('\n🧴 Limpiando consumable_type_attributes...')
    const consumableTypes = await prisma.consumable_types.findMany({
      select: { id: true, name: true },
    })

    for (const type of consumableTypes) {
      const attributes = await prisma.consumable_type_attributes.findMany({
        where: { consumableTypeId: type.id },
        orderBy: { createdAt: 'desc' },
      })

      const grouped = new Map<string, typeof attributes>()
      for (const attr of attributes) {
        if (!grouped.has(attr.attributeName)) {
          grouped.set(attr.attributeName, [])
        }
        grouped.get(attr.attributeName)!.push(attr)
      }

      for (const [name, attrs] of grouped.entries()) {
        if (attrs.length > 1) {
          const toDelete = attrs.slice(1)
          console.log(
            `  ⚠️  ${type.name}: Eliminando ${toDelete.length} duplicados de "${name}"`
          )
          await prisma.consumable_type_attributes.deleteMany({
            where: {
              id: { in: toDelete.map(a => a.id) },
            },
          })
        }
      }
    }

    console.log('\n✅ Limpieza completada exitosamente')
  } catch (error) {
    console.error('❌ Error durante la limpieza:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

cleanDuplicateAttributes()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
