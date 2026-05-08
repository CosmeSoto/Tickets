/**
 * Script para corregir el orden de los campos personalizados
 * Ejecutar con: npx tsx prisma/fix-custom-fields-order.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Corrigiendo orden de campos personalizados...')

  // Obtener todas las familias
  const families = await prisma.families.findMany({
    select: { id: true, name: true },
  })

  for (const family of families) {
    // Obtener campos de esta familia ordenados por createdAt
    const fields = await prisma.family_custom_fields.findMany({
      where: { familyId: family.id },
      orderBy: { createdAt: 'asc' },
    })

    if (fields.length === 0) continue

    console.log(`\n📋 Familia: ${family.name} (${fields.length} campos)`)

    // Actualizar el orden de cada campo
    for (let i = 0; i < fields.length; i++) {
      const newOrder = i + 1
      if (fields[i].order !== newOrder) {
        await prisma.family_custom_fields.update({
          where: { id: fields[i].id },
          data: { order: newOrder },
        })
        console.log(`  ✅ ${fields[i].fieldLabel}: orden ${fields[i].order} → ${newOrder}`)
      } else {
        console.log(`  ⏭️  ${fields[i].fieldLabel}: orden ${newOrder} (sin cambios)`)
      }
    }
  }

  console.log('\n✅ Orden de campos personalizados corregido')
}

main()
  .catch(e => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
