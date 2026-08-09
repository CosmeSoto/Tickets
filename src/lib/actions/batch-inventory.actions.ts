'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { canManageInventory } from '@/lib/inventory-access'
import { BatchService } from '@/lib/services/batch-inventory.service'
import { createAuditLog } from '@/lib/audit'
import prisma from '@/lib/prisma'

export async function deleteBatch(
  batchId: string
): Promise<{ success: boolean; error?: string; deletedCount?: number }> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { success: false, error: 'No autenticado' }
    }

    const allowed = await canManageInventory(session.user.id, session.user.role)
    if (!allowed) {
      return { success: false, error: 'No autorizado' }
    }

    const batch = await prisma.equipment_batches.findUnique({
      where: { id: batchId },
      select: { batchCode: true, quantity: true },
    })
    if (!batch) {
      return { success: false, error: 'Lote no encontrado' }
    }

    const result = await BatchService.delete(batchId)

    await createAuditLog({
      entityType: 'inventory',
      entityId: batchId,
      action: 'batch_deleted',
      userId: session.user.id,
      changes: {
        batchCode: batch.batchCode,
        quantity: batch.quantity,
        retiredEquipmentCount: result.deletedCount,
      },
    })

    return { success: true, deletedCount: result.deletedCount }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error al eliminar el lote'
    return { success: false, error: message }
  }
}
