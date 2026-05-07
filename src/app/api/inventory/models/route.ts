/**
 * API Routes: Equipment Models
 * GET /api/inventory/models - List models
 * POST /api/inventory/models - Create model
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  createModel,
  listModels,
  type CreateModelInput,
} from '@/lib/services/equipment-models.service'
import { canManageInventory } from '@/lib/inventory-access'
import { z } from 'zod'

// Validation schema
const createModelSchema = z.object({
  brand: z.string().min(1).max(100),
  model: z.string().min(1).max(200),
  sku: z.string().max(100).optional(),
  typeId: z.string().uuid(),
  specifications: z.record(z.any()).optional(),
  defaultAccessories: z.array(z.string()).optional(),
  standardPrice: z.number().positive().optional(),
  modelPhotoUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
})

/**
 * GET /api/inventory/models
 * List equipment models with pagination and filters
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Check inventory access
    const hasAccess = await canManageInventory(session.user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const typeId = searchParams.get('typeId') || undefined
    const familyId = searchParams.get('familyId') || undefined
    const isActive = searchParams.get('isActive') !== 'false'
    const search = searchParams.get('search') || undefined

    const result = await listModels({
      page,
      limit,
      typeId,
      familyId,
      isActive,
      search,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error listing models:', error)
    return NextResponse.json({ error: error.message || 'Error al listar modelos' }, { status: 500 })
  }
}

/**
 * POST /api/inventory/models
 * Create a new equipment model
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Check inventory access
    const hasAccess = await canManageInventory(session.user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    const body = await request.json()

    // Validate input
    const validationResult = createModelSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Datos inválidos',
          details: validationResult.error.errors,
        },
        { status: 400 }
      )
    }

    const data: CreateModelInput = validationResult.data

    const model = await createModel(data)

    return NextResponse.json(model, { status: 201 })
  } catch (error: any) {
    console.error('Error creating model:', error)

    if (error.message.includes('Ya existe')) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }

    return NextResponse.json({ error: error.message || 'Error al crear modelo' }, { status: 500 })
  }
}
