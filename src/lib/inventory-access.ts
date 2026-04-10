import prisma from '@/lib/prisma'

/**
 * Verifica si un usuario tiene permiso GLOBAL de gestión de inventario.
 * - ADMIN: siempre sí
 * - Cualquier otro rol: solo si canManageInventory === true en la BD
 */
export async function canManageInventory(userId: string, role: string): Promise<boolean> {
  if (role === 'ADMIN') return true

  try {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { canManageInventory: true, isActive: true },
    })
    if (!user || !user.isActive) return false
    return user.canManageInventory === true
  } catch {
    return false
  }
}

/**
 * Verifica si un usuario puede gestionar (crear/editar/eliminar) un activo específico.
 *
 * Jerarquía:
 *   SuperAdmin  → puede gestionar cualquier activo
 *   Admin       → puede gestionar activos de sus familias asignadas (o todos si no tiene asignaciones)
 *   Gestor      → puede gestionar activos de sus familias asignadas en inventory_manager_families
 *   Otros       → no pueden gestionar activos
 *
 * @param userId       ID del usuario que intenta la acción
 * @param role         Rol del usuario (ADMIN, TECHNICIAN, CLIENT…)
 * @param isSuperAdmin Si el usuario es superadmin
 * @param assetFamilyId  ID de la familia del activo (obtenido del tipo del activo)
 */
export async function canManageAsset(
  userId: string,
  role: string,
  isSuperAdmin: boolean,
  assetFamilyId: string | null | undefined
): Promise<boolean> {
  // SuperAdmin: acceso total
  if (role === 'ADMIN' && isSuperAdmin) return true

  // Admin normal: verifica sus familias asignadas
  if (role === 'ADMIN') {
    if (!assetFamilyId) return true // activo sin familia → solo admin puede
    const assignments = await prisma.admin_family_assignments.findMany({
      where: { adminId: userId, isActive: true },
      select: { familyId: true },
    })
    // Sin asignaciones explícitas → acceso total (admin recién configurado)
    if (assignments.length === 0) return true
    return assignments.some(a => a.familyId === assetFamilyId)
  }

  // Gestor (cualquier rol con canManageInventory): verifica sus familias
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { canManageInventory: true, isActive: true },
  })
  if (!user?.isActive || !user.canManageInventory) return false

  if (!assetFamilyId) return false // gestor no puede tocar activos sin familia
  const assignment = await prisma.inventory_manager_families.findFirst({
    where: { managerId: userId, familyId: assetFamilyId },
  })
  return assignment !== null
}

/**
 * Respuesta estándar de acceso denegado para inventario
 */
export function inventoryForbidden() {
  return Response.json(
    { error: 'No tienes permiso para gestionar el inventario' },
    { status: 403 }
  )
}
