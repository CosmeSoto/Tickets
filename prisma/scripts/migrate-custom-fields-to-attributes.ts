/**
 * Script: Migración de family_custom_fields a type_attributes
 * 
 * Este script migra los custom fields de familias a atributos específicos por tipo.
 * Detecta automáticamente el tipo de asset (equipment/license/consumable) basándose
 * en los tipos existentes en cada familia.
 * 
 * Uso:
 *   npm run migrate:custom-fields              # Ejecutar migración
 *   npm run migrate:custom-fields -- --dry-run # Simular sin cambios
 *   npm run migrate:custom-fields -- --rollback # Revertir migración
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface MigrationReport {
  timestamp: string
  mode: 'dry-run' | 'execute' | 'rollback'
  familiesProcessed: number
  customFieldsMigrated: number
  attributesCreated: {
    equipment: number
    license: number
    consumable: number
  }
  errors: Array<{ family: string; field: string; error: string }>
  details: Array<{
    familyId: string
    familyName: string
    customFields: number
    equipmentTypes: number
    licenseTypes: number
    consumableTypes: number
    attributesCreated: number
  }>
}

const report: MigrationReport = {
  timestamp: new Date().toISOString(),
  mode: 'execute',
  familiesProcessed: 0,
  customFieldsMigrated: 0,
  attributesCreated: {
    equipment: 0,
    license: 0,
    consumable: 0,
  },
  errors: [],
  details: [],
}

/**
 * Detectar el tipo de asset basándose en el nombre del campo
 */
function detectAssetType(fieldName: string): 'equipment' | 'license' | 'consumable' | 'all' {
  const lower = fieldName.toLowerCase()

  // Campos específicos de equipos
  if (
    lower.includes('serial') ||
    lower.includes('modelo') ||
    lower.includes('marca') ||
    lower.includes('procesador') ||
    lower.includes('ram') ||
    lower.includes('disco') ||
    lower.includes('pantalla')
  ) {
    return 'equipment'
  }

  // Campos específicos de licencias
  if (
    lower.includes('licencia') ||
    lower.includes('license') ||
    lower.includes('key') ||
    lower.includes('clave') ||
    lower.includes('activacion') ||
    lower.includes('usuario') ||
    lower.includes('seats')
  ) {
    return 'license'
  }

  // Campos específicos de consumibles
  if (
    lower.includes('unidad') ||
    lower.includes('stock') ||
    lower.includes('lote') ||
    lower.includes('vencimiento') ||
    lower.includes('expiracion')
  ) {
    return 'consumable'
  }

  // Campo genérico - aplicar a todos los tipos
  return 'all'
}

/**
 * Transformar opciones de custom field a formato de atributos
 */
function transformOptions(fieldOptions: any, fieldType: string): any {
  if (fieldType !== 'select' || !fieldOptions) {
    return null
  }

  // Si ya es un array, retornar como objeto con propiedad options
  if (Array.isArray(fieldOptions)) {
    return { options: fieldOptions }
  }

  // Si es un objeto con propiedad options, retornar tal cual
  if (fieldOptions.options && Array.isArray(fieldOptions.options)) {
    return fieldOptions
  }

  // Intentar extraer opciones de otras estructuras
  return { options: [] }
}

/**
 * Migrar custom fields de una familia
 */
