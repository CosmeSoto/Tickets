import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EquipmentService } from '@/lib/services/equipment.service'
import { updateEquipmentSchema, equipmentIdSchema } from '@/lib/validations/inventory/equipment'
import { ZodError } from 'zod'
import { canManageInventory, inventoryForbidden } from '@/lib/inventory-access'
import { prisma } from '@/lib/prisma'
import { calculateDepreciation } from '@/lib/inventory/depreciation'

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
    const equipmentDetail = await EquipmentService.getEquipmentDetail(id)

    // Si es CLIENT, verificar que sea su equipo
    if (session.user.role === 'CLIENT') {
      const isAssignedToUser = equipmentDetail.currentAssignment?.receiverId === session.user.id
      
      if (!isAssignedToUser) {
        return NextResponse.json(
          { error: 'No tienes acceso a este equipo' },
          { status: 403 }
        )
      }
    }

    // Calcular depreciación si están disponibles los campos requeridos
    const eq = equipmentDetail.equipment as any
    let depreciation: ReturnType<typeof calculateDepreciation> | null = null

    if (
      eq.usefulLifeYears != null &&
      eq.purchaseDate != null &&
      eq.purchasePrice != null
    ) {
      depreciation = calculateDepreciation(
        eq.purchasePrice,
        new Date(eq.purchaseDate),
        eq.usefulLifeYears,
        eq.residualValue ?? 0
      )
    }

    return NextResponse.json({ ...equipmentDetail, equipment: { ...eq, depreciation } })
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
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (!await canManageInventory(session.user.id, session.user.role)) {
      return inventoryForbidden()
    }

    // Validar ID
    const { id: rawId } = await params
    const { id } = equipmentIdSchema.parse({ id: rawId })

    const body = await request.json()

    // Validar datos base
    const validatedData = updateEquipmentSchema.parse(body)

    // Extraer y validar campos financieros nuevos
    const {
      supplierId = undefined,
      invoiceNumber = undefined,
      purchaseOrderNumber = undefined,
      usefulLifeYears = undefined,
      residualValue = undefined,
    } = body as {
      supplierId?: string | null
      invoiceNumber?: string | null
      purchaseOrderNumber?: string | null
      usefulLifeYears?: number | null
      residualValue?: number | null
    }

    // Validación: usefulLifeYears > 0
    if (usefulLifeYears !== undefined && usefulLifeYears !== null) {
      if (usefulLifeYears <= 0) {
        return NextResponse.json(
          { error: 'La vida útil debe ser mayor a cero' },
          { status: 400 }
        )
      }
    }

    // Validación: residualValue <= purchasePrice
    if (residualValue !== undefined && residualValue !== null) {
      const effectivePurchasePrice =
        validatedData.purchasePrice !== undefined
          ? validatedData.purchasePrice
          : (await prisma.equipment.findUnique({ where: { id }, select: { purchasePrice: true } }))?.purchasePrice

      if (effectivePurchasePrice !== undefined && effectivePurchasePrice !== null) {
        if (residualValue > effectivePurchasePrice) {
          return NextResponse.json(
            { error: 'El valor residual no puede ser mayor al costo de adquisición' },
            { status: 400 }
          )
        }
      }
    }

    // Validación: supplierId existente
    if (supplierId !== undefined && supplierId !== null) {
      const supplierExists = await prisma.suppliers.findUnique({ where: { id: supplierId } })
      if (!supplierExists) {
        return NextResponse.json(
          { error: 'El proveedor especificado no existe' },
          { status: 400 }
        )
      }
    }

    // Actualizar equipo (campos base)
    const equipment = await EquipmentService.updateEquipment(
      id,
      validatedData,
      session.user.id
    )

    // Persistir campos financieros nuevos si se proporcionaron
    const financialFields: Record<string, unknown> = {}
    if ('supplierId' in body) financialFields.supplierId = supplierId ?? null
    if ('invoiceNumber' in body) financialFields.invoiceNumber = invoiceNumber ?? null
    if ('purchaseOrderNumber' in body) financialFields.purchaseOrderNumber = purchaseOrderNumber ?? null
    if ('usefulLifeYears' in body) financialFields.usefulLifeYears = usefulLifeYears ?? null
    if ('residualValue' in body) financialFields.residualValue = residualValue ?? null

    if (Object.keys(financialFields).length > 0) {
      await prisma.equipment.update({
        where: { id },
        data: financialFields,
      })
    }

    // Auditoría ya se registra en EquipmentService.updateEquipment

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

    // Auditoría ya se registra en EquipmentService.deleteEquipment

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
