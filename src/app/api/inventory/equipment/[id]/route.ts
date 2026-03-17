import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EquipmentService } from '@/lib/services/equipment.service'
import { updateEquipmentSchema, equipmentIdSchema } from '@/lib/validations/inventory/equipment'
import { ZodError } from 'zod'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'

/**
 * GET /api/inventory/equipment/[id]
 * Obtiene detalles de un equipo
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
    }

    // Validar ID
    const { id: rawId } = await params
    const { id } = equipmentIdSchema.parse({ id: rawId })

    // Obtener equipo
    const equipment = await EquipmentService.getEquipmentDetail(id)

    // Si es CLIENT, verificar que sea su equipo
    if (session.user.role === 'CLIENT') {
      const isAssignedToUser = equipment.currentAssignment?.receiverId === session.user.id
      
      if (!isAssignedToUser) {
        return NextResponse.json(
          { error: 'No tienes acceso a este equipo' },
          { status: 403 }
        )
      }
    }

    return NextResponse.json(equipment)
  } catch (error) {
    console.error('Error en GET /api/inventory/equipment/[id]:', error)
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'ID inválido', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message.includes('no encontrado')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Error al obtener equipo' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/inventory/equipment/[id]
 * Actualiza un equipo
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
    }

    // Solo ADMIN puede actualizar equipos (o TECHNICIAN si tiene permiso)
    if (session.user.role === 'CLIENT') {
      return NextResponse.json(
        { error: 'No tienes permisos para actualizar equipos' },
        { status: 403 }
      )
    }

    // Validar ID
    const { id: rawId } = await params
    const { id } = equipmentIdSchema.parse({ id: rawId })

    const body = await request.json()

    // Validar datos
    const validatedData = updateEquipmentSchema.parse(body)

    // Actualizar equipo
    const equipment = await EquipmentService.updateEquipment(
      id,
      validatedData,
      session.user.id
    )

    // Registrar en auditoría
    await AuditServiceComplete.log({
      action: AuditActionsComplete.EQUIPMENT_UPDATED,
      entityType: 'equipment',
      entityId: id,
      userId: session.user.id,
      details: { updatedFields: Object.keys(validatedData) },
    })

    return NextResponse.json(equipment)
  } catch (error) {
    console.error('Error en PUT /api/inventory/equipment/[id]:', error)
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message.includes('no encontrado')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      )
    }

    if (error instanceof Error && error.message.includes('asignación activa')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Error al actualizar equipo' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/inventory/equipment/[id]
 * Elimina un equipo (soft delete - marca como RETIRED)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
    }

    // Solo ADMIN puede eliminar equipos
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'No tienes permisos para eliminar equipos' },
        { status: 403 }
      )
    }

    // Validar ID
    const { id: rawId } = await params
    const { id } = equipmentIdSchema.parse({ id: rawId })

    // Eliminar equipo
    await EquipmentService.deleteEquipment(id, session.user.id)

    // Registrar en auditoría
    await AuditServiceComplete.log({
      action: AuditActionsComplete.EQUIPMENT_DELETED,
      entityType: 'equipment',
      entityId: id,
      userId: session.user.id,
    })

    return NextResponse.json({ message: 'Equipo retirado exitosamente' })
  } catch (error) {
    console.error('Error en DELETE /api/inventory/equipment/[id]:', error)
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'ID inválido', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error && error.message.includes('no encontrado')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      )
    }

    if (error instanceof Error && error.message.includes('asignación activa')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Error al eliminar equipo' },
      { status: 500 }
    )
  }
}
