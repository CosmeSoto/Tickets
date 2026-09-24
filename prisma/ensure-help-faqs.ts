/**
 * Seed idempotente de preguntas del Centro de Ayuda — corre en CADA arranque
 * del contenedor (no solo cuando la BD está vacía), a diferencia de
 * `prisma/seed.ts` que el entrypoint solo ejecuta si `users.count() === 0`.
 * Sin esto, una BD ya sembrada (con usuarios) nunca recibe preguntas nuevas
 * agregadas a `HELP_FAQS` en un rebuild normal — solo con `--clean`.
 *
 *   npm run db:seed-help-faqs
 *   docker exec tickets-app sh -c 'node ./node_modules/tsx/dist/cli.mjs prisma/ensure-help-faqs.ts'
 */

import { PrismaClient } from '@prisma/client'
import { seedHelpFaqs } from './seeds/help-faqs.seed'

async function main() {
  const prisma = new PrismaClient()
  try {
    await seedHelpFaqs(prisma)
  } finally {
    await prisma.$disconnect()
  }
}

const isDirectRun =
  typeof process !== 'undefined' && (process.argv[1]?.includes('ensure-help-faqs') ?? false)

if (isDirectRun) {
  main().catch(err => {
    console.error('❌ Error en ensure-help-faqs:', err)
    process.exit(1)
  })
}
