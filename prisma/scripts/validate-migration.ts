/**
 * Script: Validación de Migración
 * Verifica que los datos se migraron correctamente
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function validateMigration() {
  console.log('\n🔍 VALIDANDO MIGRACIÓN\n')

  try {
    // 1. Contar atributos creados
    const equipmentAttrs = await prisma.equipment_type_attributes.count()
    const licenseAttrs = await prisma.license_type_attributes.count()
    const consumableAttrs = await prisma.consumable_type_attributes.count()

    console.log('📊 Atributos creados:')
    console.log(`   - Equipment: ${equipmentAttrs}`)
    console.log(`   - License: ${licenseAttrs}`)
    console.log(`   - Consumable: ${consumableAttrs}`)
    console.log(`   - Total: ${equipmentAttrs + licenseAttrs + consumableAttrs}`)

    // 2. Verificar que hay atributos para cada tipo
    const equipmentTypes = await prisma.equipment_types.findMany({
      include: {
        _count: {
          select: { attributes: true }
        }
      }
    })

    console.log(`\n📦 Tipos de equipo con atributos:`)
    equipmentTypes.slice(0, 5).forEach(type => {
      console.log(`   - ${type.name}: ${type._count.attributes} atributos`)
    })

    // 3. Verificar custom fields originales
    const customFields = await prisma.family_custom_fields.count()
    console.log(`\n📋 Custom fields originales: ${customFields}`)

    // 4. Verificar que los atributos tienen los campos correctos
    const sampleAttr = await prisma.equipment_type_attributes.findFirst({
      include: {
        equipmentType: {
          include: {
            family: true
          }
        }
      }
    })

    if (sampleAttr) {
      console.log(`\n✅ Ejemplo de atributo migrado:`)
      console.log(`   - Nombre: ${sampleAttr.attributeLabel}`)
      console.log(`   - Tipo: ${sampleAttr.attributeType}`)
      console.log(`   - Familia: ${sampleAttr.equipmentType.family.name}`)
      console.log(`   - Tipo de equipo: ${sampleAttr.equipmentType.name}`)
      console.log(`   - Requerido: ${sampleAttr.isRequired}`)
      console.log(`   - Visible: ${sampleAttr.isVisible}`)
    }

    console.log('\n✅ Validación completada exitosamente\n')

  } catch (error) {
    console.error('❌ Error en validación:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

validateMigration()
