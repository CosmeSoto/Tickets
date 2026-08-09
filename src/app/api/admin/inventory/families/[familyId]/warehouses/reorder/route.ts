/**
 * PATCH /api/admin/inventory/families/[familyId]/warehouses/reorder
 * Body: { ids: string[] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  requireAdminInventoryAccess,
  assertFamilyInManageScope,
  assertCatalogIdsInManageScope,
} from '@/lib/inventory/admin-inventory-auth'
import {
  catalogReorderSchema,
  persistCatalogOrder,
} from '@/lib/inventory/catalog-reorder'

type RouteContext = { params: Promise<{ familyId: string }> }

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    const access = await requireAdminInventoryAccess(session)
    if (!access.ok) return access.response

    const { familyId } = await params
    const familyDenied = assertFamilyInManageScope(access.auth, familyId)
    if (familyDenied) return familyDenied

    const body = await request.json()
    const parsed = catalogReorderSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.errors },
        { status: 400 }
      )
    }

    const owned = await prisma.warehouses.findMany({
      where: { id: { in: parsed.data.ids }, familyId },
      select: { id: true },
    })
    if (owned.length !== parsed.data.ids.length) {
      return NextResponse.json(
        { error: 'Algunas bodegas no pertenecen a esta área' },
        { status: 400 }
      )
    }

    const scopeDenied = await assertCatalogIdsInManageScope(
      access.auth,
      'warehouses',
      parsed.data.ids
    )
    if (scopeDenied) return scopeDenied

    return persistCatalogOrder('warehouses', parsed.data.ids)
  } catch (error) {
    console.error('[PATCH warehouses/reorder]', error)
    return NextResponse.json({ error: 'Error al reordenar bodegas' }, { status: 500 })
  }
}