async function migrateFamilyCustomFields(
  familyId: string,
  familyName: string,
  dryRun: boolean
): Promise<void> {
  console.log(`\n📦 Procesando familia: ${familyName} (${familyId})`)

  // Obtener custom fields de la familia
  const customFields = await prisma.family_custom_fields.findMany({
    where: { familyId },
    orderBy: { order: 'asc' },
  })

  if (customFields.length === 0) {
    console.log('  ℹ️  No hay custom fields para migrar')
    return
  }

  // Obtener tipos existentes en la familia
  const [equipmentTypes, licenseTypes, consumableTypes] = await Promise.all([
    prisma.equipment_types.findMany({ where: { familyId } }),
    prisma.license_types.findMany({ where: { familyId } }),
    prisma.consumable_types.findMany({ where: { familyId } }),
  ])

  console.log(`  📊 Tipos encontrados:`)
  console.log(`     - Equipos: ${equipmentTypes.length}`)
  console.log(`     - Licencias: ${licenseTypes.length}`)
  console.log(`     - Consumibles: ${consumableTypes.length}`)

  let attributesCreated = 0

  // Migrar cada custom field
  for (const field of customFields) {
    console.log(`\n  🔄 Migrando campo: ${field.fieldLabel} (${field.fieldName})`)

    const assetType = detectAssetType(field.fieldName)
    console.log(`     Tipo detectado: ${assetType}`)

    const attributeData = {
      attributeName: field.fieldName,
      attributeLabel: field.fieldLabel,
      attributeType: field.fieldType,
      options: transformOptions(field.fieldOptions, field.fieldType),
      isRequired: field.isRequired,
      isVisible: true, // Por defecto visible
      order: field.order,
      helpText: field.helpText,
    }

    try {
      // Migrar a equipment_type_attributes
      if ((assetType === 'equipment' || assetType === 'all') && equipmentTypes.length > 0) {
        for (const type of equipmentTypes) {
          if (!dryRun) {
            // Verificar si ya existe
            const existing = await prisma.equipment_type_attributes.findFirst({
              where: {
                equipmentTypeId: type.id,
                attributeName: field.fieldName,
              },
            })

            if (!existing) {
              await prisma.equipment_type_attributes.create({
                data: {
                  ...attributeData,
                  equipmentTypeId: type.id,
                },
              })
              attributesCreated++
              report.attributesCreated.equipment++
            } else {
              console.log(`     ⚠️  Ya existe en tipo de equipo: ${type.name}`)
            }
          } else {
            console.log(`     [DRY-RUN] Crearía atributo en tipo de equipo: ${type.name}`)
            attributesCreated++
          }
        }
      }

      // Migrar a license_type_attributes
      if ((assetType === 'license' || assetType === 'all') && licenseTypes.length > 0) {
        for (const type of licenseTypes) {
          if (!dryRun) {
            const existing = await prisma.license_type_attributes.findFirst({
              where: {
                licenseTypeId: type.id,
                attributeName: field.fieldName,
              },
            })

            if (!existing) {
              await prisma.license_type_attributes.create({
                data: {
                  ...attributeData,
                  licenseTypeId: type.id,
                },
              })
              attributesCreated++
              report.attributesCreated.license++
            } else {
              console.log(`     ⚠️  Ya existe en tipo de licencia: ${type.name}`)
            }
          } else {
            console.log(`     [DRY-RUN] Crearía atributo en tipo de licencia: ${type.name}`)
            attributesCreated++
          }
        }
      }

      // Migrar a consumable_type_attributes
      if ((assetType === 'consumable' || assetType === 'all') && consumableTypes.length > 0) {
        for (const type of consumableTypes) {
          if (!dryRun) {
            const existing = await prisma.consumable_type_attributes.findFirst({
              where: {
                consumableTypeId: type.id,
                attributeName: field.fieldName,
              },
            })

            if (!existing) {
              await prisma.consumable_type_attributes.create({
                data: {
                  ...attributeData,
                  consumableTypeId: type.id,
                },
              })
              attributesCreated++
              report.attributesCreated.consumable++
            } else {
              console.log(`     ⚠️  Ya existe en tipo de consumible: ${type.name}`)
            }
          } else {
            console.log(`     [DRY-RUN] Crearía atributo en tipo de consumible: ${type.name}`)
            attributesCreated++
          }
        }
      }

      console.log(`     ✅ Migrado exitosamente`)
      report.customFieldsMigrated++
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido'
      console.error(`     ❌ Error: ${errorMsg}`)
      report.errors.push({
        family: familyName,
        field: field.fieldName,
        error: errorMsg,
      })
    }
  }

  report.details.push({
    familyId,
    familyName,
    customFields: customFields.length,
    equipmentTypes: equipmentTypes.length,
    licenseTypes: licenseTypes.length,
    consumableTypes: consumableTypes.length,
    attributesCreated,
  })

  report.familiesProcessed++
}

