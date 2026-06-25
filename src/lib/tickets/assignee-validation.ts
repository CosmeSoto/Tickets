import prisma from '@/lib/prisma'
import { technicianIsNativeToFamily } from '@/lib/auth/family-scope'

/**
 * Garantiza que el técnico asignado pertenezca nativamente a la familia del ticket.
 * No-op si falta assigneeId o familyId (asignación libre o ticket sin familia).
 */
export async function assertTechnicianActiveInFamily(
  assigneeId: string | null | undefined,
  familyId: string | null | undefined
): Promise<void> {
  if (!assigneeId || !familyId) return

  const assignee = await prisma.users.findUnique({
    where: { id: assigneeId },
    select: { role: true },
  })

  if (assignee?.role === 'ADMIN') return

  const isNative = await technicianIsNativeToFamily(assigneeId, familyId)
  if (!isNative) {
    throw new Error(
      'El técnico no pertenece nativamente a la familia de este ticket y no puede ser asignado'
    )
  }
}
