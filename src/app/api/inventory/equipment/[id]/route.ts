import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EquipmentService } from '@/lib/services/equipment.service'
import { updateEquipmentSchema, equipmentIdSchema } from '@/lib/validations/inventory/equipment'
import { ZodError } from 'zod'
import { canManageInventory, canManageAsset, inventoryForbidden } from '@/lib/inventory-access'
import { prisma } from '@/lib/prisma'
import { calculateDepreciation } from '@/lib/inventory/depreciation'
import { getFamilyConfig } from '@/lib/inventory/family-config'
import { resolveSectionsForMode } from '@/lib/inventory/family-config-types'
import {
  syncEquipmentContractLink,
  getLinkedBusinessContractId,
} from '@/lib/inventory/equipment-contract'
import { getEquipmentDisplayName } from '@/lib/utils/equipment-display'
import { isValidInvoiceNumber, INVOICE_NUMBER_ERROR } from '@/lib/inventory/invoice-number'
import { hasAccessToEquipment } from '@/lib/middleware/family-filter'
import { randomUUID } from 'crypto'
import {
  assertResourceTypeChangeAllowed,
  InventoryAccessError,
  inventoryAccessToResponse,
  toInventoryAccessUser,
} from '@/lib/inventory/inventory-resource-access'

/**
 * GET /api/inventory/equipment/[id]
 * Obtiene detalles de un equipo
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Validar ID
    const { id: rawId } = await params
    const { id } = equipmentIdSchema.parse({ id: rawId })

    // Verificar acceso al equipo usando middleware de permisos
    const hasAccess = await hasAccessToEquipment(
      session.user.id,
      session.user.role,
      session.user.isSuperAdmin || false,
      id
    )

    if (!hasAccess) {
      return NextResponse.json({ error: 'No tienes acceso a este equipo' }, { status: 403 })
    }

    // Obtener equipo
    const equipmentDetail = await EquipmentService.getEquipmentDetail(id)

    // Calcular depreciación si están disponibles los campos requeridos
    const eq = equipmentDetail.equipment as any
    let depreciation: ReturnType<typeof calculateDepreciation> | null = null

    const familyId = eq.type?.familyId ?? null
    const acquisitionMode = (eq.acquisitionMode ?? 'FIXED_ASSET') as
      | 'FIXED_ASSET'
      | 'RENTAL'
      | 'LOAN'
    const familyConfig = await getFamilyConfig(familyId)
    const canDepreciate =
      acquisitionMode === 'FIXED_ASSET' &&
      resolveSectionsForMode(familyConfig, acquisitionMode).visible.includes('DEPRECIATION')

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

    // El equipo asignado a un CLIENT le da acceso de lectura (ese es el
    // propósito de `hasAccessToEquipment` para su propio equipo), pero
    // `getEquipmentDetail` no proyecta columnas — devuelve TODO el modelo,
    // incluyendo precio de compra, número de factura/orden de compra,
    // costo mensual de renta y el RUT/tax ID del proveedor. Nada de eso es
    // asunto de quien solo tiene el equipo asignado.
    const responseEquipment: Record<string, unknown> = { ...eq, depreciation }
    let responseBatch = (equipmentDetail as { batch?: Record<string, unknown> }).batch
    if (session.user.role === 'CLIENT') {
      for (const field of [
        'purchasePrice',
        'estimatedPrice',
        'invoiceNumber',
        'purchaseOrderNumber',
        'rentalMonthlyCost',
        'rentalBuyoutValue',
        'residualValue',
        'saleListingPrice',
      ]) {
        delete responseEquipment[field]
      }
      const supplier = responseEquipment.supplier as
        | { id: string; name: string; taxId?: string }
        | undefined
      if (supplier) {
        responseEquipment.supplier = { id: supplier.id, name: supplier.name }
      }
      if (responseBatch) {
        const batchRest = { ...responseBatch }
        delete batchRest.unitPrice
        responseBatch = batchRest
      }
    }

    return NextResponse.json({
      ...equipmentDetail,
      equipment: responseEquipment,
      batch: responseBatch,
    })
  } catch (error) {
    console.error('Error en GET /api/inventory/equipment/[id]:', error)

    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'ID inválido', details: error.errors }, { status: 400 })
    }

    if (error instanceof Error && error.message.includes('no encontrado')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json({ error: 'Error al obtener equipo' }, { status: 500 })
  }
}

/**
 * PUT /api/inventory/equipment/[id]
 * Actualiza un equipo
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (!(await canManageInventory(session.user.id, session.user.role))) {
      return inventoryForbidden()
    }

    // Validar ID
    const { id: rawId } = await params
    const { id } = equipmentIdSchema.parse({ id: rawId })

    // Verificar que el activo pertenezca a una familia accesible para el usuario
    const isSuperAdmin = (session.user as any).isSuperAdmin === true
    if (session.user.role !== 'ADMIN' || !isSuperAdmin) {
      const equipment = await prisma.equipment.findUnique({
        where: { id },
        select: { type: { select: { familyId: true } } },
      })
      const assetFamilyId = equipment?.type?.familyId ?? null
      const allowed = await canManageAsset(
        session.user.id,
        session.user.role,
        isSuperAdmin,
        assetFamilyId
      )
      if (!allowed) {
        return NextResponse.json(
          { error: 'No tienes permisos para editar este equipo' },
          { status: 403 }
        )
      }
    }

    const body = await request.json()

    // Validar datos base
    const validatedData = updateEquipmentSchema.parse(body)

    // Si se reasigna el tipo (y por tanto la familia), validar permiso en la
    // familia DESTINO — el chequeo de arriba solo cubrió la familia actual.
    if (validatedData.typeId) {
      try {
        await assertResourceTypeChangeAllowed(
          toInventoryAccessUser(session.user),
          'EQUIPMENT',
          validatedData.typeId
        )
      } catch (err) {
        if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
        throw err
      }
    }

    // Validación: si se envía departmentId diferente al actual, verificar que no haya asignación activa
    if (validatedData.departmentId !== undefined) {
      const currentEquipmentDept = await prisma.equipment.findUnique({
        where: { id },
        select: { departmentId: true } as any,
      })

      if (!currentEquipmentDept) {
        return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 })
      }

      if (validatedData.departmentId !== (currentEquipmentDept as any).departmentId) {
        const activeAssignment = await prisma.equipment_assignments.findFirst({
          where: { equipmentId: id, isActive: true },
        })

        if (activeAssignment) {
          return NextResponse.json(
            {
              error:
                'No se puede cambiar el departamento: el equipo tiene una asignación activa vigente',
            },
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
      saleListingPrice = undefined,
      rentalDeliveryDate = undefined,
      rentalBuyoutValue = undefined,
      rentalClientResponse = undefined,
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
      saleListingPrice?: number | null
      rentalDeliveryDate?: string | null
      rentalBuyoutValue?: number | null
      rentalClientResponse?: string | null
    }

    // Validación: N° Factura / N° Orden de Compra solo dígitos y guion
    if (!isValidInvoiceNumber(invoiceNumber) || !isValidInvoiceNumber(purchaseOrderNumber)) {
      return NextResponse.json({ error: INVOICE_NUMBER_ERROR }, { status: 400 })
    }

    // Validación: usefulLifeYears > 0
    if (usefulLifeYears !== undefined && usefulLifeYears !== null) {
      if (usefulLifeYears <= 0) {
        return NextResponse.json({ error: 'La vida útil debe ser mayor a cero' }, { status: 400 })
      }
    }

    // Validación: residualValue <= purchasePrice
    if (residualValue !== undefined && residualValue !== null) {
      const effectivePurchasePrice =
        validatedData.purchasePrice !== undefined
          ? validatedData.purchasePrice
          : (await prisma.equipment.findUnique({ where: { id }, select: { purchasePrice: true } }))
              ?.purchasePrice

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
        return NextResponse.json({ error: 'El proveedor especificado no existe' }, { status: 400 })
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
    const equipment = await EquipmentService.updateEquipment(id, validatedData, session.user.id)

    // Persistir campos financieros nuevos si se proporcionaron
    const financialFields: Record<string, unknown> = {}
    if ('departmentId' in body && validatedData.departmentId !== undefined)
      financialFields.departmentId = validatedData.departmentId
    if ('supplierId' in body) financialFields.supplierId = supplierId ?? null
    if ('invoiceNumber' in body) financialFields.invoiceNumber = invoiceNumber ?? null
    if ('purchaseOrderNumber' in body)
      financialFields.purchaseOrderNumber = purchaseOrderNumber ?? null
    if ('warehouseId' in body) financialFields.warehouseId = warehouseId ?? null
    if ('acquisitionMode' in body) {
      financialFields.acquisitionMode = acquisitionMode ?? null
      // ownershipType es el campo legado que todavía usan RentalAlertService,
      // los reportes y varios dashboards — sin este mirror, cambiar el modo
      // desde el formulario de edición (que solo manda acquisitionMode) lo
      // dejaba desincronizado en silencio (ver auditoría de ciclo de vida).
      financialFields.ownershipType = acquisitionMode ?? null
    }
    if ('contractStartDate' in body)
      financialFields.contractStartDate = contractStartDate ? new Date(contractStartDate) : null
    if ('contractEndDate' in body)
      financialFields.contractEndDate = contractEndDate ? new Date(contractEndDate) : null
    if ('contractRenewalCost' in body)
      financialFields.contractRenewalCost = contractRenewalCost ?? null
    if ('saleListingPrice' in body) financialFields.saleListingPrice = saleListingPrice ?? null
    if ('rentalDeliveryDate' in body)
      financialFields.rentalDeliveryDate = rentalDeliveryDate ? new Date(rentalDeliveryDate) : null
    if ('rentalBuyoutValue' in body) financialFields.rentalBuyoutValue = rentalBuyoutValue ?? null
    if ('rentalClientResponse' in body)
      financialFields.rentalClientResponse = rentalClientResponse ?? 'NOT_NOTIFIED'

    // Campos de depreciación/compra solo si la familia del activo los soporta
    // Y el modo sigue siendo FIXED_ASSET — si no, se limpian explícitamente
    // en vez de solo dejar de pedirlos (el cliente los omite del payload al
    // cambiar de modo, pero eso el servidor lo interpreta como "no tocar",
    // no como "ya no aplica", y el valor viejo quedaba pegado — ver auditoría).
    const currentEquipment = await prisma.equipment.findUnique({
      where: { id },
      select: {
        acquisitionMode: true,
        type: { include: { family: true } },
      },
    })
    const currentFamilyId = currentEquipment?.type?.familyId ?? null
    const effectiveAcquisitionMode = (acquisitionMode ??
      currentEquipment?.acquisitionMode ??
      'FIXED_ASSET') as 'FIXED_ASSET' | 'RENTAL' | 'LOAN'
    const familyConfig = await getFamilyConfig(currentFamilyId)
    const depreciationAllowed =
      effectiveAcquisitionMode === 'FIXED_ASSET' &&
      resolveSectionsForMode(familyConfig, effectiveAcquisitionMode).visible.includes(
        'DEPRECIATION'
      )

    if (depreciationAllowed) {
      if ('usefulLifeYears' in body) financialFields.usefulLifeYears = usefulLifeYears ?? null
      if ('residualValue' in body) financialFields.residualValue = residualValue ?? null
      if ('depreciationRate' in body) financialFields.depreciationRate = depreciationRate ?? null
      if ('depreciationMethod' in body)
        financialFields.depreciationMethod = depreciationMethod ?? null
      if ('totalUnits' in body) financialFields.totalUnits = totalUnits ?? null
      if ('usedUnits' in body) financialFields.usedUnits = usedUnits ?? null
    } else if ('acquisitionMode' in body) {
      // La familia sí permite depreciación pero el modo ya no es FIXED_ASSET
      // (o viceversa) — limpiamos igual, son mutuamente excluyentes con
      // RENTAL/LOAN sin importar la config de la familia.
      financialFields.usefulLifeYears = null
      financialFields.residualValue = null
      financialFields.depreciationRate = null
      financialFields.depreciationMethod = null
      financialFields.totalUnits = null
      financialFields.usedUnits = null
    }

    // El precio de compra (financialFields.purchasePrice) es del bloque
    // FINANCIERO, no del de depreciación — depende solo del modo, no de si la
    // familia además muestra depreciación (ver showFinancial en el formulario).
    if ('acquisitionMode' in body && effectiveAcquisitionMode !== 'FIXED_ASSET') {
      financialFields.purchasePrice = null
    }

    if (Object.keys(financialFields).length > 0) {
      await prisma.equipment.update({
        where: { id },
        data: financialFields,
      })
    }

    // Handle customValues
    if ('customValues' in body) {
      const customValues = Array.isArray(body.customValues) ? body.customValues : []

      // Delete existing custom values
      await prisma.equipment_custom_values.deleteMany({
        where: { equipmentId: id },
      })

      // Crear los nuevos valores personalizados si hay
      if (customValues.length > 0) {
        await prisma.equipment_custom_values.createMany({
          data: customValues.map((cv: { fieldName: string; fieldValue: string }) => ({
            id: randomUUID(),
            equipmentId: id,
            fieldName: cv.fieldName,
            fieldValue: cv.fieldValue,
          })),
        })
      }
    }

    if ('contractId' in body || ('acquisitionMode' in body && acquisitionMode === 'RENTAL')) {
      const effectiveAcquisitionMode =
        acquisitionMode ??
        (
          await prisma.equipment.findUnique({
            where: { id },
            select: { acquisitionMode: true },
          })
        )?.acquisitionMode

      const contractIdFromBody =
        'contractId' in body ? ((body.contractId as string | null | undefined) ?? null) : undefined
      const contractLineCostFromBody =
        body.contractLineCost != null ? Number(body.contractLineCost) : undefined

      if (effectiveAcquisitionMode === 'RENTAL') {
        const linkedContractId =
          contractIdFromBody !== undefined
            ? contractIdFromBody
            : await getLinkedBusinessContractId(id)

        if (!linkedContractId) {
          return NextResponse.json(
            { error: 'Debes asociar un contrato para activos en arrendamiento' },
            { status: 422 }
          )
        }

        if (contractIdFromBody !== undefined) {
          const updatedEquipment = await prisma.equipment.findUnique({
            where: { id },
            include: { model: { include: { brand: true } }, type: true },
          })
          const equipmentLabel = updatedEquipment
            ? getEquipmentDisplayName({
                equipmentCode: updatedEquipment.code,
                equipmentTypeName: updatedEquipment.type?.name,
                equipmentBrandName: updatedEquipment.model?.brand?.name || updatedEquipment.brand,
                equipmentModelName:
                  updatedEquipment.model?.model || updatedEquipment.modelDeprecated,
              })
            : id

          await syncEquipmentContractLink(
            id,
            contractIdFromBody,
            equipmentLabel,
            contractLineCostFromBody
          )
        }
      } else if (contractIdFromBody !== undefined) {
        // El modo ya no es RENTAL — nunca debe quedar vinculado a un contrato
        // de arrendamiento, sin importar qué contractId (posiblemente
        // obsoleto, de antes de cambiar de modalidad) siga mandando el
        // formulario mientras el selector de contrato está oculto (ver
        // auditoría de ciclo de vida: "contrato fantasma").
        await syncEquipmentContractLink(id, null, id)
      }
    }

    // Auditoría ya se registra en EquipmentService.updateEquipment

    return NextResponse.json(equipment)
  } catch (error) {
    console.error('Error en PUT /api/inventory/equipment/[id]:', error)

    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }

    if (error instanceof Error && error.message.includes('no encontrado')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    if (error instanceof Error && error.message.includes('asignación activa')) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }

    return NextResponse.json({ error: 'Error al actualizar equipo' }, { status: 500 })
  }
}

/**
 * PATCH /api/inventory/equipment/[id]
 * Actualización parcial de un equipo — actualmente soporta { saleListingPrice }
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (!(await canManageInventory(session.user.id, session.user.role))) {
      return inventoryForbidden()
    }

    const { id: rawId } = await params
    const { id } = equipmentIdSchema.parse({ id: rawId })

    const body = await request.json()

    // Only allow patching saleListingPrice for now
    if (!('saleListingPrice' in body)) {
      return NextResponse.json({ error: 'No hay campos válidos para actualizar' }, { status: 400 })
    }

    const { saleListingPrice } = body as { saleListingPrice: number | null }

    if (
      saleListingPrice !== null &&
      (typeof saleListingPrice !== 'number' || saleListingPrice <= 0)
    ) {
      return NextResponse.json(
        { error: 'El precio de venta debe ser un número positivo' },
        { status: 400 }
      )
    }

    const updated = await prisma.equipment.update({
      where: { id },
      data: { saleListingPrice: saleListingPrice ?? null },
      select: { id: true, saleListingPrice: true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error en PATCH /api/inventory/equipment/[id]:', error)

    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'ID inválido', details: error.errors }, { status: 400 })
    }

    if (error instanceof Error && error.message.includes('no encontrado')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json({ error: 'Error al actualizar equipo' }, { status: 500 })
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
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Solo pueden eliminar: ADMIN (cualquiera) o gestores con acceso a la familia del activo
    const isSuperAdmin = (session.user as any).isSuperAdmin === true
    const isAdmin = session.user.role === 'ADMIN'

    if (!isAdmin) {
      // Verificar permiso global de gestión
      const hasGlobalPermission = await canManageInventory(session.user.id, session.user.role)
      if (!hasGlobalPermission) {
        return NextResponse.json(
          { error: 'No tienes permisos para eliminar equipos' },
          { status: 403 }
        )
      }
    }

    // Validar ID
    const { id: rawId } = await params
    const { id } = equipmentIdSchema.parse({ id: rawId })

    // Verificar que el activo pertenezca a una familia accesible para el usuario
    if (!isAdmin || !isSuperAdmin) {
      const equipment = await prisma.equipment.findUnique({
        where: { id },
        select: { type: { select: { familyId: true } } },
      })
      const assetFamilyId = equipment?.type?.familyId ?? null
      const allowed = await canManageAsset(
        session.user.id,
        session.user.role,
        isSuperAdmin,
        assetFamilyId
      )
      if (!allowed) {
        return NextResponse.json(
          { error: 'No tienes permisos para eliminar este equipo' },
          { status: 403 }
        )
      }
    }

    // Eliminar equipo
    await EquipmentService.deleteEquipment(id, session.user.id)

    // Auditoría ya se registra en EquipmentService.deleteEquipment

    return NextResponse.json({ message: 'Equipo retirado exitosamente' })
  } catch (error) {
    console.error('Error en DELETE /api/inventory/equipment/[id]:', error)

    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'ID inválido', details: error.errors }, { status: 400 })
    }

    if (error instanceof Error && error.message.includes('no encontrado')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    if (error instanceof Error && error.message.includes('asignación activa')) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }

    return NextResponse.json({ error: 'Error al eliminar equipo' }, { status: 500 })
  }
}
