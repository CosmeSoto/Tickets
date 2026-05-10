import { unstable_cache } from 'next/cache'
import { ModelAggregationService } from '@/lib/services/model-aggregation.service'
import { BatchService } from '@/lib/services/batch-inventory.service'

/**
 * Cache tags para revalidación
 */
export const CACHE_TAGS = {
  MODELS: 'models',
  BATCHES: 'batches',
  EQUIPMENT: 'equipment',
  EQUIPMENT_TYPES: 'equipment-types',
} as const

/**
 * Obtener todos los modelos con cache de 5 minutos
 */
export const getCachedModels = unstable_cache(
  async (filters?: { typeId?: string; departmentId?: string; search?: string }) => {
    return ModelAggregationService.getAllModels(filters)
  },
  ['models-list'],
  {
    revalidate: 300, // 5 minutos
    tags: [CACHE_TAGS.MODELS, CACHE_TAGS.EQUIPMENT],
  }
)

/**
 * Obtener detalles de un modelo con cache de 5 minutos
 */
export const getCachedModelDetails = unstable_cache(
  async (modelId: string) => {
    return ModelAggregationService.getModelDetails(modelId)
  },
  ['model-details'],
  {
    revalidate: 300,
    tags: [CACHE_TAGS.MODELS, CACHE_TAGS.EQUIPMENT],
  }
)

/**
 * Obtener todos los lotes con cache de 5 minutos
 */
export const getCachedBatches = unstable_cache(
  async (filters?: { typeId?: string; departmentId?: string }) => {
    return BatchService.getAll(filters)
  },
  ['batches-list'],
  {
    revalidate: 300,
    tags: [CACHE_TAGS.BATCHES, CACHE_TAGS.EQUIPMENT],
  }
)
