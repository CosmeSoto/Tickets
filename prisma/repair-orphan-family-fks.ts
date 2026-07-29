/**
 * CLI: limpia FKs huérfanos hacia families (independiente del seed).
 *
 * Uso:
 *   npx tsx prisma/repair-orphan-family-fks.ts
 *   docker exec tickets-app sh -c 'node ./node_modules/tsx/dist/cli.mjs prisma/repair-orphan-family-fks.ts'
 */

import { PrismaClient } from '@prisma/client'
import { repairOrphanFamilyForeignKeys } from '../src/lib/data-integrity/repair-orphan-family-fks'

async function main() {
  const prisma = new PrismaClient()
  try {
    const stats = await repairOrphanFamilyForeignKeys(prisma)
    console.log('✅ Reparación de FKs de familias completada:')
    console.log(`   departments.familyId limpiados: ${stats.departmentsCleared}`)
    console.log(`   asignaciones eliminadas: ${stats.assignmentsDeleted}`)
    console.log(`   TECHNOLOGY → ADMINISTRATIVE: ${stats.technologyRemapped}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(err => {
  console.error('❌ Error reparando FKs huérfanos:', err)
  process.exit(1)
})
