import { prisma } from '@/lib/prisma'
import { ValidationService } from './validation-inventory.service'
import { BatchCreationInput } from '../schemas/equipment-inventory.schema'
import { BatchFilters, BatchMetrics } from '@/types/inventory/batch-inventory'
import { Prisma } from '@prisma/client'

/** Tipo de lote con relaciones y métricas calculadas */
export type BatchWithMetrics = Prisma.equipment_batchesGetPayload<{
  include: {
    model: { include: { type: true } }
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
      include: { type: true },
    })

    if (!model) {
      throw new Error('Modelo no encontrado')
    }

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
            description: `Lote de ${quantity} ${model.brand} ${model.model}`,
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
              brand: model.brand,
              model: model.model,
              typeId: model.typeId,
              batchId: batch.id,
              departmentId: commonData.departmentId,
              warehouseId: item.warehouseId || commonData.warehouseId,
              location: item.physicalLocation,
              condition: (commonData.condition || 'GOOD') as any,
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
            type: true,
          },
        },
        department: true,
        supplier: true,
        receiver: true,
      },
    })

    if (!batch) {
      throw new Error('Lote no encontrado')
    }

    // Calcular métricas
    const equipment = await prisma.equipment.findMany({
      where: { batchId },
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

    return {
      ...batch,
      metrics,
      equipment,
    }
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

    // 1 query: lotes con relaciones
    const batches = await prisma.equipment_batches.findMany({
      where,
      include: {
        model: { include: { type: true } },
        department: true,
        supplier: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    if (batches.length === 0) return []

    const batchIds = batches.map(b => b.id)

    // 1 query agregada: conteo por batchId + status (en lugar de N queries)
    const statusCounts = await prisma.equipment.groupBy({
      by: ['batchId', 'status'],
      where: { batchId: { in: batchIds } },
      _count: { id: true },
    })

    // Construir mapa batchId → métricas
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
      return { ...batch, metrics }
    })
  }

  /**
   * Obtener historial de un lote
   */
  static async getHistory(batchId: string) {
    const batch = await prisma.equipment_batches.findUnique({
      where: { id: batchId },
      include: {
        receiver: true,
      },
    })

    if (!batch) {
      throw new Error('Lote no encontrado')
    }

    // Por ahora solo retornamos evento de creación
    const history = [
      {
        type: 'created',
        date: batch.createdAt,
        user: batch.receiver,
        description: `Lote creado con ${batch.quantity} equipos`,
      },
    ]

    return history
  }

  /**
   * Eliminar lote
   */
  static async delete(batchId: string) {
    // Validar que se puede eliminar
    const validation = await ValidationService.validateBatchDeletion(batchId)
    if (!validation.canDelete) {
      throw new Error(validation.message)
    }

    // Transacción: soft delete equipos y hard delete lote
    const result = await prisma.$transaction(async tx => {
      // 1. Marcar equipos como RETIRED (no hay deletedAt en este modelo)
      const equipmentUpdate = await tx.equipment.updateMany({
        where: { batchId },
        data: { status: 'RETIRED' as any },
      })

      // 2. Hard delete del lote
      await tx.equipment_batches.delete({
        where: { id: batchId },
      })

      return {
        deletedCount: equipmentUpdate.count,
      }
    })

    return result
  }
}
