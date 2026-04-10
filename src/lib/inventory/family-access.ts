import { prisma } from '@/lib/prisma'

/**
 * Retorna los IDs de familias accesibles para un usuario según su rol:
 *
 * - SuperAdmin (ADMIN + isSuperAdmin): acceso total → undefined (sin restricción)
 * - Admin normal (ADMIN sin isSuperAdmin): solo sus familias asignadas en admin_family_assignments
 *   Si no tiene ninguna asignada, acceso total por compatibilidad (admin recién creado)
 * - Gestor (canManageInventory=true): sus familias en inventory_manager_families
 * - Cualquier otro rol: undefined (sin restricción de familia, la API decide qué mostrar)
 *
 * Retorna:
 *   undefined  → sin restricción (ver todo)
 *   string[]   → solo esas familias (puede ser array vacío si no tiene ninguna asignada)
 */
export async function getAccessibleFamilyIds(
  userId: string,
  role: string,
  isSuperAdmin: boolean,
  canManageInventory: boolean
): Promise<string[] | undefined> {
  // SuperAdmin: acceso total
  if (role === 'ADMIN' && isSuperAdmin) return undefined

  // Admin normal: solo sus familias asignadas
  if (role === 'ADMIN') {
    const assignments = await prisma.admin_family_assignments.findMany({
      where: { adminId: userId, isActive: true },
      select: { familyId: true },
    })
    // Si no tiene asignaciones explícitas, acceso total (admin recién configurado)
    if (assignments.length === 0) return undefined
    return assignments.map(a => a.familyId)
  }

  // Gestor de inventario (cualquier rol): sus familias asignadas
  if (canManageInventory) {
    const assignments = await prisma.inventory_manager_families.findMany({
      where: { managerId: userId },
      select: { familyId: true },
    })
    return assignments.map(a => a.familyId)
  }

  // Otros roles sin gestión: sin restricción de familia (la API aplica sus propios filtros)
  return undefined
}

/**
 * Verifica si un usuario tiene acceso a una familia específica.
 */
export async function checkFamilyAccess(
  userId: string,
  assetFamilyId: string,
  role: string,
  isSuperAdmin: boolean,
  canManageInventory: boolean
): Promise<boolean> {
  const accessible = await getAccessibleFamilyIds(userId, role, isSuperAdmin, canManageInventory)
  if (accessible === undefined) return true
  return accessible.includes(assetFamilyId)
}
