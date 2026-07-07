import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { generateAssetCode } from '@/lib/inventory/asset-code-generator'
import type { ImportCatalogContext, ParsedImportRow, EquipmentImportResult } from './types'
import type { ExistingEquipmentRef } from './row-validator'

interface ExecuteImportInput {
  context: ImportCatalogContext
  rows: ParsedImportRow[]
  userId: string
  mode: 'add' | 'update'
  skippedCount: number
}

export async function loadImportDependencies(context: ImportCatalogContext) {
  const [equipmentType, model, attributes, warehouses, existingEquipment] = await Promise.all([
    prisma.equipment_types.findUnique({
      where: { id: context.typeId },
      select: { id: true, name: true, familyId: true },
    }),
    prisma.equipment_models.findUnique({
      where: { id: context.modelId },
      include: { brand: { select: { id: true, name: true } } },
    }),
    prisma.equipment_type_attributes.findMany({
      where: { equipmentTypeId: context.typeId },
      orderBy: { order: 'asc' },
      select: {
        attributeName: true,
        attributeLabel: true,
        attributeType: true,
        isRequired: true,
        options: true,
      },
    }),
    prisma.warehouses.findMany({
      where: { familyId: context.familyId, isActive: true },
      select: { id: true, name: true, code: true },
    }),
    prisma.equipment.findMany({
      select: {
        id: true,
        serialNumber: true,
        code: true,
        modelId: true,
        typeId: true,
        status: true,
      },
    }),
  ])

  if (!equipmentType) throw new Error('Tipo de equipo no encontrado')
  if (equipmentType.familyId !== context.familyId) {
    throw new Error('El tipo no pertenece a la familia seleccionada')
  }
  if (!model) throw new Error('Modelo no encontrado')
  if (model.brandId !== context.brandId) {
    throw new Error('El modelo no pertenece a la marca seleccionada')
  }

  let defaultWarehouseId: string | undefined
  const defaultWarehouseSetting = await prisma.system_settings.findUnique({
    where: { key: 'inventory.default_warehouse_id' },
  })
  if (defaultWarehouseSetting?.value) defaultWarehouseId = defaultWarehouseSetting.value

  const existingBySerial = new Map<string, ExistingEquipmentRef>()
  for (const item of existingEquipment) {
    if (!item.serialNumber) continue
    existingBySerial.set(item.serialNumber.toLowerCase(), {
      id: item.id,
      code: item.code,
      modelId: item.modelId,
      typeId: item.typeId,
      status: item.status,
    })
  }

  return {
    equipmentType,
    model,
    attributes,
    warehouses,
    existingBySerial,
    defaultWarehouseId,
    brandName: model.brand?.name ?? '',
    modelName: model.model,
  }
}

export async function executeEquipmentImport(
  input: ExecuteImportInput
): Promise<EquipmentImportResult> {
  const { context, rows, userId, mode, skippedCount } = input
  const deps = await loadImportDependencies(context)

  const codes: string[] = []
  let created = 0
  let updated = 0

  await prisma.$transaction(async tx => {
    const equipmentPayload: Array<Record<string, unknown>> = []
    const customValuePayload: Array<{
      id: string
      equipmentId: string
      fieldName: string
      fieldValue: string
    }> = []

    for (const row of rows) {
      if (row.action === 'update' && row.existingEquipmentId) {
        const warehouseId = row.warehouseId ?? deps.defaultWarehouseId

        await tx.equipment.update({
          where: { id: row.existingEquipmentId },
          data: {
            condition: row.condition as never,
            physicalLocation: row.physicalLocation ?? null,
            warehouseId: warehouseId ?? null,
            invoiceNumber: row.invoiceNumber ?? null,
            purchaseDate: row.purchaseDate ?? null,
            purchasePrice: row.purchasePrice ?? null,
            accessories: row.accessories,
            notes: row.notes ?? null,
            updatedAt: new Date(),
          },
        })

        for (const cv of row.customValues) {
          await tx.equipment_custom_values.upsert({
            where: {
              equipmentId_fieldName: {
                equipmentId: row.existingEquipmentId,
                fieldName: cv.fieldName,
              },
            },
            create: {
              id: randomUUID(),
              equipmentId: row.existingEquipmentId,
              fieldName: cv.fieldName,
              fieldValue: cv.fieldValue,
            },
            update: {
              fieldValue: cv.fieldValue,
            },
          })
        }

        updated++
        continue
      }

      const equipmentId = randomUUID()
      const code = await generateAssetCode(context.familyId, 'EQUIPMENT', context.acquisitionMode)
      codes.push(code)

      const warehouseId = row.warehouseId ?? deps.defaultWarehouseId

      equipmentPayload.push({
        id: equipmentId,
        code,
        serialNumber: row.serialNumber,
        brand: deps.brandName,
        modelDeprecated: deps.modelName,
        modelId: context.modelId,
        typeId: context.typeId,
        status: 'AVAILABLE',
        condition: row.condition,
        ownershipType: context.acquisitionMode,
        acquisitionMode: context.acquisitionMode,
        physicalLocation: row.physicalLocation ?? null,
        warehouseId: warehouseId ?? null,
        invoiceNumber: row.invoiceNumber ?? null,
        purchaseDate: row.purchaseDate ?? null,
        purchasePrice: row.purchasePrice ?? null,
        accessories: row.accessories,
        notes: row.notes ?? null,
        qrCode: randomUUID(),
      })

      for (const cv of row.customValues) {
        customValuePayload.push({
          id: randomUUID(),
          equipmentId,
          fieldName: cv.fieldName,
          fieldValue: cv.fieldValue,
        })
      }

      created++
    }

    if (equipmentPayload.length > 0) {
      await tx.equipment.createMany({ data: equipmentPayload as never[] })
    }

    if (customValuePayload.length > 0) {
      await tx.equipment_custom_values.createMany({
        data: customValuePayload,
        skipDuplicates: true,
      })
    }

    await tx.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'BULK_IMPORT',
        entityType: 'equipment',
        entityId: 'bulk',
        userId,
        details: {
          mode,
          familyId: context.familyId,
          typeId: context.typeId,
          brandId: context.brandId,
          modelId: context.modelId,
          acquisitionMode: context.acquisitionMode,
          created,
          updated,
          skipped: skippedCount,
        },
      },
    })
  })

  return {
    valid: true,
    total: rows.length + skippedCount,
    created,
    updated,
    skipped: skippedCount,
    errors: [],
    codes,
  }
}
