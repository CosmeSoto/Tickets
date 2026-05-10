'use server'

import { ModelAggregationService } from '../services/model-aggregation.service'
import { withAuth } from './action-wrapper'

export async function getAllModels(filters?: {
  typeId?: string
  departmentId?: string
  search?: string
}) {
  return withAuth(async () => ModelAggregationService.getAllModels(filters))
}

export async function getModelDetails(modelId: string) {
  return withAuth(async () => {
    const details = await ModelAggregationService.getModelDetails(modelId)
    if (!details) throw new Error('Modelo no encontrado')
    return details
  })
}

export async function compareBatches(modelId: string, batchIds: string[]) {
  return withAuth(async () => ModelAggregationService.compareBatches(modelId, batchIds))
}

export async function searchModels(query: string) {
  return withAuth(async () => ModelAggregationService.searchModels(query))
}
