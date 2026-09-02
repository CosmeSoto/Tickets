/**
 * Lógica de creación (POST) de activos: EQUIPMENT, MRO, LICENSE.
 * Extraído de /api/inventory/assets/route.ts para mantener ese archivo manejable.
 */
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { getFamilyConfig, validateSubtypeForFamily } from '@/lib/inventory/family-config'
import {
  validateSupplierRequirement,
  validateContractRequirement,
} from '@/lib/inventory/asset-validation'
import { generateAssetCode } from '@/lib/inventory/asset-code-generator'
import { calculateConsumableStatus } from '@/lib/inventory/consumable-status'
import { linkEquipmentToContract } from '@/lib/inventory/equipment-contract'
import { linkLicenseToBusinessContract, mapLicenseScope } from '@/lib/inventory/license-contract'
import { DeliveryActService } from '@/lib/services/delivery-act.service'
import { EquipmentInvoiceService } from '@/lib/services/equipment-invoice.service'
import { LicenseInvoiceService } from '@/lib/services/license-invoice.service'
import { ConsumableService } from '@/lib/services/consumable.service'
import { LicenseService } from '@/lib/services/license.service'
import type { CreateLicenseData } from '@/types/inventory/license'
import { InventoryDepartmentService } from '@/lib/services/inventory-department.service'
import { AssignmentService } from '@/lib/services/assignment.service'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CreateAssetBody = Record<string, any>

export interface CreateAssetResult {
  asset: { id: string; [key: string]: unknown }
  subtype: string
}

export interface CreateAssetValidationError {
  error: string
  status: number
}

