/**
 * Script para Asignar Seriales Temporales
 *
 * Asigna números de serie temporales a equipos que no tienen
 * Formato: TEMP-{code}
 *
 * Ejecutar: npx tsx scripts/assign-temp-serials.ts
 */

import { PrismaClient } from '@prisma/client'
import * as readline from 'readline'

const prisma = new PrismaClient()

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function question(query: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(query, resolve)
  })
}

async function main() {
  console.log('🔧 Script de Asignación de Seriales Temporales')
  console.log('='.repeat(80))

  try {
    // 1. Contar equipos sin serial
    const withoutSerial = await prisma.equipment.findMany({
      where: {
        serialNumber: '',
      },
      select: {
        id: true,
        code: true,
        brand: true,
        model: true,
        status: true,
      },
    })

    if (withoutSerial.length === 0) {
      console.log('✅ Todos los equipos ya tienen número de serie.')
      console.log('   No se requiere ninguna acción.')
      return
    }

    console.log(`\n⚠️  Se encontraron ${withoutSerial.length} equipos sin número de serie:`)
    console.log('\nPrimeros 10 equipos:')
    withoutSerial.slice(0, 10).forEach((eq, idx) => {
      console.log(`   ${idx + 1}. ${eq.code} - ${eq.brand} ${eq.model} (${eq.status})`)
    })

    if (withoutSerial.length > 10) {
      console.log(`   ... y ${withoutSerial.length - 10} más`)
    }

    console.log('\n📝 Acción propuesta:')
    console.log('   Asignar serial temporal con formato: TEMP-{code}')
    console.log('   Ejemplo: TEMP-TECH-LAP-OWN-2024-0001')
    console.log('\n⚠️  IMPORTANTE:')
    console.log('   - Los seriales temporales pueden ser reemplazados después')
    console.log('   - Se recomienda actualizar con seriales reales cuando estén disponibles')
    console.log('   - Esta operación es necesaria para la migración al modelo robusto')

    const answer = await question('\n¿Deseas continuar? (si/no): ')

    if (answer.toLowerCase() !== 'si' && answer.toLowerCase() !== 's') {
      console.log('\n❌ Operación cancelada por el usuario.')
      return
    }

    console.log('\n🔄 Asignando seriales temporales...')

    let updated = 0
    let errors = 0

    for (const equipment of withoutSerial) {
      try {
        const tempSerial = `TEMP-${equipment.code}`

        await prisma.equipment.update({
          where: { id: equipment.id },
          data: { serialNumber: tempSerial },
        })

        updated++

        if (updated % 10 === 0) {
          console.log(`   Procesados: ${updated}/${withoutSerial.length}`)
        }
      } catch (error: any) {
        console.error(`   ❌ Error en ${equipment.code}:`, error.message)
        errors++
      }
    }

    console.log('\n' + '='.repeat(80))
    console.log('📊 RESUMEN')
    console.log('='.repeat(80))
    console.log(`✅ Actualizados: ${updated}`)
    console.log(`❌ Errores: ${errors}`)
    console.log(`📝 Total procesados: ${withoutSerial.length}`)

    if (errors === 0) {
      console.log('\n✅ Todos los equipos ahora tienen número de serie.')
      console.log('   Puedes proceder con la auditoría y migración.')
    } else {
      console.log('\n⚠️  Algunos equipos no pudieron ser actualizados.')
      console.log('   Revisa los errores y vuelve a ejecutar el script.')
    }

    // Verificar que no haya duplicados
    console.log('\n🔍 Verificando duplicados...')
    const duplicates = await prisma.$queryRaw<Array<{ serialNumber: string; count: bigint }>>`
      SELECT serial_number as "serialNumber", COUNT(*) as count
      FROM equipment
      WHERE serial_number IS NOT NULL AND serial_number != ''
      GROUP BY serial_number
      HAVING COUNT(*) > 1
    `

    if (duplicates.length > 0) {
      console.log(`\n⚠️  Se encontraron ${duplicates.length} seriales duplicados:`)
      duplicates.forEach(d => {
        console.log(`   - ${d.serialNumber}: ${d.count} veces`)
      })
      console.log('\n   Debes resolver estos duplicados antes de migrar.')
    } else {
      console.log('✅ No hay seriales duplicados.')
    }

    console.log('='.repeat(80) + '\n')
  } catch (error) {
    console.error('❌ Error durante la asignación:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
    rl.close()
  }
}

main()
