import { prisma } from '@/lib/prisma'
import { ValidationService } from './validation-inventory.service'
import { BatchCreationInput } from '../schemas/equipment-inventory.schema'
import {
  BatchFilters,
  BatchMetrics,
  BatchHistoryEvent,
  BatchDepreciationSummary,
  BatchCloneTemplate,
  BatchUtilizationOverview,
} from '@/types/inventory/batch-inventory'
import { getBatchUtilizationAlerts } from '@/lib/inventory/batch-alerts'
import { getBatchAlertSettings } from '@/lib/inventory/batch-alert-settings'
import { Prisma, EquipmentCondition } from '@prisma/client'
import { resolveBrandName } from '@/lib/utils/equipment-display'
import { calculateDepreciation, type DepreciationMethod } from '@/lib/inventory/depreciation'

const DEPRECIATION_METHOD_LABELS: Record<string, string> = {
  LINEAR: 'Línea recta',
  DECLINING_BALANCE: 'Saldo decreciente',
  UNITS_OF_PRODUCTION: 'Por uso',
}

/** Tipo de lote con relaciones y métricas calculadas */
export type BatchWithMetrics = Prisma.equipment_batchesGetPayload<{
  include: {
    model: {
      include: {
        brand: { select: { id: true; name: true } }
        type: true
      }
    }
    department: true
    supplier: true
  }
}> & { metrics: BatchMetrics }

