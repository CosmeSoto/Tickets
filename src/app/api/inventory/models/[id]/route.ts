/**
 * API Routes: Equipment Model by ID
 * GET /api/inventory/models/[id] - Get model
 * PUT /api/inventory/models/[id] - Update model
 * DELETE /api/inventory/models/[id] - Delete model
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  getModelById,
  updateModel,
  deleteModel,
  type UpdateModelInput,
} from '@/lib/services/equipment-models.service'
import { z } from 'zod'
import {
  assertInventoryResourceManage,
  assertInventoryResourceRead,
  InventoryAccessError,
  toInventoryAccessUser,
  inventoryAccessToResponse,
} from '@/lib/inventory/inventory-resource-access'

const updateModelSchema = z.object({
  brand: z.string().min(1).max(100).optional(),
  model: z.string().min(1).max(200).optional(),
  sku: z.string().max(100).optional(),
  typeId: z.string().uuid().optional(),
  specifications: z.record(z.any()).optional(),
  defaultAccessories: z.array(z.string()).optional(),
  standardPrice: z.number().positive().optional(),
  modelPhotoUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    try {
      await assertInventoryResourceRead(toInventoryAccessUser(session.user), 'MODEL', id)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const model = await getModelById(id)
    return NextResponse.json(model)
  } catch (error: any) {
    console.error('Error getting model:', error)
    if (error.message?.includes('no encontrado')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    return NextResponse.json({ error: error.message || 'Error al obtener modelo' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    try {
      await assertInventoryResourceManage(toInventoryAccessUser(session.user), 'MODEL', id)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const body = await request.json()
    const validationResult = updateModelSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const model = await updateModel(id, validationResult.data as UpdateModelInput)
    return NextResponse.json(model)
  } catch (error: any) {
    console.error('Error updating model:', error)
    if (error.message?.includes('no encontrado')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    return NextResponse.json(
      { error: error.message || 'Error al actualizar modelo' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    try {
      await assertInventoryResourceManage(toInventoryAccessUser(session.user), 'MODEL', id)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    await deleteModel(id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting model:', error)
    if (error.message?.includes('no encontrado')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }
    if (error.message?.includes('equipos asociados')) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return NextResponse.json(
      { error: error.message || 'Error al eliminar modelo' },
      { status: 500 }
    )
  }
}