/** Retorna un error de validación o el activo creado */
export async function createAsset(
  body: CreateAssetBody,
  userId: string
): Promise<CreateAssetResult | CreateAssetValidationError> {
  const {
    subtype,
    familyId,
    name,
    acquisitionMode,
    supplierId,
    contractId: bodyContractId,
    code,
    serialNumber,
    brandId,
    modelId,
    typeId,
    warehouseId,
    estimatedPrice,
    purchaseDate,
    purchasePrice,
    invoiceNumber,
    purchaseOrderNumber,
    usefulLifeYears,
    residualValue,
    depreciationMethod,
    unitOfMeasureId,
    currentStock,
    minStock,
    maxStock,
    expirationDate,
    key,
    cost,
  } = body

  if (!familyId) return { error: 'Falta el área (familyId) del activo', status: 400 }
  if (!subtype) return { error: 'Falta el tipo de activo (subtype)', status: 400 }

  const config = await getFamilyConfig(familyId)
  const subtypeValidation = validateSubtypeForFamily(subtype, config)
  if (!subtypeValidation.valid) return { error: subtypeValidation.error!, status: 422 }

  const supplierValidation = validateSupplierRequirement(acquisitionMode, supplierId)
  if (!supplierValidation.valid) return { error: supplierValidation.error!, status: 422 }

  const contractValidation = validateContractRequirement(acquisitionMode, bodyContractId)
  if (!contractValidation.valid) return { error: contractValidation.error!, status: 422 }

  if (bodyContractId) {
    const contractExists =
      (await prisma.contracts.findUnique({
        where: { id: bodyContractId },
        select: { id: true },
      })) ??
      (await prisma.software_licenses.findUnique({
        where: { id: bodyContractId },
        select: { id: true },
      }))
    if (!contractExists) {
      return { error: 'El contrato seleccionado no existe', status: 404 }
    }
  }

  // Código automático
  const resolvedCode =
    code && String(code).trim()
      ? String(code).trim()
      : await generateAssetCode(familyId, subtype, acquisitionMode).catch(() => {
          const ts = Date.now().toString(36).toUpperCase()
          return `${(subtype ?? 'EQ').slice(0, 3)}-${ts}`
        })

  // Bodega por defecto
  let defaultWarehouseId: string | undefined
  const defaultWarehouseSetting = await prisma.system_settings.findUnique({
    where: { key: 'inventory.default_warehouse_id' },
  })
  if (defaultWarehouseSetting?.value) defaultWarehouseId = defaultWarehouseSetting.value

  let asset: { id: string; [key: string]: unknown }

  // ── EQUIPMENT ────────────────────────────────────────────────────────────
  if (subtype === 'EQUIPMENT') {
    if (!typeId) return { error: 'El tipo de equipo es obligatorio', status: 400 }
    if (!brandId) return { error: 'La marca es obligatoria', status: 400 }
    if (!modelId) return { error: 'El modelo es obligatorio', status: 400 }

    const equipmentType = await prisma.equipment_types.findUnique({
      where: { id: typeId },
      select: { familyId: true },
    })
    if (!equipmentType) return { error: 'El tipo de equipo no existe', status: 404 }
    if (equipmentType.familyId !== familyId) {
      return { error: 'El tipo de equipo no pertenece al área seleccionada', status: 422 }
    }

    if (serialNumber && String(serialNumber).trim()) {
      const duplicateSerial = await prisma.equipment.findFirst({
        where: { serialNumber: String(serialNumber).trim() },
        select: { id: true },
      })
      if (duplicateSerial) {
        return { error: 'Ya existe un equipo con ese número de serie', status: 409 }
      }
    }

    const resolvedWarehouseId = warehouseId ?? defaultWarehouseId
    const {
      status,
      condition,
      totalUnits,
      usedUnits,
      physicalLocation,
      assignedUserId,
      maintenanceDate,
      maintenanceType,
      maintenanceTechnicianId,
      maintenanceDescription,
      saleListingPrice,
    } = body

    const accessories = Array.isArray(body.accessories) ? body.accessories : []
    const specifications =
      body.specifications &&
      typeof body.specifications === 'object' &&
      !Array.isArray(body.specifications)
        ? body.specifications
        : undefined
    const notes = body.notes ? String(body.notes) : undefined
    const customValues = Array.isArray(body.customValues) ? body.customValues : []
    const resolvedDepartmentId = body.departmentId ? String(body.departmentId) : undefined
    const equipmentStatus = status ?? 'AVAILABLE'

    if (equipmentStatus === 'ASSIGNED' && !assignedUserId) {
      return {
        error: 'Debes seleccionar un usuario cuando el estado es Asignado',
        status: 422,
      }
    }

    if (equipmentStatus === 'ASSIGNED' && assignedUserId) {
      const receiver = await prisma.users.findUnique({
        where: { id: assignedUserId },
        select: { id: true },
      })
      if (!receiver) return { error: 'Usuario asignado no encontrado', status: 404 }
    }

    const equipmentModel = await prisma.equipment_models.findUnique({
      where: { id: modelId },
      include: { brand: true },
    })
    if (!equipmentModel) return { error: 'El modelo de equipo no existe', status: 404 }

    // Requerir info financiera en activos nuevos — hasta ahora esta regla solo
    // se validaba en el cliente (EquipmentAssetForm/BulkEquipmentForm), así
    // que un caller de la API podía saltársela por completo.
    const financialRequired =
      (acquisitionMode ?? 'FIXED_ASSET') === 'FIXED_ASSET' &&
      (condition ?? 'NEW') === 'NEW' &&
      config.requireFinancialForNew !== false
    if (financialRequired && (purchasePrice == null || purchasePrice === '')) {
      return { error: 'El precio de compra es obligatorio para activos nuevos', status: 422 }
    }

    const equipmentId = randomUUID()
    let createdAssignmentId: string | undefined

    asset = await prisma.$transaction(async tx => {
      const created = await (tx.equipment.create as any)({
        data: {
          id: equipmentId,
          code: resolvedCode,
          serialNumber: serialNumber ?? '',
          brand: equipmentModel.brand?.name ?? '',
          modelDeprecated: equipmentModel.model ?? '',
          modelId,
          typeId,
          departmentId: resolvedDepartmentId,
          status: equipmentStatus,
          condition: condition ?? 'NEW',
          ownershipType: acquisitionMode ?? 'FIXED_ASSET',
          acquisitionMode: acquisitionMode ?? undefined,
          supplierId: supplierId ?? undefined,
          purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
          purchasePrice: purchasePrice ?? undefined,
          invoiceNumber: invoiceNumber ?? undefined,
          purchaseOrderNumber: purchaseOrderNumber ?? undefined,
          usefulLifeYears: usefulLifeYears ?? undefined,
          residualValue: residualValue ?? undefined,
          depreciationMethod: depreciationMethod ?? undefined,
          totalUnits: totalUnits ?? undefined,
          usedUnits: usedUnits ?? undefined,
          physicalLocation: physicalLocation ?? undefined,
          warehouseId: resolvedWarehouseId,
          accessories,
          specifications: specifications ?? undefined,
          notes: notes ?? undefined,
          estimatedPrice: estimatedPrice ?? undefined,
          rentalDeliveryDate: body.rentalDeliveryDate
            ? new Date(body.rentalDeliveryDate)
            : undefined,
          rentalBuyoutValue:
            body.rentalBuyoutValue != null && body.rentalBuyoutValue !== ''
              ? Number(body.rentalBuyoutValue)
              : undefined,
          rentalClientResponse: body.rentalClientResponse || undefined,
          customValues:
            customValues.length > 0
              ? {
                  create: customValues.map((cv: { fieldName: string; fieldValue: string }) => ({
                    fieldName: cv.fieldName,
                    fieldValue: cv.fieldValue,
                  })),
                }
              : undefined,
          qrCode: randomUUID(),
          saleListingPrice: saleListingPrice ?? null,
        },
      })

      if (equipmentStatus === 'ASSIGNED' && assignedUserId) {
        const receiver = await tx.users.findUnique({
          where: { id: assignedUserId },
          select: { departmentId: true },
        })
        const assignmentEndDate = body.assignmentEndDate ?? undefined
        const assignment = await tx.equipment_assignments.create({
          data: {
            id: randomUUID(),
            equipmentId: created.id,
            receiverId: assignedUserId,
            delivererId: userId,
            assignmentType: assignmentEndDate ? 'TEMPORARY' : 'PERMANENT',
            startDate: new Date(),
            endDate: assignmentEndDate ? new Date(assignmentEndDate) : undefined,
            isActive: true,
            accessories,
          },
        })
        createdAssignmentId = assignment.id
        if (receiver?.departmentId) {
          await (tx.equipment.update as any)({
            where: { id: created.id },
            data: { departmentId: receiver.departmentId },
          })
          created.departmentId = receiver.departmentId
        }
      }

      if (status === 'MAINTENANCE' && maintenanceDescription) {
        await tx.maintenance_records.create({
          data: {
            id: randomUUID(),
            equipmentId: created.id,
            type: maintenanceType ?? 'CORRECTIVE',
            status: 'SCHEDULED',
            date: maintenanceDate ? new Date(maintenanceDate) : new Date(),
            description: maintenanceDescription,
            technicianId: maintenanceTechnicianId ?? undefined,
            requestedById: userId,
          },
        })
      }

      return created
    })

    const equipmentLabel =
      `${equipmentModel.brand?.name ?? ''} ${equipmentModel.model ?? ''}`.trim()

    if (bodyContractId && acquisitionMode === 'RENTAL') {
      await linkEquipmentToContract(asset.id, bodyContractId, equipmentLabel || resolvedCode)
    }

    // Espejo automático en el libro de facturas (equipment_invoices) — si al
    // crear el equipo ya se informó el precio de compra, se registra también
    // como la primera factura/pago de adquisición, para que el usuario no
    // tenga que volver a escribir el mismo monto en "Registrar factura"
    // después. syncEquipmentPurchaseFields (disparado dentro de .create)
    // termina escribiendo de vuelta los mismos valores que ya se guardaron
    // arriba — es un no-op sobre los campos planos, solo crea la fila del
    // libro.
    if (
      (acquisitionMode ?? 'FIXED_ASSET') === 'FIXED_ASSET' &&
      purchasePrice != null &&
      purchasePrice > 0
    ) {
      // OJO: no pasar `purchaseDate` como `paidDate` acá — "fecha de compra"
      // es cuándo se adquirió el equipo, no cuándo se pagó la factura (son
      // cosas distintas: se puede comprar a crédito/con factura pendiente).
      // La factura se crea sin fecha de pago → PENDING, tal como cualquier
      // factura registrada manualmente. El pago se registra aparte con
      // "Pagar", igual que para cualquier otra factura.
      await EquipmentInvoiceService.create({
        equipmentId: asset.id,
        invoiceNumber: invoiceNumber || null,
        purchaseOrderNumber: purchaseOrderNumber || null,
        amount: Number(purchasePrice),
        supplierId: supplierId || null,
        createdBy: userId,
      })
    }

    if (createdAssignmentId) {
      const deptValidation = await InventoryDepartmentService.validateAssignmentDepartment(
        equipmentId,
        assignedUserId
      )
      if (deptValidation.valid === false) {
        await AssignmentService.rollbackAssignment(createdAssignmentId)
        return {
          error: `El receptor pertenece al departamento '${deptValidation.receiverDeptName}' pero el equipo pertenece al departamento '${deptValidation.requiredDeptName}'`,
          status: 422,
        }
      }

      const familyConfig = await prisma.inventory_family_config.findFirst({
        where: { family: { equipmentTypes: { some: { id: typeId } } } },
        select: { requireDeliveryAct: true },
      })
      if (familyConfig?.requireDeliveryAct !== false) {
        try {
          await DeliveryActService.generateDeliveryAct(createdAssignmentId)
        } catch (err) {
          await AssignmentService.rollbackAssignment(createdAssignmentId)
          console.error('[createAsset] Error generando acta de entrega:', err)
          return {
            error:
              'El equipo se creó pero falló la generación del acta de entrega. Operación revertida.',
            status: 500,
          }
        }
      }
    }

    // ── MRO ──────────────────────────────────────────────────────────────────
  } else if (subtype === 'MRO') {
    if (!name?.trim()) return { error: 'El nombre del suministro es obligatorio', status: 400 }
    if (!typeId) return { error: 'El tipo de suministro es obligatorio', status: 400 }
    if (!unitOfMeasureId) return { error: 'La unidad de medida es obligatoria', status: 400 }

    const consumableType = await prisma.consumable_types.findUnique({
      where: { id: typeId },
      select: { familyId: true, name: true },
    })
    if (!consumableType) {
      return { error: 'El tipo de suministro no existe', status: 404 }
    }
    if (consumableType.familyId && consumableType.familyId !== familyId) {
      return {
        error: 'El tipo de suministro no pertenece al área seleccionada',
        status: 422,
      }
    }

    const parsedMin = minStock ?? 0
    const parsedMax = maxStock ?? 0
    const parsedCurrent = currentStock ?? 0
    if (parsedMax > 0 && parsedMax < parsedMin) {
      return { error: 'El stock máximo debe ser mayor o igual al mínimo', status: 422 }
    }
    if (parsedMax > 0 && parsedCurrent > parsedMax) {
      return { error: 'El stock inicial no puede exceder el stock máximo', status: 422 }
    }

    const resolvedWarehouseId = warehouseId ?? defaultWarehouseId
    const initialStatus = calculateConsumableStatus(
      parsedCurrent,
      parsedMin,
      expirationDate ? new Date(expirationDate) : null
    )
    const customValues = Array.isArray(body.customValues) ? body.customValues : undefined

    asset = await prisma.consumables.create({
      data: {
        id: randomUUID(),
        name: name.trim(),
        typeId,
        unitOfMeasureId,
        currentStock: 0,
        minStock: parsedMin,
        maxStock: parsedMax,
        supplierId: supplierId ?? undefined,
        warehouseId: resolvedWarehouseId,
        status: initialStatus,
        expirationDate: expirationDate ? new Date(expirationDate) : undefined,
        costPerUnit: body.costPerUnit ?? undefined,
        notes: body.notes ? String(body.notes) : undefined,
        customValues: customValues?.length ? customValues : undefined,
      },
    })

    if (parsedCurrent > 0) {
      await ConsumableService.createStockMovement(
        {
          consumableId: asset.id,
          type: 'ENTRY',
          quantity: parsedCurrent,
          reason: 'Stock inicial',
        },
        userId
      )
      asset = await prisma.consumables.findUniqueOrThrow({ where: { id: asset.id } })
    }

    // ── LICENSE ───────────────────────────────────────────────────────────────
  } else if (subtype === 'LICENSE') {
    const resolvedLicenseTypeId = body.licenseTypeId || typeId
    if (!resolvedLicenseTypeId) return { error: 'El tipo de licencia es obligatorio', status: 400 }
    if (!name?.trim()) return { error: 'El nombre de la licencia es obligatorio', status: 400 }

    const licenseType = await prisma.license_types.findFirst({
      where: { id: resolvedLicenseTypeId, familyId },
      select: { id: true },
    })
    if (!licenseType) {
      return { error: 'El tipo de licencia no pertenece al área seleccionada', status: 422 }
    }

    const licenseNotes = [
      body.notes ? String(body.notes) : null,
      body.contractNumber && !bodyContractId ? `N° contrato: ${String(body.contractNumber)}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    const license = await LicenseService.createLicense(
      {
        name: name.trim(),
        typeId: resolvedLicenseTypeId,
        key: key ? String(key) : undefined,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
        expirationDate: expirationDate ? new Date(expirationDate) : undefined,
        cost: cost ?? undefined,
        supplierId: supplierId ?? undefined,
        invoiceNumber: body.invoiceNumber ? String(body.invoiceNumber) : undefined,
        purchaseOrderNumber: body.purchaseOrderNumber
          ? String(body.purchaseOrderNumber)
          : undefined,
        renewalCost: body.renewalCost ?? undefined,
        renewalDate: body.renewalDate ? new Date(body.renewalDate) : undefined,
        licenseScope: mapLicenseScope(body.scope),
        // Prioriza el tipo de contrato elegido explícitamente en el formulario; si no se
        // especificó, se infiere de "pago recurrente" como respaldo (comportamiento previo).
        contractType:
          (body.contractType as CreateLicenseData['contractType']) ||
          (body.hasRecurring ? 'SOFTWARE' : undefined),
        notes: licenseNotes || undefined,
        assignedToUser: body.assignedToUser ? String(body.assignedToUser) : undefined,
        assignedToDepartment: body.assignedToDepartment
          ? String(body.assignedToDepartment)
          : undefined,
        customValues: Array.isArray(body.customValues) ? body.customValues : undefined,
      },
      userId
    )

    if (bodyContractId) {
      await linkLicenseToBusinessContract(license.id, bodyContractId, license.name)
    } else if (cost != null && Number(cost) > 0) {
      // Espejo automático en el libro de facturas (license_invoices) — solo
      // cuando NO hay contrato vinculado (ahí el costo viene del contrato,
      // que tiene su propio seguimiento de pagos, no es una compra puntual).
      // Igual que en equipos: evita que el usuario tenga que volver a
      // escribir el mismo monto en "Registrar factura" después.
      // Ver el comentario gemelo en la rama de equipment más arriba: "fecha
      // de compra" no es "fecha de pago" — la factura se crea PENDING y se
      // paga aparte con "Pagar".
      await LicenseInvoiceService.create({
        licenseId: license.id,
        invoiceNumber: body.invoiceNumber ? String(body.invoiceNumber) : null,
        purchaseOrderNumber: body.purchaseOrderNumber ? String(body.purchaseOrderNumber) : null,
        amount: Number(cost),
        supplierId: supplierId || null,
        createdBy: userId,
      })
    }

    asset = license
  } else {
    return { error: 'Subtipo no válido', status: 422 }
  }

  // Auditoría
  await prisma.audit_logs.create({
    data: {
      id: randomUUID(),
      action: 'CREATE',
      entityType: 'asset',
      entityId: asset.id,
      userId,
      details: {
        subtype,
        familyId,
        acquisitionMode: acquisitionMode ?? null,
        ...(subtype === 'MRO' && {
          warehouseId: warehouseId ?? defaultWarehouseId,
          initialStock: currentStock ?? 0,
        }),
        ...(subtype === 'EQUIPMENT' && { warehouseId: warehouseId ?? defaultWarehouseId }),
      },
    },
  })

  // Invalidar caché
  const { invalidateCache } = await import('@/lib/api-cache')
  await invalidateCache([
    'inventory:equipment:*',
    'inventory:consumables:*',
    'inventory:licenses:*',
  ]).catch(() => {})

  return { asset, subtype }
}