export class BatchService {
  /**
   * Crear lote con múltiples equipos
   */
  static async createBatch(data: BatchCreationInput, userId: string) {
    const { commonData, equipmentData } = data

    // Validar códigos únicos
    const codes = equipmentData.map(e => e.code)
    const codeValidation = await ValidationService.validateBatchCodes(codes)
    if (!codeValidation.isValid) {
      const firstError = Object.values(codeValidation.errors)[0]
      throw new Error(firstError || 'Hay códigos duplicados')
    }

    // Validar seriales únicos
    const serials = equipmentData.map(e => e.serialNumber)
    const serialValidation = await ValidationService.validateBatchSerials(serials)
    if (!serialValidation.isValid) {
      const firstError = Object.values(serialValidation.errors)[0]
      throw new Error(firstError || 'Hay números de serie duplicados')
    }

    // Obtener datos del modelo
    const model = await prisma.equipment_models.findUnique({
      where: { id: commonData.modelId },
      include: { brand: true, type: true },
    })

    if (!model) {
      throw new Error('Modelo no encontrado')
    }

    // Resolver nombre de marca para campos deprecated
    const modelBrandName = model.brand?.name ?? ''

    // Generar código de lote
    const batchCode = `BATCH-${Date.now()}`
    const quantity = equipmentData.length
    const totalPrice = (commonData.unitPrice || 0) * quantity

    // Transacción: crear lote y equipos
    const result = await prisma.$transaction(
      async tx => {
        // 1. Crear lote
        const batch = await tx.equipment_batches.create({
          data: {
            batchCode,
            description: `Lote de ${quantity} ${modelBrandName} ${model.model}`,
            modelId: commonData.modelId,
            quantity,
            supplierId: commonData.supplierId,
            purchaseDate: commonData.purchaseDate ? new Date(commonData.purchaseDate) : new Date(),
            unitPrice: commonData.unitPrice || 0,
            totalPrice,
            invoiceNumber: commonData.invoiceNumber,
            purchaseOrderNumber: commonData.purchaseOrderNumber,
            warehouseId: commonData.warehouseId || '',
            status: 'received',
            receivedBy: userId,
            receivedAt: new Date(),
            notes: commonData.notes,
            customValues: commonData.customValues || {},
            accessories: commonData.accessories || [],
            condition: commonData.condition,
            propertyType: commonData.propertyType,
            departmentId: commonData.departmentId,
          },
        })

        // 2. Crear equipos
        const equipmentPromises = equipmentData.map(item => {
          const qrCode = `EQ-${item.code}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
          return tx.equipment.create({
            data: {
              code: item.code,
              serialNumber: item.serialNumber || '',
              modelId: commonData.modelId,
              brand: modelBrandName,
              modelDeprecated: model.model,
              typeId: model.typeId,
              batchId: batch.id,
              departmentId: commonData.departmentId,
              warehouseId: item.warehouseId || commonData.warehouseId,
              location: item.physicalLocation,
              condition: (commonData.condition || EquipmentCondition.NEW) as EquipmentCondition,
              ownershipType: (commonData.propertyType || 'FIXED_ASSET') as any,
              purchaseDate: commonData.purchaseDate ? new Date(commonData.purchaseDate) : null,
              purchasePrice: commonData.unitPrice,
              accessories: commonData.accessories?.map(a => a.name) || [],
              notes: commonData.notes,
              status: 'AVAILABLE' as any,
              qrCode,
            },
          })
        })

        const equipment = await Promise.all(equipmentPromises)

        return { batch, equipment }
      },
      {
        timeout: 30000, // 30 segundos
      }
    )

    return result
  }

  /**
   * Obtener detalles de un lote con métricas
   */
  static async getDetails(batchId: string) {
    const batch = await prisma.equipment_batches.findUnique({
      where: { id: batchId },
      include: {
        model: {
          include: {
            brand: { select: { id: true, name: true } },
            type: true,
          },
        },
        department: true,
        supplier: true,
        warehouse: true,
        receiver: true,
      },
    })

    if (!batch) {
      throw new Error('Lote no encontrado')
    }

    // Calcular métricas
    const equipment = await prisma.equipment.findMany({
      where: { batchId },
      include: {
        warehouse: { select: { name: true } },
        department: { select: { name: true } },
      },
      orderBy: { code: 'asc' },
    })

    const metrics: BatchMetrics = {
      total: equipment.length,
      available: equipment.filter(e => e.status === 'AVAILABLE').length,
      assigned: equipment.filter(e => e.status === 'ASSIGNED').length,
      maintenance: equipment.filter(e => e.status === 'MAINTENANCE').length,
      retired: equipment.filter(e => e.status === 'RETIRED').length,
      utilizationRate:
        equipment.length > 0
          ? (equipment.filter(e => e.status === 'ASSIGNED').length / equipment.length) * 100
          : 0,
    }

    const depreciationSummary = BatchService.computeDepreciationSummary(
      equipment,
      batch.propertyType
    )

    const integrity = await ValidationService.validateBatchIntegrity(batchId)

    return {
      ...batch,
      model: {
        ...batch.model,
        brand: resolveBrandName(batch.model.brand as { name?: string } | string | null),
      },
      metrics,
      equipment,
      depreciationSummary,
      integrity,
    }
  }

  /**
   * Plantilla para duplicar configuración de un lote (nueva compra / recompra).
   */
  static async buildCloneTemplate(batchId: string): Promise<BatchCloneTemplate> {
    const batch = await prisma.equipment_batches.findUnique({
      where: { id: batchId },
      include: {
        model: {
          include: {
            brand: { select: { name: true } },
            type: { include: { family: { select: { id: true, code: true } } } },
          },
        },
      },
    })

    if (!batch) throw new Error('Lote no encontrado')

    const accessories = Array.isArray(batch.accessories)
      ? (batch.accessories as Array<{ name?: string } | string>)
          .map(a => (typeof a === 'string' ? a : (a.name ?? '')))
          .filter(Boolean)
      : []

    return {
      sourceBatchId: batch.id,
      sourceBatchCode: batch.batchCode,
      familyId: batch.model.type?.family?.id ?? '',
      familyCode: batch.model.type?.family?.code ?? undefined,
      modelId: batch.modelId,
      typeId: batch.model.typeId ?? '',
      brand: batch.model.brand?.name ?? '',
      model: batch.model.model,
      quantity: batch.quantity,
      condition: batch.condition ?? 'NEW',
      ownershipType: batch.propertyType ?? 'FIXED_ASSET',
      departmentId: batch.departmentId ?? undefined,
      supplierId: batch.supplierId ?? undefined,
      unitPrice: batch.unitPrice ?? undefined,
      purchaseDate: batch.purchaseDate?.toISOString(),
      invoiceNumber: batch.invoiceNumber ?? undefined,
      purchaseOrderNumber: batch.purchaseOrderNumber ?? undefined,
      warehouseId: batch.warehouseId || undefined,
      notes: batch.notes ?? undefined,
      accessories,
    }
  }

  /**
   * Resumen de depreciación agregada del lote (activos fijos con datos completos).
   */
  static computeDepreciationSummary(
    equipment: Array<{
      purchasePrice: number | null
      purchaseDate: Date | null
      usefulLifeYears: number | null
      residualValue: number | null
      depreciationMethod: string | null
      acquisitionMode: string | null
      totalUnits: number | null
      usedUnits: number | null
    }>,
    propertyType: string | null | undefined
  ): BatchDepreciationSummary | null {
    const mode = propertyType ?? equipment[0]?.acquisitionMode
    if (mode !== 'FIXED_ASSET') return null

    const sample = equipment.find(
      e => e.depreciationMethod && e.usefulLifeYears != null && e.purchasePrice != null
    )
    if (!sample?.depreciationMethod || sample.usefulLifeYears == null) return null

    let totalBookValue = 0
    let totalAccumulated = 0
    let totalPurchase = 0
    let withDepreciation = 0

    for (const eq of equipment) {
      if (!eq.purchasePrice || !eq.usefulLifeYears || !eq.purchaseDate) continue
      const method = (eq.depreciationMethod ?? sample.depreciationMethod) as DepreciationMethod
      const result = calculateDepreciation(
        eq.purchasePrice,
        new Date(eq.purchaseDate),
        eq.usefulLifeYears,
        eq.residualValue ?? 0,
        new Date(),
        method,
        { totalUnits: eq.totalUnits ?? undefined, usedUnits: eq.usedUnits ?? undefined }
      )
      totalBookValue += result.bookValue
      totalAccumulated += result.accumulatedDepreciation
      totalPurchase += eq.purchasePrice
      withDepreciation++
    }

    if (withDepreciation === 0) return null

    return {
      method: sample.depreciationMethod,
      methodLabel:
        DEPRECIATION_METHOD_LABELS[sample.depreciationMethod] ?? sample.depreciationMethod,
      usefulLifeYears: sample.usefulLifeYears,
      residualValuePerUnit: sample.residualValue ?? 0,
      equipmentWithDepreciation: withDepreciation,
      totalUnits: equipment.length,
      totalPurchaseValue: totalPurchase,
      totalBookValue,
      totalAccumulatedDepreciation: totalAccumulated,
    }
  }

  /**
   * Obtener historial de un lote (creación, asignaciones y devoluciones).
   */
  static async getHistory(batchId: string): Promise<BatchHistoryEvent[]> {
    const batch = await prisma.equipment_batches.findUnique({
      where: { id: batchId },
      include: { receiver: { select: { name: true } } },
    })

    if (!batch) {
      throw new Error('Lote no encontrado')
    }

    const events: BatchHistoryEvent[] = [
      {
        type: 'created',
        date: batch.receivedAt ?? batch.createdAt,
        user: batch.receiver,
        description: `Lote ${batch.batchCode} recibido con ${batch.quantity} equipos`,
      },
    ]

    const assignments = await prisma.equipment_assignments.findMany({
      where: { equipment: { batchId } },
      include: {
        receiver: { select: { name: true } },
        deliverer: { select: { name: true } },
        equipment: { select: { code: true } },
      },
      orderBy: { startDate: 'desc' },
      take: 40,
    })

    for (const a of assignments) {
      events.push({
        type: 'assigned',
        date: a.startDate,
        user: a.deliverer,
        equipmentCode: a.equipment.code,
        description: `Asignación: ${a.equipment.code} → ${a.receiver.name ?? 'usuario'}`,
      })
      if (!a.isActive && (a.actualEndDate || a.endDate)) {
        events.push({
          type: 'returned',
          date: (a.actualEndDate ?? a.endDate)!,
          user: a.deliverer,
          equipmentCode: a.equipment.code,
          description: `Devolución: ${a.equipment.code}`,
        })
      }
    }

    const retired = await prisma.equipment.findMany({
      where: { batchId, status: 'RETIRED' },
      select: { code: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    })
    for (const eq of retired) {
      events.push({
        type: 'retired',
        date: eq.updatedAt,
        description: `Equipo ${eq.code} dado de baja`,
        equipmentCode: eq.code,
      })
    }

    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  /**
   * Obtener todos los lotes con filtros.
   * Usa una sola query agregada para las métricas — sin N+1.
   */
  static async getAll(filters?: BatchFilters): Promise<BatchWithMetrics[]> {
    const where: any = {}

    if (filters?.modelId) where.modelId = filters.modelId
    if (filters?.supplierId) where.supplierId = filters.supplierId
    if (filters?.departmentId) where.departmentId = filters.departmentId
    if (filters?.status) where.status = filters.status
    if (filters?.typeId) where.model = { typeId: filters.typeId }

    if (filters?.dateFrom || filters?.dateTo) {
      where.purchaseDate = {}
      if (filters.dateFrom) where.purchaseDate.gte = filters.dateFrom
      if (filters.dateTo) where.purchaseDate.lte = filters.dateTo
    }

    const batches = await prisma.equipment_batches.findMany({
      where,
      include: {
        model: { include: { brand: { select: { id: true, name: true } }, type: true } },
        department: true,
        supplier: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    if (batches.length === 0) return []

    const batchIds = batches.map(b => b.id)

    const statusCounts = await prisma.equipment.groupBy({
      by: ['batchId', 'status'],
      where: { batchId: { in: batchIds } },
      _count: { id: true },
    })

    const metricsMap = new Map<string, BatchMetrics>()

    for (const row of statusCounts) {
      if (!row.batchId) continue
      if (!metricsMap.has(row.batchId)) {
        metricsMap.set(row.batchId, {
          total: 0,
          available: 0,
          assigned: 0,
          maintenance: 0,
          retired: 0,
          utilizationRate: 0,
        })
      }
      const m = metricsMap.get(row.batchId)!
      const count = row._count.id
      m.total += count
      if (row.status === 'AVAILABLE') m.available = count
      if (row.status === 'ASSIGNED') m.assigned = count
      if (row.status === 'MAINTENANCE') m.maintenance = count
      if (row.status === 'RETIRED') m.retired = count
    }

    return batches.map(batch => {
      const metrics = metricsMap.get(batch.id) ?? {
        total: 0,
        available: 0,
        assigned: 0,
        maintenance: 0,
        retired: 0,
        utilizationRate: 0,
      }
      metrics.utilizationRate = metrics.total > 0 ? (metrics.assigned / metrics.total) * 100 : 0
      return {
        ...batch,
        metrics,
      }
    })
  }

  /**
   * Eliminar lote
   */
  static async delete(batchId: string) {
    const validation = await ValidationService.validateBatchDeletion(batchId)
    if (!validation.canDelete) {
      throw new Error(validation.message)
    }

    const result = await prisma.$transaction(async tx => {
      const equipmentUpdate = await tx.equipment.updateMany({
        where: { batchId },
        data: { status: 'RETIRED' as any },
      })

      await tx.equipment_batches.delete({
        where: { id: batchId },
      })

      return {
        deletedCount: equipmentUpdate.count,
      }
    })

    return result
  }

  /**
   * Panorama de utilización de lotes — para dashboard y alertas agregadas.
   */
  static async getUtilizationOverview(): Promise<BatchUtilizationOverview> {
    const batches = await BatchService.getAll()

    let criticalCount = 0
    let warningCount = 0
    let totalAvailable = 0
    let totalAssigned = 0
    let totalUnits = 0
    let utilizationSum = 0

    const criticalBatches: BatchUtilizationOverview['criticalBatches'] = []
    const modelMap = new Map<
      string,
      BatchUtilizationOverview['byModel'][0] & { utilizationSum: number }
    >()

    for (const batch of batches) {
      const m = batch.metrics
      if (m.total === 0) continue

      totalAvailable += m.available
      totalAssigned += m.assigned
      totalUnits += m.total
      utilizationSum += m.utilizationRate

      const modelBrand = resolveBrandName(
        (batch.model as { brand?: string | { name?: string } | null }).brand ?? null
      )

      const familyId = batch.model.type?.familyId ?? null
      const alertSettings = await getBatchAlertSettings(familyId)
      if (!alertSettings.enabled) continue

      const alerts = getBatchUtilizationAlerts(m, {
        lowStockThresholdPct: alertSettings.lowStockThresholdPct,
      }).filter(a => a.level === 'critical' || a.level === 'warning')

      if (alerts.length > 0) {
        const hasCritical = alerts.some(a => a.level === 'critical')
        if (hasCritical) criticalCount++
        else warningCount++

        criticalBatches.push({
          id: batch.id,
          batchCode: batch.batchCode,
          brandModel: `${modelBrand} ${batch.model.model}`,
          typeName: batch.model.type?.name,
          metrics: m,
          topAlert: alerts[0].title,
          alertLevel: hasCritical ? 'critical' : 'warning',
        })
      }

      const modelId = batch.modelId
      const brandName = modelBrand
      if (!modelMap.has(modelId)) {
        modelMap.set(modelId, {
          modelId,
          brand: brandName,
          model: batch.model.model,
          typeName: batch.model.type?.name,
          batchCount: 0,
          totalUnits: 0,
          available: 0,
          assigned: 0,
          utilizationRate: 0,
          utilizationSum: 0,
        })
      }
      const row = modelMap.get(modelId)!
      row.batchCount++
      row.totalUnits += m.total
      row.available += m.available
      row.assigned += m.assigned
      row.utilizationSum += m.utilizationRate
    }

    const byModel = [...modelMap.values()]
      .map(({ utilizationSum: us, ...rest }) => ({
        ...rest,
        utilizationRate: rest.batchCount > 0 ? us / rest.batchCount : 0,
      }))
      .sort((a, b) => b.utilizationRate - a.utilizationRate)
      .slice(0, 10)

    criticalBatches.sort((a, b) => {
      if (a.alertLevel !== b.alertLevel) return a.alertLevel === 'critical' ? -1 : 1
      return b.metrics.utilizationRate - a.metrics.utilizationRate
    })

    const activeBatches = batches.filter(b => b.metrics.total > 0).length

    return {
      summary: {
        totalBatches: batches.length,
        criticalCount,
        warningCount,
        avgUtilization: activeBatches > 0 ? utilizationSum / activeBatches : 0,
        totalAvailable,
        totalAssigned,
        totalUnits,
      },
      criticalBatches: criticalBatches.slice(0, 8),
      byModel,
    }
  }
}
