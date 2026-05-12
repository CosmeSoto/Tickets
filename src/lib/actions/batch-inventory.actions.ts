'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { canManageInventory } from '@/lib/inventory-access'
import { BatchService } from '@/lib/services/batch-inventory.service'

export async function deleteBatch(
  batchId: string
): Promise<{ success: boolean; error?: string; deletedCount?: number }> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { success: false, error: 'No autenticado' }
    }

    const allowed =
      session.user.role === 'ADMIN' ||
      (await canManageInventory(session.user.id, session.user.role))
    if (!allowed) {
      return { success: false, error: 'No autorizado' }
    }

    const result = await BatchService.delete(batchId)
    return { success: true, deletedCount: result.deletedCount }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error al eliminar el lote'
    return { success: false, error: message }
  }
}
