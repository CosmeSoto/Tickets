import { prisma } from '@/lib/prisma'

/**
 * Verifica si un usuario tiene acceso a una familia de inventario.
 * ADMIN siempre retorna true.
 * Gestor: verifica inventory_manager_families.
 */
export async function checkFamilyAccess(
  userId: string,
  assetFamilyId: string,
  userRole: string
): Promise<boolean> {
  if (userRole === 'ADMIN') return true

  const assignment = await prisma.inventory_manager_families.findFirst({
    where: { managerId: userId, familyId: assetFamilyId },
  })
  return assignment !== null
}
