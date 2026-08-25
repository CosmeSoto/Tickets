/**
 * API Routes: Individual Equipment Brand
 * GET /api/inventory/brands/[id] - Get brand by id
 * PUT /api/inventory/brands/[id] - Update brand
 * DELETE /api/inventory/brands/[id] - Delete brand
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  getBrandById,
  updateBrand,
  deleteBrand,
  type UpdateBrandInput,
} from '@/lib/services/equipment-brands.service'
import {
  assertCatalogEntryRead,
  assertCatalogEntryWrite,
  assertGlobalCatalogDelete,
} from '@/lib/inventory/inventory-catalog-access'
import {
  InventoryAccessError,
  inventoryAccessToResponse,
  toInventoryAccessUser,
} from '@/lib/inventory/inventory-resource-access'
import { z } from 'zod'

// Validation schema for update
const updateBrandSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  logoUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
  familyId: z.string().uuid().optional(),
})

/**
 * GET /api/inventory/brands/[id]
 * Get a brand by id
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const brand = await getBrandById(id)

    await assertCatalogEntryRead(toInventoryAccessUser(session.user), brand.familyId)

    return NextResponse.json(brand)
  } catch (error: any) {
    if (error instanceof InventoryAccessError) return inventoryAccessToResponse(error)
    console.error('Error getting brand:', error)

    if (error.message === 'Marca no encontrada') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json({ error: error.message || 'Error al obtener marca' }, { status: 500 })
  }
}

/**
 * PUT /api/inventory/brands/[id]
 * Update a brand
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    // Validate input
    const validationResult = updateBrandSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Datos inválidos',
          details: validationResult.error.errors,
        },
        { status: 400 }
      )
    }

    const existingBrand = await getBrandById(id)
    const user = toInventoryAccessUser(session.user)
    await assertCatalogEntryWrite(user, existingBrand.familyId)

    const data: UpdateBrandInput = validationResult.data
    // Familia destino: si se reasigna, validar permiso ahí también.
    if (data.familyId !== undefined && data.familyId !== existingBrand.familyId) {
      await assertCatalogEntryWrite(user, data.familyId)
    }

    const brand = await updateBrand(id, data)

    return NextResponse.json(brand)
  } catch (error: any) {
    if (error instanceof InventoryAccessError) return inventoryAccessToResponse(error)
    console.error('Error updating brand:', error)

    if (
      error.message === 'Marca no encontrada' ||
      error.message === 'Ya existe una marca con ese código'
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message.includes('encontrada') ? 404 : 409 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Error al actualizar marca' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/inventory/brands/[id]
 * Delete a brand
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    await assertGlobalCatalogDelete(toInventoryAccessUser(session.user))

    const { id } = await params
    const result = await deleteBrand(id)

    return NextResponse.json(result)
  } catch (error: any) {
    if (error instanceof InventoryAccessError) return inventoryAccessToResponse(error)
    console.error('Error deleting brand:', error)

    if (error.message === 'Marca no encontrada') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json({ error: error.message || 'Error al eliminar marca' }, { status: 500 })
  }
}
