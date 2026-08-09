import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'

export const catalogReorderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
})

type ReorderTable =
  | 'equipment_types'
  | 'license_types'
  | 'consumable_types'
  | 'equipment_brands'
  | 'warehouses'
  | 'supplier_types'

/**
 * Actualiza el campo `order` (0..n) de filas por id, en una transacción.
 */
export async function persistCatalogOrder(
  table: ReorderTable,
  ids: string[]
): Promise<NextResponse> {
  try {
    const updates = ids.map((id, index) =>
      (prisma as any)[table].update({
        where: { id },
        data: { order: index },
      })
    )
    await prisma.$transaction(updates)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(`[catalog-reorder] ${table}:`, error)
    return NextResponse.json({ error: 'Error al reordenar' }, { status: 500 })
  }
}
