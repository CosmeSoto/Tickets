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
   * Obtener todos los modelos con métricas agregadas
   */
  static async getAllModels(filters?: {
    typeId?: string
    departmentId?: string
    search?: string
  }): Promise<ModelAggregation[]> {
    const where: any = {
      deletedAt: null,
    }

    if (filters?.typeId) where.typeId = filters.typeId
    if (filters?.departmentId) where.departmentId = filters.departmentId
    if (filters?.search) {
      where.OR = [
        { brand: { contains: filters.search, mode: 'insensitive' } },
        { model_old: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    // Obtener todos los equipos
    const equipment = await prisma.equipment.findMany({
      where,
      include: {
        type: true,
        model: true,
      },
    })

    // Agrupar por modelo
    const modelMap = new Map<string, any[]>()
    equipment.forEach(eq => {
      const key = `${eq.modelId}`
      if (!modelMap.has(key)) {
        modelMap.set(key, [])
      }
      modelMap.get(key)!.push(eq)
    })

    // Calcular métricas por modelo
    const models: ModelAggregation[] = []
    for (const [modelId, items] of modelMap.entries()) {
      const first = items[0]
      const total = items.length
      const available = items.filter(e => e.status === 'AVAILABLE').length
      const assigned = items.filter(e => e.status === 'ASSIGNED').length
      const maintenance = items.filter(e => e.status === 'MAINTENANCE').length
      const retired = items.filter(e => e.status === 'RETIRED').length
      const utilizationRate = total > 0 ? (assigned / total) * 100 : 0

      const batchCount = new Set(items.filter(e => e.batchId).map(e => e.batchId)).size
      const individualCount = items.filter(e => !e.batchId).length

      const prices = items.filter(e => e.purchasePrice).map(e => e.purchasePrice!)
      const totalValue = prices.reduce((sum, p) => sum + p, 0)
      const averagePrice = prices.length > 0 ? totalValue / prices.length : 0

      const dates = items
        .filter(e => e.purchaseDate)
        .map(e => e.purchaseDate!)
        .sort((a, b) => a.getTime() - b.getTime())

      models.push({
        modelId,
        brand: first.brand,
        model: first.model_old,
        typeId: first.typeId,
        typeName: first.type?.name || 'Sin tipo',
        total,
        available,
        assigned,
        maintenance,
        retired,
        utilizationRate,
        batchCount,
        individualCount,
        totalValue,
        averagePrice,
        firstAcquisition: dates[0],
        lastAcquisition: dates[dates.length - 1],
      })
    }

    // Ordenar por total descendente
    return models.sort((a, b) => b.total - a.total)
  }

  /**
   * Obtener detalles completos de un modelo
   */
  static async getModelDetails(modelId: string): Promise<ModelDetails | null> {
    // Obtener equipos del modelo
    const equipment = await prisma.equipment.findMany({
      where: {
        modelId,
        deletedAt: null,
      },
      include: {
        type: true,
        model: true,
        department: true,
        warehouse: true,
        assignments: {
          where: { returnedAt: null },
          include: { receiver: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (equipment.length === 0) {
      return null
    }

    const first = equipment[0]

    // Calcular métricas
    const total = equipment.length
    const available = equipment.filter(e => e.status === 'AVAILABLE').length
    const assigned = equipment.filter(e => e.status === 'ASSIGNED').length
    const maintenance = equipment.filter(e => e.status === 'MAINTENANCE').length
    const retired = equipment.filter(e => e.status === 'RETIRED').length
    const utilizationRate = total > 0 ? (assigned / total) * 100 : 0

    // Contar lotes e individuales
    const batchIds = new Set(equipment.filter(e => e.batchId).map(e => e.batchId))
    const batchCount = batchIds.size
    const individualCount = equipment.filter(e => !e.batchId).length

    // Calcular valores
    const prices = equipment.filter(e => e.purchasePrice).map(e => e.purchasePrice!)
    const totalValue = prices.reduce((sum, p) => sum + p, 0)
    const averagePrice = prices.length > 0 ? totalValue / prices.length : 0

    // Fechas de adquisición
    const dates = equipment
      .filter(e => e.purchaseDate)
      .map(e => e.purchaseDate!)
      .sort((a, b) => a.getTime() - b.getTime())

    // Obtener lotes
    const batches = await prisma.equipment_batches.findMany({
      where: {
        id: { in: Array.from(batchIds) as string[] },
      },
      include: {
        supplier: true,
        model: true,
      },
    })

    // Construir historial de adquisiciones
    const acquisitionHistory: any[] = []

    // Agregar lotes
    batches.forEach(batch => {
      acquisitionHistory.push({
        date: batch.purchaseDate,
        quantity: batch.quantity,
        source: 'batch',
        batchId: batch.id,
      })
    })

    // Agregar individuales
    equipment
      .filter(e => !e.batchId && e.purchaseDate)
      .forEach(e => {
        acquisitionHistory.push({
          date: e.purchaseDate!,
          quantity: 1,
          source: 'individual',
        })
      })

    acquisitionHistory.sort((a, b) => b.date.getTime() - a.date.getTime())

    // Distribución por estado
    const statusDistribution: Record<string, number> = {
      AVAILABLE: available,
      ASSIGNED: assigned,
      MAINTENANCE: maintenance,
      RETIRED: retired,
    }

    return {
      modelId,
      brand: first.brand,
      model: first.model_old,
      typeId: first.typeId,
      typeName: first.type?.name || 'Sin tipo',
      total,
      available,
      assigned,
      maintenance,
      retired,
      utilizationRate,
      batchCount,
      individualCount,
      totalValue,
      averagePrice,
      firstAcquisition: dates[0],
      lastAcquisition: dates[dates.length - 1],
      equipment,
      batches,
      acquisitionHistory,
      statusDistribution,
    }
  }

  /**
   * Comparar lotes de un modelo
   */
  static async compareBatches(modelId: string, batchIds: string[]): Promise<BatchComparison[]> {
    const batches = await prisma.equipment_batches.findMany({
      where: {
        id: { in: batchIds },
        modelId,
      },
      include: {
        supplier: true,
      },
    })

    const comparisons: BatchComparison[] = []

    for (const batch of batches) {
      // Obtener equipos del lote
      const equipment = await prisma.equipment.findMany({
        where: {
          batchId: batch.id,
          deletedAt: null,
        },
      })

      const total = equipment.length
      const inMaintenance = equipment.filter(e => e.status === 'MAINTENANCE').length
      const failureRate = total > 0 ? (inMaintenance / total) * 100 : 0

      comparisons.push({
        batchId: batch.id,
        batchCode: batch.batchCode,
        quantity: batch.quantity,
        supplier: batch.supplier?.name || 'Sin proveedor',
        unitPrice: batch.unitPrice,
        purchaseDate: batch.purchaseDate,
        failureRate,
        condition: batch.condition || 'N/A',
        accessories: (batch.accessories as any[]) || [],
        customValues: batch.customValues || {},
      })
    }

    return comparisons
  }

  /**
   * Buscar modelos
   */
  static async searchModels(query: string): Promise<ModelAggregation[]> {
    return this.getAllModels({ search: query })
  }
}
