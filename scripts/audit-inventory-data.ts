/**
 * Script de Auditoría de Datos de Inventario
 *
 * Valida el estado actual de los datos antes de la migración al modelo robusto
 *
 * Ejecutar: npx tsx scripts/audit-inventory-data.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface AuditResult {
  category: string
  status: 'OK' | 'WARNING' | 'ERROR'
  count: number
  message: string
  details?: any[]
}

const results: AuditResult[] = []

async function auditSerialNumbers() {
  console.log('\n📋 Auditando números de serie...')

  // Equipos sin serial
  const withoutSerial = await prisma.equipment.findMany({
    where: {
      OR: [{ serialNumber: null }, { serialNumber: '' }],
    },
    select: {
      id: true,
      code: true,
      brand: true,
      model: true,
      status: true,
    },
  })

  if (withoutSerial.length > 0) {
    results.push({
      category: 'Serial Numbers',
      status: 'WARNING',
      count: withoutSerial.length,
      message: `${withoutSerial.length} equipos sin número de serie`,
      details: withoutSerial.slice(0, 10), // Primeros 10
    })
  } else {
    results.push({
      category: 'Serial Numbers',
      status: 'OK',
      count: 0,
      message: 'Todos los equipos tienen número de serie',
    })
  }

  // Seriales duplicados
  const duplicateSerials = await prisma.$queryRaw<Array<{ serialNumber: string; count: bigint }>>`
    SELECT serial_number as "serialNumber", COUNT(*) as count
    FROM equipment
    WHERE serial_number IS NOT NULL AND serial_number != ''
    GROUP BY serial_number
    HAVING COUNT(*) > 1
  `

  if (duplicateSerials.length > 0) {
    results.push({
      category: 'Serial Numbers',
      status: 'ERROR',
      count: duplicateSerials.length,
      message: `${duplicateSerials.length} números de serie duplicados`,
      details: duplicateSerials.map(d => ({
        serial: d.serialNumber,
        count: Number(d.count),
      })),
    })
  } else {
    results.push({
      category: 'Serial Numbers',
      status: 'OK',
      count: 0,
      message: 'No hay números de serie duplicados',
    })
  }
}

async function auditBrandModel() {
  console.log('\n📋 Auditando marca y modelo...')

  // Equipos sin brand
  const withoutBrand = await prisma.equipment.count({
    where: {
      OR: [{ brand: null }, { brand: '' }],
    },
  })

  if (withoutBrand > 0) {
    results.push({
      category: 'Brand/Model',
      status: 'ERROR',
      count: withoutBrand,
      message: `${withoutBrand} equipos sin marca`,
    })
  } else {
    results.push({
      category: 'Brand/Model',
      status: 'OK',
      count: 0,
      message: 'Todos los equipos tienen marca',
    })
  }

  // Equipos sin model
  const withoutModel = await prisma.equipment.count({
    where: {
      OR: [{ model: null }, { model: '' }],
    },
  })

  if (withoutModel > 0) {
    results.push({
      category: 'Brand/Model',
      status: 'ERROR',
      count: withoutModel,
      message: `${withoutModel} equipos sin modelo`,
    })
  } else {
    results.push({
      category: 'Brand/Model',
      status: 'OK',
      count: 0,
      message: 'Todos los equipos tienen modelo',
    })
  }

  // Modelos únicos (para crear equipment_models)
  const uniqueModels = await prisma.$queryRaw<
    Array<{ brand: string; model: string; typeId: string; count: bigint }>
  >`
    SELECT brand, model, type_id as "typeId", COUNT(*) as count
    FROM equipment
    WHERE brand IS NOT NULL AND brand != ''
      AND model IS NOT NULL AND model != ''
      AND type_id IS NOT NULL
    GROUP BY brand, model, type_id
    ORDER BY count DESC
  `

  results.push({
    category: 'Brand/Model',
    status: 'OK',
    count: uniqueModels.length,
    message: `${uniqueModels.length} modelos únicos identificados`,
    details: uniqueModels.slice(0, 10).map(m => ({
      brand: m.brand,
      model: m.model,
      instances: Number(m.count),
    })),
  })
}

async function auditEquipmentTypes() {
  console.log('\n📋 Auditando tipos de equipo...')

  // Equipos sin typeId
  const withoutType = await prisma.equipment.count({
    where: {
      typeId: null,
    },
  })

  if (withoutType > 0) {
    results.push({
      category: 'Equipment Types',
      status: 'ERROR',
      count: withoutType,
      message: `${withoutType} equipos sin tipo`,
    })
  } else {
    results.push({
      category: 'Equipment Types',
      status: 'OK',
      count: 0,
      message: 'Todos los equipos tienen tipo',
    })
  }

  // Tipos sin familia
  const typesWithoutFamily = await prisma.equipment_types.count({
    where: {
      familyId: null,
    },
  })

  if (typesWithoutFamily > 0) {
    results.push({
      category: 'Equipment Types',
      status: 'WARNING',
      count: typesWithoutFamily,
      message: `${typesWithoutFamily} tipos sin familia asignada`,
    })
  } else {
    results.push({
      category: 'Equipment Types',
      status: 'OK',
      count: 0,
      message: 'Todos los tipos tienen familia',
    })
  }
}

async function auditCodes() {
  console.log('\n📋 Auditando códigos...')

  // Códigos duplicados
  const duplicateCodes = await prisma.$queryRaw<Array<{ code: string; count: bigint }>>`
    SELECT code, COUNT(*) as count
    FROM equipment
    GROUP BY code
    HAVING COUNT(*) > 1
  `

  if (duplicateCodes.length > 0) {
    results.push({
      category: 'Codes',
      status: 'ERROR',
      count: duplicateCodes.length,
      message: `${duplicateCodes.length} códigos duplicados`,
      details: duplicateCodes,
    })
  } else {
    results.push({
      category: 'Codes',
      status: 'OK',
      count: 0,
      message: 'No hay códigos duplicados',
    })
  }
}

async function auditRelationalIntegrity() {
  console.log('\n📋 Auditando integridad referencial...')

  // Equipos con departmentId inválido
  const invalidDepartments = await prisma.equipment.count({
    where: {
      departmentId: {
        not: null,
      },
      department: null,
    },
  })

  if (invalidDepartments > 0) {
    results.push({
      category: 'Relational Integrity',
      status: 'ERROR',
      count: invalidDepartments,
      message: `${invalidDepartments} equipos con departmentId inválido`,
    })
  } else {
    results.push({
      category: 'Relational Integrity',
      status: 'OK',
      count: 0,
      message: 'Todos los departmentId son válidos',
    })
  }

  // Equipos con supplierId inválido
  const invalidSuppliers = await prisma.equipment.count({
    where: {
      supplierId: {
        not: null,
      },
      supplier: null,
    },
  })

  if (invalidSuppliers > 0) {
    results.push({
      category: 'Relational Integrity',
      status: 'ERROR',
      count: invalidSuppliers,
      message: `${invalidSuppliers} equipos con supplierId inválido`,
    })
  } else {
    results.push({
      category: 'Relational Integrity',
      status: 'OK',
      count: 0,
      message: 'Todos los supplierId son válidos',
    })
  }

  // Equipos con warehouseId inválido
  const invalidWarehouses = await prisma.equipment.count({
    where: {
      warehouseId: {
        not: null,
      },
      warehouse: null,
    },
  })

  if (invalidWarehouses > 0) {
    results.push({
      category: 'Relational Integrity',
      status: 'ERROR',
      count: invalidWarehouses,
      message: `${invalidWarehouses} equipos con warehouseId inválido`,
    })
  } else {
    results.push({
      category: 'Relational Integrity',
      status: 'OK',
      count: 0,
      message: 'Todos los warehouseId son válidos',
    })
  }
}

async function auditStatistics() {
  console.log('\n📊 Estadísticas generales...')

  const totalEquipment = await prisma.equipment.count()

  const byStatus = await prisma.equipment.groupBy({
    by: ['status'],
    _count: true,
  })

  const byCondition = await prisma.equipment.groupBy({
    by: ['condition'],
    _count: true,
  })

  results.push({
    category: 'Statistics',
    status: 'OK',
    count: totalEquipment,
    message: `Total de equipos: ${totalEquipment}`,
    details: {
      byStatus: byStatus.map(s => ({ status: s.status, count: s._count })),
      byCondition: byCondition.map(c => ({ condition: c.condition, count: c._count })),
    },
  })
}

function printResults() {
  console.log('\n' + '='.repeat(80))
  console.log('📊 RESUMEN DE AUDITORÍA')
  console.log('='.repeat(80))

  const errors = results.filter(r => r.status === 'ERROR')
  const warnings = results.filter(r => r.status === 'WARNING')
  const ok = results.filter(r => r.status === 'OK')

  console.log(`\n✅ OK: ${ok.length}`)
  console.log(`⚠️  WARNINGS: ${warnings.length}`)
  console.log(`❌ ERRORS: ${errors.length}`)

  console.log('\n' + '-'.repeat(80))

  for (const result of results) {
    const icon = result.status === 'OK' ? '✅' : result.status === 'WARNING' ? '⚠️' : '❌'
    console.log(`\n${icon} [${result.category}] ${result.message}`)

    if (result.details && result.details.length > 0) {
      console.log('   Detalles:')
      console.log('   ' + JSON.stringify(result.details, null, 2).split('\n').join('\n   '))
    }
  }

  console.log('\n' + '='.repeat(80))

  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ LISTO PARA MIGRACIÓN')
    console.log('   No se encontraron problemas críticos.')
  } else if (errors.length === 0) {
    console.log('⚠️  LISTO CON ADVERTENCIAS')
    console.log(`   Se encontraron ${warnings.length} advertencias que deberían revisarse.`)
  } else {
    console.log('❌ NO LISTO PARA MIGRACIÓN')
    console.log(`   Se encontraron ${errors.length} errores que deben corregirse antes de migrar.`)
    console.log('\n   Acciones recomendadas:')

    if (results.some(r => r.category === 'Serial Numbers' && r.status === 'WARNING')) {
      console.log('   1. Ejecutar: npm run migrate:assign-serials')
    }

    if (results.some(r => r.category === 'Brand/Model' && r.status === 'ERROR')) {
      console.log('   2. Revisar y completar marca/modelo manualmente')
    }

    if (results.some(r => r.category === 'Codes' && r.status === 'ERROR')) {
      console.log('   3. Resolver códigos duplicados')
    }

    if (results.some(r => r.category === 'Relational Integrity' && r.status === 'ERROR')) {
      console.log('   4. Corregir referencias inválidas')
    }
  }

  console.log('='.repeat(80) + '\n')
}

async function main() {
  console.log('🔍 Iniciando auditoría de datos de inventario...')
  console.log('Fecha:', new Date().toISOString())

  try {
    await auditSerialNumbers()
    await auditBrandModel()
    await auditEquipmentTypes()
    await auditCodes()
    await auditRelationalIntegrity()
    await auditStatistics()

    printResults()

    // Guardar resultados en archivo JSON
    const fs = await import('fs')
    const path = await import('path')
    const outputPath = path.join(__dirname, '../backups', `audit-${Date.now()}.json`)

    fs.writeFileSync(
      outputPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          results,
        },
        null,
        2
      )
    )

    console.log(`📄 Resultados guardados en: ${outputPath}`)
  } catch (error) {
    console.error('❌ Error durante la auditoría:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
