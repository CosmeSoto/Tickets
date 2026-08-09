/**
 * PATCH /api/admin/inventory/brands/reorder
 * Body: { ids: string[] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  requireAdminInventoryAccess,
  assertCatalogIdsInManageScope,
} from '@/lib/inventory/admin-inventory-auth'
import {
  catalogReorderSchema,
  persistCatalogOrder,
} from '@/lib/inventory/catalog-reorder'

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const access = await requireAdminInventoryAccess(session)
    if (!access.ok) return access.response

    const body = await request.json()
    const parsed = catalogReorderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.errors },
        { status: 400 }
      )
    }

    const scopeDenied = await assertCatalogIdsInManageScope(
      access.auth,
      'equipment_brands',
      parsed.data.ids
    )
    if (scopeDenied) return scopeDenied

    return persistCatalogOrder('equipment_brands', parsed.data.ids)
  } catch (error) {
    console.error('[PATCH brands/reorder]', error)
    return NextResponse.json({ error: 'Error al reordenar marcas' }, { status: 500 })
  }
}
