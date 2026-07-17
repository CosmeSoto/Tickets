/**
 * Verifica si un usuario ADMIN puede gestionar (crear/editar/eliminar)
 * una categoría que pertenece a una familia específica.
 *
 * Jerarquía:
 *   SuperAdmin  → puede gestionar cualquier categoría
 *   Admin normal → solo categorías de su familia NATIVA (operar/soportar)
 *   Otros roles → no pueden gestionar categorías
 */

import prisma from '@/lib/prisma'

export async function canManageCategory(
  userId: string,
  isSuperAdmin: boolean,
  categoryFamilyId: string | null | undefined
): Promise<boolean> {
  if (isSuperAdmin) return true

  // Sin familia en la categoría → denegar (evitar acceso accidental)
  if (!categoryFamilyId) return false

  try {
    const { adminCanOperateTicketFamily } = await import('@/lib/auth/family-scope')
    return adminCanOperateTicketFamily(userId, categoryFamilyId, false)
  } catch {
    return false
  }
}

/**
 * Obtiene la familyId de una categoría (category.familyId o departments.familyId).
 */
export async function getCategoryFamilyId(categoryId: string): Promise<string | null> {
  try {
    const category = await prisma.categories.findUnique({
      where: { id: categoryId },
      select: {
        familyId: true,
        departments: { select: { familyId: true } },
      },
    })
    return category?.familyId ?? category?.departments?.familyId ?? null
  } catch {
    return null
  }
}

/**
 * Obtiene la familyId de un departamento.
 */
export async function getDepartmentFamilyId(departmentId: string): Promise<string | null> {
  try {
    const dept = await prisma.departments.findUnique({
      where: { id: departmentId },
      select: { familyId: true },
    })
    return dept?.familyId ?? null
  } catch {
    return null
  }
}
