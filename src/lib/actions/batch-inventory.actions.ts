'use server'

import { revalidatePath } from 'next/cache'
import { BatchService } from '../services/batch-inventory.service'
import { batchCreationSchema } from '../schemas/equipment-inventory.schema'
import { withAuth } from './action-wrapper'

function revalidateInventory() {
  revalidatePath('/inventory')
  revalidatePath('/inventory/batches')
  revalidatePath('/inventory/models')
}

export async function createBatchEquipment(data: unknown) {
  return withAuth(
    async userId => {
      const validated = batchCreationSchema.parse(data)
      const result = await BatchService.createBatch(validated, userId)
      revalidateInventory()
      return {
        batchId: result.batch.id,
        batchCode: result.batch.batchCode,
        quantity: result.equipment.length,
        codes: result.equipment.map(e => e.code),
      }
    },
    { successMessage: `Lote creado exitosamente` }
  )
}

export async function getBatchDetails(batchId: string) {
  return withAuth(async () => BatchService.getDetails(batchId))
}

export async function deleteBatch(batchId: string) {
  return withAuth(
    async () => {
      const result = await BatchService.delete(batchId)
      revalidateInventory()
      return result
    },
    { successMessage: 'Lote eliminado exitosamente' }
  )
}

export async function getBatchHistory(batchId: string) {
  return withAuth(async () => BatchService.getHistory(batchId))
}
