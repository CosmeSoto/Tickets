'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { canManageInventory } from '@/lib/inventory-access'
import { BatchService } from '@/lib/services/batch-inventory.service'
import { createAuditLog } from '@/lib/audit'
import { notifyFamilyScopedAdminsExcept } from '@/lib/api/notify'
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
      select: {
        batchCode: true,
        quantity: true,
        model: { select: { type: { select: { familyId: true } } } },
      },
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

    // Acción irreversible que retira equipos y libera vínculos de contrato —
    // avisamos a los admins de la familia, no solo queda en el audit log.
    await notifyFamilyScopedAdminsExcept(
      batch.model?.type?.familyId ?? null,
      session.user.id,
      'WARNING',
      `Lote eliminado: ${batch.batchCode}`,
      `Se eliminó el lote ${batch.batchCode} — ${result.deletedCount} equipo(s) quedaron retirados.`,
      { metadata: { link: '/inventory?tab=batches' } }
    ).catch(() => {})

    return { success: true, deletedCount: result.deletedCount }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error al eliminar el lote'
    return { success: false, error: message }
  }
}
