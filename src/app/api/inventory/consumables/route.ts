import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ConsumableService } from '@/lib/services/consumable.service'
import { createConsumableSchema, consumableFiltersSchema } from '@/lib/validations/inventory/consumable'
import { canManageInventory, inventoryForbidden } from '@/lib/inventory-access'
import { ZodError } from 'zod'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'

/**
 * GET /api/inventory/consumables
 * Lista consumibles con filtros y paginación
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const filters = {
      search: searchParams.get('search') || undefined,
      typeId: searchParams.getAll('typeId').length > 0 ? searchParams.getAll('typeId') : undefined,
      lowStock: searchParams.get('lowStock') === 'true' || undefined,
      familyId: searchParams.get('familyId') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '10'),
    }

    const validatedFilters = consumableFiltersSchema.parse(filters)
    const result = await ConsumableService.listConsumables(validatedFilters)

    return NextResponse.json({
      ...result,
      page: validatedFilters.page,
      limit: validatedFilters.limit,
    })
  } catch (error) {
    console.error('Error en GET /api/inventory/consumables:', error)
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error al obtener consumibles' }, { status: 500 })
  }
}

/**
 * POST /api/inventory/consumables
 * Crea un nuevo consumible
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    if (!await canManageInventory(session.user.id, session.user.role)) {
      return inventoryForbidden()
    }

    const body = await request.json()
    const validatedData = createConsumableSchema.parse(body)
    const consumable = await ConsumableService.createConsumable(validatedData, session.user.id)

    await AuditServiceComplete.log({
      action: AuditActionsComplete.CONSUMABLE_CREATED,
      entityType: 'inventory',
      entityId: consumable.id,
      userId: session.user.id,
      details: {
        name: validatedData.name,
        typeId: validatedData.typeId,
        currentStock: validatedData.currentStock,
        costPerUnit: validatedData.costPerUnit,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    }).catch(err => console.error('[AUDIT] Error registrando creación de consumible:', err))

    return NextResponse.json(consumable, { status: 201 })
  } catch (error) {
    console.error('Error en POST /api/inventory/consumables:', error)
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error al crear consumible' }, { status: 500 })
  }
}
