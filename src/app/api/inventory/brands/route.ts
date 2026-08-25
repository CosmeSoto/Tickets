/**
 * GET  /api/inventory/brands — lectura del catálogo (formularios de activos)
 * POST /api/inventory/brands — crear marca en operación
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  createBrand,
  listBrands,
  type CreateBrandInput,
} from '@/lib/services/equipment-brands.service'
import {
  assertCatalogEntryWrite,
  buildCatalogFamilyWhere,
  requireInventoryCatalogRead,
} from '@/lib/inventory/inventory-catalog-access'
import {
  InventoryAccessError,
  inventoryAccessToResponse,
  toInventoryAccessUser,
} from '@/lib/inventory/inventory-resource-access'
import { z } from 'zod'

const createBrandSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  logoUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
  familyId: z.string().uuid(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const ctx = await requireInventoryCatalogRead(session.user)
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const familyId = searchParams.get('familyId') || undefined
    const isActive = searchParams.get('isActive') !== 'false'
    const search = searchParams.get('search') || undefined

    const scopeFilter = buildCatalogFamilyWhere(ctx, familyId, false)
    const result = await listBrands({
      page,
      limit,
      familyId,
      scopeFilter,
      isActive,
      search,
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    if (error instanceof InventoryAccessError) return inventoryAccessToResponse(error)
    console.error('Error listing brands:', error)
    const message = error instanceof Error ? error.message : 'Error al listar marcas'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validationResult = createBrandSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    await assertCatalogEntryWrite(
      toInventoryAccessUser(session.user),
      validationResult.data.familyId
    )

    const brand = await createBrand(validationResult.data as CreateBrandInput)
    return NextResponse.json(brand, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof InventoryAccessError) return inventoryAccessToResponse(error)
    console.error('Error creating brand:', error)
    const message = error instanceof Error ? error.message : 'Error al crear marca'
    const status = message.includes('Ya existe') ? 409 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
