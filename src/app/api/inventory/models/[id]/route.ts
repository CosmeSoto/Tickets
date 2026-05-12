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
import { canManageInventory } from '@/lib/inventory-access'
import { z } from 'zod'

// Validation schema
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

/**
 * GET /api/inventory/models/[id]
 * Get equipment model by ID
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Check inventory access
    const hasAccess = await canManageInventory(session.user.id, session.user.role)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const model = await getModelById(id)

    return NextResponse.json(model)
  } catch (error: any) {
    console.error('Error getting model:', error)

    if (error.message.includes('no encontrado')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json({ error: error.message || 'Error al obtener modelo' }, { status: 500 })
  }
}

/**
 * PUT /api/inventory/models/[id]
 * Update equipment model
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Check inventory access
    const hasAccess = await canManageInventory(session.user.id, session.user.role)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const body = await request.json()

    // Validate input
    const validationResult = updateModelSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Datos inválidos',
          details: validationResult.error.errors,
        },
        { status: 400 }
      )
    }

    const data: UpdateModelInput = validationResult.data

    const model = await updateModel(id, data)

    return NextResponse.json(model)
  } catch (error: any) {
    console.error('Error updating model:', error)

    if (error.message.includes('no encontrado')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json(
      { error: error.message || 'Error al actualizar modelo' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/inventory/models/[id]
 * Delete equipment model (soft delete)
 */
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

    // Check inventory access
    const hasAccess = await canManageInventory(session.user.id, session.user.role)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    await deleteModel(id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting model:', error)

    if (error.message.includes('no encontrado')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    if (error.message.includes('equipos asociados')) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }

    return NextResponse.json(
      { error: error.message || 'Error al eliminar modelo' },
      { status: 500 }
    )
  }
}
