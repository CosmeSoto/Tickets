import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EquipmentService } from '@/lib/services/equipment.service'
import { updateEquipmentSchema, equipmentIdSchema } from '@/lib/validations/inventory/equipment'
import { ZodError } from 'zod'
import { canManageInventory, inventoryForbidden } from '@/lib/inventory-access'
import { prisma } from '@/lib/prisma'
import { calculateDepreciation, familySupportsDepreciation } from '@/lib/inventory/depreciation'

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

    const familyCode = eq.type?.family?.code ?? null
    const canDepreciate = familyCode ? familySupportsDepreciation(familyCode) : true

    if (
      canDepreciate &&
      eq.usefulLifeYears != null &&
      eq.purchaseDate != null &&
      eq.purchasePrice != null
    ) {
      depreciation = calculateDepreciation(
        eq.purchasePrice,
        new Date(eq.purchaseDate),
        eq.usefulLifeYears,
        eq.residualValue ?? 0,
        new Date(),
        eq.depreciationMethod ?? 'LINEAR',
        { totalUnits: eq.totalUnits, usedUnits: eq.usedUnits }
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

    // Validación: si se envía departmentId diferente al actual, verificar que no haya asignación activa
    if (validatedData.departmentId !== undefined) {
      const currentEquipmentDept = await prisma.equipment.findUnique({
        where: { id },
        select: { departmentId: true },
      })

      if (!currentEquipmentDept) {
        return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 })
      }

      if (validatedData.departmentId !== currentEquipmentDept.departmentId) {
        const activeAssignment = await prisma.equipment_assignments.findFirst({
          where: { equipmentId: id, isActive: true },
        })

        if (activeAssignment) {
          return NextResponse.json(
            { error: 'No se puede cambiar el departamento: el equipo tiene una asignación activa vigente' },
            { status: 409 }
          )
        }
      }
    }

    // Extraer y validar campos financieros nuevos
    const {
      supplierId = undefined,
      invoiceNumber = undefined,
      purchaseOrderNumber = undefined,
      usefulLifeYears = undefined,
      residualValue = undefined,
      warehouseId = undefined,
      acquisitionMode = undefined,
      depreciationRate = undefined,
      depreciationMethod = undefined,
      totalUnits = undefined,
      usedUnits = undefined,
      contractStartDate = undefined,
      contractEndDate = undefined,
      contractRenewalCost = undefined,
    } = body as {
      supplierId?: string | null
      invoiceNumber?: string | null
      purchaseOrderNumber?: string | null
      usefulLifeYears?: number | null
      residualValue?: number | null
      warehouseId?: string | null
      acquisitionMode?: string | null
      depreciationRate?: number | null
      depreciationMethod?: string | null
      totalUnits?: number | null
      usedUnits?: number | null
      contractStartDate?: string | null
      contractEndDate?: string | null
      contractRenewalCost?: number | null
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

    // Validación: warehouseId existente
    if (warehouseId !== undefined && warehouseId !== null) {
      const warehouseExists = await prisma.warehouses.findUnique({ where: { id: warehouseId } })
      if (!warehouseExists) {
        return NextResponse.json(
          { error: 'La bodega especificada no existe o está inactiva' },
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
    if ('departmentId' in body && validatedData.departmentId !== undefined) financialFields.departmentId = validatedData.departmentId
    if ('supplierId' in body) financialFields.supplierId = supplierId ?? null
    if ('invoiceNumber' in body) financialFields.invoiceNumber = invoiceNumber ?? null
    if ('purchaseOrderNumber' in body) financialFields.purchaseOrderNumber = purchaseOrderNumber ?? null
    if ('usefulLifeYears' in body) financialFields.usefulLifeYears = usefulLifeYears ?? null
    if ('residualValue' in body) financialFields.residualValue = residualValue ?? null
    if ('warehouseId' in body) financialFields.warehouseId = warehouseId ?? null
    if ('acquisitionMode' in body) financialFields.acquisitionMode = acquisitionMode ?? null
    if ('contractStartDate' in body) financialFields.contractStartDate = contractStartDate ? new Date(contractStartDate) : null
    if ('contractEndDate' in body) financialFields.contractEndDate = contractEndDate ? new Date(contractEndDate) : null
    if ('contractRenewalCost' in body) financialFields.contractRenewalCost = contractRenewalCost ?? null

    // Campos de depreciación solo si la familia del activo los soporta
    const currentEquipment = await prisma.equipment.findUnique({
      where: { id },
      select: { type: { include: { family: true } } },
    })
    const currentFamilyCode = (currentEquipment?.type as any)?.family?.code ?? null
    const depreciationAllowed = currentFamilyCode ? familySupportsDepreciation(currentFamilyCode) : true

    if (depreciationAllowed) {
      if ('depreciationRate' in body) financialFields.depreciationRate = depreciationRate ?? null
      if ('depreciationMethod' in body) financialFields.depreciationMethod = depreciationMethod ?? null
      if ('totalUnits' in body) financialFields.totalUnits = totalUnits ?? null
      if ('usedUnits' in body) financialFields.usedUnits = usedUnits ?? null
    }

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
