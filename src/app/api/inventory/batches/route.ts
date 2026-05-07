/**
 * API Routes: Equipment Batches
 * GET /api/inventory/batches - List batches
 * POST /api/inventory/batches - Create batch
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  createBatch,
  listBatches,
  type CreateBatchInput,
} from '@/lib/services/equipment-batches.service'
import { canManageInventory } from '@/lib/inventory-access'
import { invalidateCache } from '@/lib/api-cache'
import { z } from 'zod'

// Validation schema
const createBatchSchema = z.object({
  batchCode: z.string().max(50).optional(),
  description: z.string().optional(),
  modelId: z.string().uuid(),
  quantity: z.number().int().min(1).max(100),
  serialNumbers: z.array(z.string().min(1)),
  supplierId: z.string().uuid(),
  purchaseDate: z
    .string()
    .datetime()
    .or(z.date())
    .transform(val => new Date(val)),
  unitPrice: z.number().positive(),
  invoiceNumber: z.string().max(100).optional(),
  purchaseOrderNumber: z.string().max(100).optional(),
  warehouseId: z.string().uuid(),
  receivedBy: z.string().uuid(),
  notes: z.string().optional(),
  condition: z.string().optional(),
  ownershipType: z.string(),
  accessories: z.array(z.string()).optional(),
  photoUrl: z.string().url().optional(),
})

/**
 * GET /api/inventory/batches
 * List equipment batches with pagination and filters
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
    const modelId = searchParams.get('modelId') || undefined
    const supplierId = searchParams.get('supplierId') || undefined
    const warehouseId = searchParams.get('warehouseId') || undefined
    const status = searchParams.get('status') || undefined
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : undefined
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined

    const result = await listBatches({
      page,
      limit,
      modelId,
      supplierId,
      warehouseId,
      status,
      startDate,
      endDate,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error listing batches:', error)
    return NextResponse.json({ error: error.message || 'Error al listar lotes' }, { status: 500 })
  }
}

/**
 * POST /api/inventory/batches
 * Create a new equipment batch with equipment instances
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
    const validationResult = createBatchSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Datos inválidos',
          details: validationResult.error.errors,
        },
        { status: 400 }
      )
    }

    const data: CreateBatchInput = {
      ...validationResult.data,
      receivedBy: session.user.id, // Override with current user
    }

    const result = await createBatch(data)

    // Invalidate relevant caches
    await invalidateCache('equipment:*')
    await invalidateCache(`model:${data.modelId}:*`)

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    console.error('Error creating batch:', error)

    if (error.message.includes('ya existe')) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }

    if (error.message.includes('no coincide') || error.message.includes('duplicados')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ error: error.message || 'Error al crear lote' }, { status: 500 })
  }
}
