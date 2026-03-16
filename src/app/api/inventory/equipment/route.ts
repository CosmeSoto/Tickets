import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EquipmentService } from '@/lib/services/equipment.service'
import { createEquipmentSchema, equipmentFiltersSchema } from '@/lib/validations/inventory/equipment'
import { ZodError } from 'zod'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'

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
      type: searchParams.getAll('type') || undefined,
      status: searchParams.getAll('status') || undefined,
      condition: searchParams.getAll('condition') || undefined,
      assignedTo: searchParams.get('assignedTo') || undefined,
      departmentId: searchParams.get('departmentId') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '10'),
    }

    // Validar filtros
    const validatedFilters = equipmentFiltersSchema.parse(filters)

    // Obtener equipos
    const result = await EquipmentService.listEquipment(
      validatedFilters,
      validatedFilters.page,
      validatedFilters.limit,
      session.user.id,
      session.user.role
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
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
    }

    // Solo ADMIN puede crear equipos (o TECHNICIAN si tiene permiso)
    if (session.user.role === 'CLIENT') {
      return NextResponse.json(
        { error: 'No tienes permisos para crear equipos' },
        { status: 403 }
      )
    }

    // TODO: Verificar si TECHNICIAN tiene permiso technician_can_manage_equipment
    if (session.user.role === 'TECHNICIAN') {
      // Por ahora permitimos, luego verificaremos el setting
    }

    const body = await request.json()

    // Validar datos
    const validatedData = createEquipmentSchema.parse(body)

    // Crear equipo
    const equipment = await EquipmentService.createEquipment(
      validatedData,
      session.user.id
    )

    // Registrar en auditoría
    await AuditServiceComplete.log({
      action: AuditActionsComplete.EQUIPMENT_CREATED,
      entityType: 'equipment',
      entityId: equipment.id,
      userId: session.user.id,
      details: {
        code: equipment.code,
        type: validatedData.type,
        brand: validatedData.brand,
        model: validatedData.model,
        serialNumber: validatedData.serialNumber,
      },
    })

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
