/**
 * fix-orphan-warehouses.js
 *
 * Pre-migration script: removes or deactivates warehouses that have no family
 * (family_id IS NULL).  Runs via plain `node` inside the container — no tsx,
 * no build step required.
 *
 * Safe to run multiple times (idempotent).
 */

'use strict'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PrismaClient } = require('@prisma/client')

const p = new PrismaClient()

async function fixOrphans() {
  let fixed = 0
  let warned = 0

  try {
    // Only acts when family_id still accepts NULLs (pre-migration state).
    // The cast to ::int is needed because Prisma returns BigInt for COUNT.
    const orphans = await p.$queryRaw`
      SELECT
        w.id,
        w.name,
        (
          (SELECT COUNT(*) FROM equipment        WHERE warehouse_id = w.id) +
          (SELECT COUNT(*) FROM consumables      WHERE warehouse_id = w.id) +
          (SELECT COUNT(*) FROM equipment_batches WHERE warehouse_id = w.id)
        )::int AS total_items
      FROM warehouses w
      WHERE w.family_id IS NULL
    `

    for (const row of orphans) {
      const id = row.id // stays as the native type (number/bigint)
      const totalItems = Number(row.total_items)

      if (totalItems === 0) {
        // Use $executeRaw with Prisma's tagged-template parameterisation —
        // the value is passed as a query parameter, NOT interpolated into SQL.
        await p.$executeRaw`DELETE FROM warehouses WHERE id = ${id}`
        console.log(`  Eliminada bodega huérfana sin ítems: ${row.name} (id=${id})`)
        fixed++
      } else {
        await p.$executeRaw`UPDATE warehouses SET is_active = false WHERE id = ${id}`
        console.warn(
          `  ADVERTENCIA: bodega huérfana con ítems desactivada: ${row.name} (id=${id})` +
            ' — asignar familia manualmente'
        )
        warned++
      }
    }

    if (fixed === 0 && warned === 0) {
      console.log('  No hay bodegas huérfanas.')
    } else {
      console.log(`  Resultado: ${fixed} eliminadas, ${warned} desactivadas.`)
    }
  } catch (e) {
    // Expected when family_id is already NOT NULL (migration already ran)
    // or when the table doesn't exist yet (first-ever boot).
    const msg = e.message || String(e)
    if (
      msg.includes('null value') ||
      msg.includes('does not exist') ||
      msg.includes('column "family_id" of relation') ||
      msg.includes('undefined table')
    ) {
      console.log('  Pre-check bodegas: nada que hacer (schema ya migrado o tabla nueva).')
    } else {
      // Unexpected error — print it so it shows in docker logs, but don't crash.
      console.error(`  Pre-check bodegas error inesperado: ${msg}`)
    }
  } finally {
    await p.$disconnect()
  }
}

fixOrphans()
