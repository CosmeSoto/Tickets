const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function verify() {
  console.log('🔍 Verificando datos de inventario...\n')

  try {
    // Verificar equipos
    const equipmentCount = await prisma.equipment.count()
    console.log(`✅ Equipos: ${equipmentCount} registros`)
    
    if (equipmentCount > 0) {
      const equipment = await prisma.equipment.findMany({
        select: { code: true, brand: true, model: true, type: true, status: true }
      })
      equipment.forEach(e => {
        console.log(`   - ${e.code}: ${e.brand} ${e.model} (${e.type}) - ${e.status}`)
      })
    }

    // Verificar consumibles
    const consumablesCount = await prisma.consumables.count()
    console.log(`\n✅ Consumibles: ${consumablesCount} registros`)
    
    if (consumablesCount > 0) {
      const consumables = await prisma.consumables.findMany({
        select: { name: true, type: true, currentStock: true, minStock: true }
      })
      consumables.forEach(c => {
        console.log(`   - ${c.name} (${c.type}): Stock ${c.currentStock}/${c.minStock}`)
      })
    }

    // Verificar licencias
    const licensesCount = await prisma.software_licenses.count()
    console.log(`\n✅ Licencias: ${licensesCount} registros`)
    
    if (licensesCount > 0) {
      const licenses = await prisma.software_licenses.findMany({
        select: { name: true, type: true, expirationDate: true }
      })
      licenses.forEach(l => {
        const expiry = l.expirationDate ? l.expirationDate.toISOString().split('T')[0] : 'Perpetua'
        console.log(`   - ${l.name} (${l.type}): Expira ${expiry}`)
      })
    }

    // Verificar contadores de folio
    const folioCounters = await prisma.folio_counters.findMany()
    console.log(`\n✅ Contadores de folio: ${folioCounters.length} registros`)
    folioCounters.forEach(f => {
      console.log(`   - ${f.type}-${f.year}: Último número ${f.lastNumber}`)
    })

    console.log('\n🎉 Verificación completada exitosamente!')
    console.log('📦 El módulo de inventario está listo para usar.')
    
  } catch (error) {
    console.error('❌ Error durante la verificación:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

verify()
