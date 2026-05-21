/**
 * API Routes: Equipment Brands
 * GET /api/inventory/brands - List brands
 * POST /api/inventory/brands - Create brand
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  createBrand,
  listBrands,
  type CreateBrandInput,
} from '@/lib/services/equipment-brands.service'
import { canManageInventory } from '@/lib/inventory-access'
import { z } from 'zod'

// Validation schema
const createBrandSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  logoUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
  familyId: z.string().uuid().optional(),
})

/**
 * GET /api/inventory/brands
 * List equipment brands with pagination and filters
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Check inventory access
    const hasAccess = await canManageInventory(session.user.id, session.user.role)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const familyId = searchParams.get('familyId') || undefined
    const isActive = searchParams.get('isActive') !== 'false'
    const search = searchParams.get('search') || undefined

    const result = await listBrands({
      page,
      limit,
      familyId,
      isActive,
      search,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error listing brands:', error)
    return NextResponse.json({ error: error.message || 'Error al listar marcas' }, { status: 500 })
  }
}

/**
 * POST /api/inventory/brands
 * Create a new equipment brand
 */
export async function POST(request: NextRequest) {
  try {
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
    const validationResult = createBrandSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Datos inválidos',
          details: validationResult.error.errors,
        },
        { status: 400 }
      )
    }

    const data: CreateBrandInput = validationResult.data

    const brand = await createBrand(data)

    return NextResponse.json(brand, { status: 201 })
  } catch (error: any) {
    console.error('Error creating brand:', error)

    if (error.message.includes('Ya existe')) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }

    return NextResponse.json({ error: error.message || 'Error al crear marca' }, { status: 500 })
  }
}
