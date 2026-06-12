import { prisma } from '@/lib/prisma'

export interface ModelAggregation {
  modelId: string
  brand: string
  model: string
  typeId: string
  typeName: string
  total: number
  available: number
  assigned: number
  maintenance: number
  retired: number
  utilizationRate: number
  batchCount: number
  individualCount: number
  totalValue: number
  averagePrice: number
  firstAcquisition?: Date
  lastAcquisition?: Date
}

export interface ModelDetails extends ModelAggregation {
  equipment: any[]
  batches: any[]
  acquisitionHistory: Array<{
    date: Date
    quantity: number
    source: 'batch' | 'individual'
    batchId?: string
  }>
  statusDistribution: Record<string, number>
}

export interface BatchComparison {
  batchId: string
  batchCode: string
  quantity: number
  supplier: string
  unitPrice: number
  purchaseDate: Date
  failureRate: number
  condition: string
  accessories: any[]
  customValues: any
}

export class ModelAggregationService {
  /**
   * Obtener todos los modelos con métricas agregadas.
   * Usa groupBy para evitar cargar todos los equipos en memoria.
   */
  static async getAllModels(filters?: {
    typeId?: string
    departmentId?: string
    search?: string
  }): Promise<ModelAggregation[]> {
    const where: any = {}

    if (filters?.typeId) where.typeId = filters.typeId
    if (filters?.departmentId) where.departmentId = filters.departmentId
    if (filters?.search) {
      where.OR = [
        { brand: { contains: filters.search, mode: 'insensitive' } },
        { modelDeprecated: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    // 1 query: conteo por modelId + status
    const statusGroups = await prisma.equipment.groupBy({
      by: ['modelId', 'status'],
      where,
      _count: { id: true },
    })

    if (statusGroups.length === 0) return []

    const modelIds = [...new Set(statusGroups.map(g => g.modelId))]

    // 1 query: datos de los modelos (incluye marca)
    const models = await prisma.equipment_models.findMany({
      where: { id: { in: modelIds } },
      include: { brand: true, type: true },
    })
    const modelMap = new Map(models.map(m => [m.id, m]))

    // 1 query: conteo de lotes por modelId (equipos con batchId)
    const batchGroups = await prisma.equipment.groupBy({
      by: ['modelId', 'batchId'],
      where: { modelId: { in: modelIds }, batchId: { not: null } },
      _count: { id: true },
    })

    // 1 query: valores financieros por modelo
    const financialGroups = await prisma.equipment.groupBy({
      by: ['modelId'],
      where: { modelId: { in: modelIds }, purchasePrice: { not: null } },
      _sum: { purchasePrice: true },
      _count: { purchasePrice: true },
      _min: { purchaseDate: true },
      _max: { purchaseDate: true },
    })
    const finMap = new Map(financialGroups.map(f => [f.modelId, f]))

    // Construir mapa de métricas por modelId
    const metricsMap = new Map<
      string,
      {
        total: number
        available: number
        assigned: number
        maintenance: number
        retired: number
      }
    >()

    for (const g of statusGroups) {
      if (!metricsMap.has(g.modelId)) {
        metricsMap.set(g.modelId, {
          total: 0,
          available: 0,
          assigned: 0,
          maintenance: 0,
          retired: 0,
        })
      }
      const m = metricsMap.get(g.modelId)!
      const count = g._count.id
      m.total += count
      if (g.status === 'AVAILABLE') m.available = count
      if (g.status === 'ASSIGNED') m.assigned = count
      if (g.status === 'MAINTENANCE') m.maintenance = count
      if (g.status === 'RETIRED') m.retired = count
    }

    // Contar lotes únicos e individuales por modelo
    const batchCountMap = new Map<string, number>()
    const indivCountMap = new Map<string, number>()
    for (const g of batchGroups) {
      batchCountMap.set(g.modelId, (batchCountMap.get(g.modelId) ?? 0) + 1)
    }
    // individuales = total - equipos con batchId
    for (const [modelId, metrics] of metricsMap) {
      const withBatch = batchGroups
        .filter(g => g.modelId === modelId)
        .reduce((s, g) => s + g._count.id, 0)
      indivCountMap.set(modelId, metrics.total - withBatch)
    }

    const result: ModelAggregation[] = []
    for (const [modelId, metrics] of metricsMap) {
      const model = modelMap.get(modelId)
      if (!model) continue

      const fin = finMap.get(modelId)
      const totalValue = fin?._sum.purchasePrice ?? 0
      const priceCount = fin?._count.purchasePrice ?? 0
      const averagePrice = priceCount > 0 ? totalValue / priceCount : 0

      result.push({
        modelId,
        brand: model.brand?.name ?? '',
        model: model.model,
        typeId: model.typeId,
        typeName: model.type?.name ?? 'Sin tipo',
        ...metrics,
        utilizationRate: metrics.total > 0 ? (metrics.assigned / metrics.total) * 100 : 0,
        batchCount: batchCountMap.get(modelId) ?? 0,
        individualCount: indivCountMap.get(modelId) ?? 0,
        totalValue,
        averagePrice,
        firstAcquisition: fin?._min.purchaseDate ?? undefined,
        lastAcquisition: fin?._max.purchaseDate ?? undefined,
      })
    }

    return result.sort((a, b) => b.total - a.total)
  }

  /**
   * Obtener detalles completos de un modelo
   */
  static async getModelDetails(modelId: string): Promise<ModelDetails | null> {
    const equipment = await prisma.equipment.findMany({
      where: { modelId },
      include: {
        type: true,
        model: true,
        department: true,
        warehouse: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    if (equipment.length === 0) return null

    const first = equipment[0]
    const total = equipment.length
    const available = equipment.filter(e => e.status === 'AVAILABLE').length
    const assigned = equipment.filter(e => e.status === 'ASSIGNED').length
    const maintenance = equipment.filter(e => e.status === 'MAINTENANCE').length
    const retired = equipment.filter(e => e.status === 'RETIRED').length

    const batchIds = new Set(equipment.filter(e => e.batchId).map(e => e.batchId!))
    const batchCount = batchIds.size
    const individualCount = equipment.filter(e => !e.batchId).length

    const prices = equipment.filter(e => e.purchasePrice).map(e => e.purchasePrice!)
    const totalValue = prices.reduce((s, p) => s + p, 0)
    const averagePrice = prices.length > 0 ? totalValue / prices.length : 0

    const dates = equipment
      .filter(e => e.purchaseDate)
      .map(e => e.purchaseDate!)
      .sort((a, b) => a.getTime() - b.getTime())

    const batches = await prisma.equipment_batches.findMany({
      where: { id: { in: [...batchIds] } },
      include: { supplier: true, model: true },
    })

    const acquisitionHistory: any[] = [
      ...batches.map(b => ({
        date: b.purchaseDate,
        quantity: b.quantity,
        source: 'batch',
        batchId: b.id,
      })),
      ...equipment
        .filter(e => !e.batchId && e.purchaseDate)
        .map(e => ({ date: e.purchaseDate!, quantity: 1, source: 'individual' })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime())

    return {
      modelId,
      brand: first.brand,
      model: first.modelDeprecated,
      typeId: first.typeId ?? '',
      typeName: (first as any).type?.name ?? 'Sin tipo',
      total,
      available,
      assigned,
      maintenance,
      retired,
      utilizationRate: total > 0 ? (assigned / total) * 100 : 0,
      batchCount,
      individualCount,
      totalValue,
      averagePrice,
      firstAcquisition: dates[0],
      lastAcquisition: dates[dates.length - 1],
      equipment,
      batches,
      acquisitionHistory,
      statusDistribution: {
        AVAILABLE: available,
        ASSIGNED: assigned,
        MAINTENANCE: maintenance,
        RETIRED: retired,
      },
    }
  }

  /**
   * Comparar lotes de un modelo — sin N+1
   */
  static async compareBatches(modelId: string, batchIds: string[]): Promise<BatchComparison[]> {
    const [batches, statusCounts] = await Promise.all([
      prisma.equipment_batches.findMany({
        where: { id: { in: batchIds }, modelId },
        include: { supplier: true },
      }),
      prisma.equipment.groupBy({
        by: ['batchId', 'status'],
        where: { batchId: { in: batchIds } },
        _count: { id: true },
      }),
    ])

    // Mapa batchId → conteos
    const countMap = new Map<string, { total: number; maintenance: number }>()
    for (const g of statusCounts) {
      if (!g.batchId) continue
      if (!countMap.has(g.batchId)) countMap.set(g.batchId, { total: 0, maintenance: 0 })
      const c = countMap.get(g.batchId)!
      c.total += g._count.id
      if (g.status === 'MAINTENANCE') c.maintenance = g._count.id
    }

    return batches.map(batch => {
      const counts = countMap.get(batch.id) ?? { total: 0, maintenance: 0 }
      return {
        batchId: batch.id,
        batchCode: batch.batchCode,
        quantity: batch.quantity,
        supplier: batch.supplier?.name ?? 'Sin proveedor',
        unitPrice: batch.unitPrice,
        purchaseDate: batch.purchaseDate,
        failureRate: counts.total > 0 ? (counts.maintenance / counts.total) * 100 : 0,
        condition: batch.condition ?? 'N/A',
        accessories: (batch.accessories as any[]) ?? [],
        customValues: batch.customValues ?? {},
      }
    })
  }

  static async searchModels(query: string): Promise<ModelAggregation[]> {
    return this.getAllModels({ search: query })
  }
}
