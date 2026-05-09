/**
 * Script: Migración de units_of_measure a consumable_type_attributes
 * 
 * Este script migra las unidades de medida a atributos de tipo select
 * en cada tipo de consumible.
 * 
 * Uso:
 *   npm run migrate:units              # Ejecutar migración
 *   npm run migrate:units -- --dry-run # Simular sin cambios
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface MigrationReport {
  timestamp: string
  mode: 'dry-run' | 'execute'
  consumableTypesProcessed: number
  attributesCreated: number
  unitsFound: number
  errors: Array<{ type: string; error: string }>
  details: Array<{
    typeId: string
    typeName: string
    unitsUsed: string[]
    attributeCreated: boolean
  }>
}

const report: MigrationReport = {
  timestamp: new Date().toISOString(),
  mode: 'execute',
  consumableTypesProcessed: 0,
  attributesCreated: 0,
  unitsFound: 0,
  errors: [],
  details: [],
}

/**
 * Obtener unidades únicas usadas por un tipo de consumible
 */
async function getUnitsForType(typeId: string): Promise<string[]> {
  const consumables = await prisma.consumables.findMany({
    where: {
      consumableTypeId: typeId,
      unitOfMeasureId: { not: null },
    },
    include: {
      unitOfMeasure: true,
    },
  })

  const units = new Set<string>()
  consumables.forEach(c => {
    if (c.unitOfMeasure) {
      units.add(c.unitOfMeasure.name)
    }
  })

  return Array.from(units).sort()
}

/**
 * Migrar unidades de un tipo de consumible
 */
async function migrateConsumableTypeUnits(
  typeId: string,
  typeName: string,
  dryRun: boolean
): Promise<void> {
  console.log(`\n📦 Procesando tipo: ${typeName} (${typeId})`)

  // Obtener unidades usadas
  const units = await getUnitsForType(typeId)

  if (units.length === 0) {
    console.log('  ℹ️  No hay unidades de medida en uso')
    report.details.push({
      typeId,
      typeName,
      unitsUsed: [],
      attributeCreated: false,
    })
    return
  }

  console.log(`  📊 Unidades encontradas: ${units.join(', ')}`)
  report.unitsFound += units.length

  try {
    if (!dryRun) {
      // Verificar si ya existe el atributo
      const existing = await prisma.consumable_type_attributes.findFirst({
        where: {
          consumableTypeId: typeId,
          attributeName: 'unidad_medida',
        },
      })

      if (existing) {
        console.log('  ⚠️  El atributo "unidad_medida" ya existe')
        report.details.push({
          typeId,
          typeName,
          unitsUsed: units,
          attributeCreated: false,
        })
        return
      }

      // Crear atributo
      await prisma.consumable_type_attributes.create({
        data: {
          consumableTypeId: typeId,
          attributeName: 'unidad_medida',
          attributeLabel: 'Unidad de Medida',
          attributeType: 'select',
          options: { options: units },
          isRequired: true,
          isVisible: true,
          order: 0,
          helpText: 'Unidad de medida del consumible',
        },
      })

      console.log('  ✅ Atributo creado exitosamente')
      report.attributesCreated++
    } else {
      console.log(`  [DRY-RUN] Crearía atributo "unidad_medida" con opciones: ${units.join(', ')}`)
    }

    report.details.push({
      typeId,
      typeName,
      unitsUsed: units,
      attributeCreated: true,
    })

    report.consumableTypesProcessed++
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Error desconocido'
    console.error(`  ❌ Error: ${errorMsg}`)
    report.errors.push({
      type: typeName,
      error: errorMsg,
    })
  }
}

/**
 * Guardar reporte en archivo JSON
 */
function saveReport(): void {
  const backupsDir = path.join(__dirname, '../../backups')
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true })
  }

  const filename = `migration-units-${Date.now()}.json`
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

  if (dryRun) {
    report.mode = 'dry-run'
    console.log('\n🔍 MODO DRY-RUN: No se realizarán cambios en la base de datos\n')
  } else {
    console.log('\n🚀 INICIANDO MIGRACIÓN DE UNIDADES DE MEDIDA\n')
  }

  // Obtener todos los tipos de consumibles
  const consumableTypes = await prisma.consumable_types.findMany({
    orderBy: { name: 'asc' },
  })

  console.log(`📊 Tipos de consumibles: ${consumableTypes.length}`)

  // Migrar cada tipo
  for (const type of consumableTypes) {
    await migrateConsumableTypeUnits(type.id, type.name, dryRun)
  }

  // Resumen
  console.log('\n' + '='.repeat(60))
  console.log('📊 RESUMEN DE MIGRACIÓN')
  console.log('='.repeat(60))
  console.log(`Modo: ${report.mode}`)
  console.log(`Tipos de consumibles procesados: ${report.consumableTypesProcessed}`)
  console.log(`Unidades encontradas: ${report.unitsFound}`)
  console.log(`Atributos creados: ${report.attributesCreated}`)
  console.log(`Errores: ${report.errors.length}`)

  if (report.errors.length > 0) {
    console.log('\n❌ ERRORES:')
    report.errors.forEach(err => {
      console.log(`  - ${err.type}: ${err.error}`)
    })
  }

  saveReport()

  if (dryRun) {
    console.log('\n✅ Dry-run completado. Ejecuta sin --dry-run para aplicar cambios.')
  } else {
    console.log('\n✅ Migración completada exitosamente.')
    console.log('\n⚠️  IMPORTANTE: Revisa el reporte antes de eliminar units_of_measure')
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
