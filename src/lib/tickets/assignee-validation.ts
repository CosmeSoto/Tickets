import prisma from '@/lib/prisma'

/**
 * Garantiza que el técnico asignado pertenezca activamente a la familia del ticket.
 * No-op si falta assigneeId o familyId (asignación libre o ticket sin familia).
 */
export async function assertTechnicianActiveInFamily(
  assigneeId: string | null | undefined,
  familyId: string | null | undefined
): Promise<void> {
  if (!assigneeId || !familyId) return

  const assignment = await prisma.technician_family_assignments.findFirst({
    where: {
      technicianId: assigneeId,
      familyId,
      isActive: true,
    },
  })

  if (!assignment) {
    throw new Error('El técnico no tiene asignación activa para la familia de este ticket')
  }
}