/**
 * Rollback: Eliminar atributos migrados
 */
async function rollbackMigration(): Promise<void> {
  console.log('\n🔄 ROLLBACK: Eliminando atributos migrados...\n')

  const [equipmentCount, licenseCount, consumableCount] = await Promise.all([
    prisma.equipment_type_attributes.deleteMany({}),
    prisma.license_type_attributes.deleteMany({}),
    prisma.consumable_type_attributes.deleteMany({}),
  ])

  console.log(`✅ Rollback completado:`)
  console.log(`   - Atributos de equipos eliminados: ${equipmentCount.count}`)
  console.log(`   - Atributos de licencias eliminados: ${licenseCount.count}`)
  console.log(`   - Atributos de consumibles eliminados: ${consumableCount.count}`)
}

/**
 * Guardar reporte en archivo JSON
 */
function saveReport(): void {
  const backupsDir = path.join(__dirname, '../../backups')
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true })
  }

  const filename = `migration-custom-fields-${Date.now()}.json`
  const filepath = path.join(backupsDir, filename)

  fs.writeFileSync(filepath, JSON.stringify(report, null, 2))
  console.log(`\n📄 Reporte guardado en: ${filepath}`)
}

/**
 * Main
 */
async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const rollback = args.includes('--rollback')

  if (rollback) {
    report.mode = 'rollback'
    await rollbackMigration()
    saveReport()
    return
  }

  if (dryRun) {
    report.mode = 'dry-run'
    console.log('\n🔍 MODO DRY-RUN: No se realizarán cambios en la base de datos\n')
  } else {
    console.log('\n🚀 INICIANDO MIGRACIÓN DE CUSTOM FIELDS\n')
  }

  // Obtener todas las familias con custom fields
  const families = await prisma.families.findMany({
    where: {
      customFields: {
        some: {},
      },
    },
    include: {
      customFields: true,
    },
  })

  console.log(`📊 Familias con custom fields: ${families.length}`)

  // Migrar cada familia
  for (const family of families) {
    await migrateFamilyCustomFields(family.id, family.name, dryRun)
  }

  // Resumen
  console.log('\n' + '='.repeat(60))
  console.log('📊 RESUMEN DE MIGRACIÓN')
  console.log('='.repeat(60))
  console.log(`Modo: ${report.mode}`)
  console.log(`Familias procesadas: ${report.familiesProcessed}`)
  console.log(`Custom fields migrados: ${report.customFieldsMigrated}`)
  console.log(`Atributos creados:`)
  console.log(`  - Equipos: ${report.attributesCreated.equipment}`)
  console.log(`  - Licencias: ${report.attributesCreated.license}`)
  console.log(`  - Consumibles: ${report.attributesCreated.consumable}`)
  console.log(`  - Total: ${Object.values(report.attributesCreated).reduce((a, b) => a + b, 0)}`)
  console.log(`Errores: ${report.errors.length}`)

  if (report.errors.length > 0) {
    console.log('\n❌ ERRORES:')
    report.errors.forEach(err => {
      console.log(`  - ${err.family} / ${err.field}: ${err.error}`)
    })
  }

  saveReport()

  if (dryRun) {
    console.log('\n✅ Dry-run completado. Ejecuta sin --dry-run para aplicar cambios.')
  } else {
    console.log('\n✅ Migración completada exitosamente.')
    console.log('\n⚠️  IMPORTANTE: Revisa el reporte antes de eliminar family_custom_fields')
  }
}

main()
  .catch(error => {
    console.error('\n❌ Error fatal:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
