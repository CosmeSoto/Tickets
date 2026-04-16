import prisma from '@/lib/prisma'

/**
 * Verifica si un usuario ADMIN puede gestionar (crear/editar/eliminar)
 * una categoría que pertenece a una familia específica.
 *
 * Jerarquía:
 *   SuperAdmin  → puede gestionar cualquier categoría
 *   Admin normal → puede gestionar categorías de sus familias asignadas
 *                  (si no tiene asignaciones explícitas → acceso total, compatibilidad)
 *   Otros roles → no pueden gestionar categorías (solo ADMIN llega aquí)
 *
 * @param userId       ID del admin que intenta la acción
 * @param isSuperAdmin Si el usuario es superadmin
 * @param categoryFamilyId  ID de la familia de la categoría (via departments.familyId)
 */
export async function canManageCategory(
  userId: string,
  isSuperAdmin: boolean,
  categoryFamilyId: string | null | undefined
): Promise<boolean> {
  // SuperAdmin: acceso total
  if (isSuperAdmin) return true

  // Sin familia asignada a la categoría → cualquier admin puede
  if (!categoryFamilyId) return true

  try {
    const assignments = await prisma.admin_family_assignments.findMany({
      where: { adminId: userId, isActive: true },
      select: { familyId: true },
    })
    // Sin asignaciones explícitas → acceso total (compatibilidad con admins existentes)
    if (assignments.length === 0) return true
    return assignments.some(a => a.familyId === categoryFamilyId)
  } catch {
    // Si la tabla no existe, no restringir
    return true
  }
}

/**
 * Obtiene la familyId de una categoría a través de su departamento.
 * Retorna null si la categoría no tiene departamento o el departamento no tiene familia.
 */
export async function getCategoryFamilyId(categoryId: string): Promise<string | null> {
  try {
    const category = await prisma.categories.findUnique({
      where: { id: categoryId },
      select: {
        departments: { select: { familyId: true } }
      }
    })
    return category?.departments?.familyId ?? null
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
      select: { familyId: true }
    })
    return dept?.familyId ?? null
  } catch {
    return null
  }
}
