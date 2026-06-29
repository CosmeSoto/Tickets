/**
 * PUT    /api/admin/inventory/brands/[id]
 * DELETE /api/admin/inventory/brands/[id]
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  updateBrand,
  deleteBrand,
  type UpdateBrandInput,
} from '@/lib/services/equipment-brands.service'
import { isAdminInventorySession } from '@/lib/inventory/admin-inventory-auth'
import { z } from 'zod'

const updateBrandSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  logoUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
  familyId: z.string().uuid().optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!isAdminInventorySession(session)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const validation = updateBrandSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validation.error.errors },
        { status: 400 }
      )
    }

    const brand = await updateBrand(id, validation.data as UpdateBrandInput)
    return NextResponse.json(brand)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al actualizar marca'
    const status =
      message === 'Marca no encontrada' ? 404 : message.includes('Ya existe') ? 409 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!isAdminInventorySession(session)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    const result = await deleteBrand(id)
    return NextResponse.json(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al eliminar marca'
    const status = message === 'Marca no encontrada' ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
