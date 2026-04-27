import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EquipmentService } from '@/lib/services/equipment.service'
import { createEquipmentSchema, equipmentFiltersSchema } from '@/lib/validations/inventory/equipment'
import { ZodError } from 'zod'
import { prisma } from '@/lib/prisma'
import { withCache, invalidateCache, buildCacheKey } from '@/lib/api-cache'
import { canManageInventory, inventoryForbidden } from '@/lib/inventory-access'

/**
 * GET /api/inventory/equipment
 * Lista equipos con filtros y paginación
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
    }

    // Parsear query params
    const searchParams = request.nextUrl.searchParams
    const filters = {
      search: searchParams.get('search') || undefined,
      typeId: searchParams.getAll('typeId').length > 0 ? searchParams.getAll('typeId') : undefined,
      status: searchParams.getAll('status').length > 0 ? searchParams.getAll('status') : undefined,
      condition: searchParams.getAll('condition').length > 0 ? searchParams.getAll('condition') : undefined,
      assignedTo: searchParams.get('assignedTo') || undefined,
      departmentId: searchParams.get('departmentId') || undefined,
      familyId: searchParams.get('familyId') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '10'),
    }

    // Validar filtros
    const validatedFilters = equipmentFiltersSchema.parse(filters)

    // Caché 60s — se invalida en POST/PUT/DELETE
    const cacheKey = buildCacheKey('inventory:equipment', {
      uid: session.user.id,
      role: session.user.role,
      ...validatedFilters,
    })

    const result = await withCache(cacheKey, 10, () =>
      EquipmentService.listEquipment(
        validatedFilters,
        validatedFilters.page,
        validatedFilters.limit,
        session.user.id,
        session.user.role
      )
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error en GET /api/inventory/equipment:', error)
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Error al obtener equipos' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/inventory/equipment
 * Crea un nuevo equipo
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Verificar permiso de gestión de inventario
    if (!await canManageInventory(session.user.id, session.user.role)) {
      return inventoryForbidden()
    }

    const body = await request.json()

    // Validar datos
    const validatedData = createEquipmentSchema.parse(body)

    // Validar que el departamento exista y esté activo
    const department = await prisma.departments.findUnique({
      where: { id: validatedData.departmentId }
    })

    if (!department) {
      return NextResponse.json(
        { error: 'El departamento especificado no existe' },
        { status: 400 }
      )
    }

    if (!department.isActive) {
      return NextResponse.json(
        { error: 'El departamento seleccionado no está activo' },
        { status: 400 }
      )
    }

    // Crear equipo
    const equipment = await EquipmentService.createEquipment(
      validatedData,
      session.user.id
    )

    // Invalidar caché de equipos
    await invalidateCache('inventory:equipment:*').catch(() => {})

    return NextResponse.json(equipment, { status: 201 })
  } catch (error) {
    console.error('Error en POST /api/inventory/equipment:', error)
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message.includes('Ya existe')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Error al crear equipo' },
      { status: 500 }
    )
  }
}
