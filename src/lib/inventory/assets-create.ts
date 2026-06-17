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
    contractAction,
    contractId: bodyContractId,
    contractNumber,
    contractStartDate,
    contractEndDate,
    contractMonthlyCost,
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

  const contractValidation = validateContractRequirement(
    acquisitionMode,
    bodyContractId,
    contractAction
  )
  if (!contractValidation.valid) return { error: contractValidation.error!, status: 422 }

  // Crear contrato embebido si corresponde
  let resolvedContractId: string | undefined = bodyContractId ?? undefined
  if (contractAction === 'create') {
    const defaultLicenseType = await prisma.license_types.findFirst({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    })
    const newContract = await prisma.software_licenses.create({
      data: {
        id: randomUUID(),
        name: contractNumber ?? 'Contrato',
        typeId: defaultLicenseType?.id ?? '',
        vendor: supplierId ?? undefined,
        cost: contractMonthlyCost ?? undefined,
        purchaseDate: contractStartDate ? new Date(contractStartDate) : undefined,
        expirationDate: contractEndDate ? new Date(contractEndDate) : undefined,
        supplierId: supplierId ?? undefined,
      },
    })
    resolvedContractId = newContract.id
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

    const equipmentModel = await prisma.equipment_models.findUnique({
      where: { id: modelId },
      include: { brand: true },
    })
    if (!equipmentModel) return { error: 'El modelo de equipo no existe', status: 404 }

    const equipmentId = randomUUID()
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
          status: status ?? 'AVAILABLE',
          condition: condition ?? 'NEW',
          ownershipType: acquisitionMode ?? 'FIXED_ASSET',
          acquisitionMode: acquisitionMode ?? undefined,
          supplierId: supplierId ?? undefined,
          contractId: resolvedContractId ?? undefined,
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

      if (status === 'ASSIGNED' && assignedUserId) {
        const receiver = await tx.users.findUnique({
          where: { id: assignedUserId },
          select: { departmentId: true },
        })
        const assignmentEndDate = body.assignmentEndDate ?? undefined
        await tx.equipment_assignments.create({
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

    // ── MRO ──────────────────────────────────────────────────────────────────
  } else if (subtype === 'MRO') {
    const resolvedWarehouseId = warehouseId ?? defaultWarehouseId
    const initialStatus = calculateConsumableStatus(
      currentStock ?? 0,
      minStock ?? 0,
      expirationDate ? new Date(expirationDate) : null
    )
    asset = await prisma.consumables.create({
      data: {
        id: randomUUID(),
        name: name ?? '',
        typeId: typeId ?? '',
        unitOfMeasureId: unitOfMeasureId ?? '',
        currentStock: currentStock ?? 0,
        minStock: minStock ?? 0,
        maxStock: maxStock ?? 0,
        supplierId: supplierId ?? undefined,
        warehouseId: resolvedWarehouseId,
        status: initialStatus,
        expirationDate: expirationDate ? new Date(expirationDate) : undefined,
      },
    })

    // ── LICENSE ───────────────────────────────────────────────────────────────
  } else if (subtype === 'LICENSE') {
    const resolvedLicenseTypeId = body.licenseTypeId || typeId
    if (!resolvedLicenseTypeId) return { error: 'El tipo de licencia es obligatorio', status: 400 }
    asset = await prisma.software_licenses.create({
      data: {
        id: randomUUID(),
        name: name ?? '',
        typeId: resolvedLicenseTypeId,
        key: key ?? undefined,
        expirationDate: expirationDate ? new Date(expirationDate) : undefined,
        supplierId: supplierId ?? undefined,
        cost: cost ?? undefined,
      },
    })
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
