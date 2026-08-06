/**
 * Sincroniza / diagnostica user_family_access.
 *
 * Uso:
 *   npx tsx prisma/sync-user-family-access.ts
 *   npx tsx prisma/sync-user-family-access.ts --force
 *   npx tsx prisma/sync-user-family-access.ts --diagnose
 *   npx tsx prisma/sync-user-family-access.ts --diagnose --fix
 */
import {
  syncAllUsersFamilyAccess,
  diagnoseUserFamilyAccessDrift,
} from '../src/lib/auth/user-family-access'

async function main() {
  const args = new Set(process.argv.slice(2))
  const force = args.has('--force')
  const diagnose = args.has('--diagnose')
  const fix = args.has('--fix')

  if (diagnose) {
    console.log('==> Diagnosticando user_family_access (totales por módulo)...')
    const report = await diagnoseUserFamilyAccessDrift()
    console.log(`==> Usuarios activos revisados: ${report.checked}`)
    for (const [module, count] of Object.entries(report.totals)) {
      console.log(`   ${module}: ${count} grants activos`)
    }
    if (fix) {
      console.log('==> --fix: sembrando content desde tickets donde aplique...')
      const result = await syncAllUsersFamilyAccess({ force: true })
      console.log(`==> Fix: ${result.users} usuarios, ${result.upserts} upserts content`)
    }
    return
  }

  console.log(`==> Sincronizando user_family_access (semilla content)${force ? ' (FORCE)' : ''}...`)
  const result = await syncAllUsersFamilyAccess({ force })
  console.log(`==> Listo: ${result.users} usuarios, ${result.upserts} upserts`)
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('==> Error sync user_family_access:', err)
    process.exit(1)
  })
