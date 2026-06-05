import { prisma } from '@/lib/prisma'
import { getModuleFamilyIds } from '@/lib/auth/admin-scope'

/**
 * Retorna los IDs de familias accesibles para un usuario según su rol:
 *
 * - SuperAdmin (ADMIN + isSuperAdmin): acceso total → undefined (sin restricción)
 * - Admin normal (ADMIN sin isSuperAdmin): sus familias en inventory_manager_families + nativa
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

  // Admin normal: familias de inventario asignadas + nativa
  if (role === 'ADMIN') {
    try {
      const inventoryFamilyIds = await getModuleFamilyIds(userId, 'inventory')
      if (inventoryFamilyIds.length === 0) {
        // Admin sin asignaciones de inventario: solo su familia nativa
        const user = await prisma.users.findUnique({
          where: { id: userId },
          select: { departments: { select: { familyId: true } } },
        })
        const nativeFamilyId = user?.departments?.familyId
        return nativeFamilyId ? [nativeFamilyId] : []
      }
      return inventoryFamilyIds
    } catch (error) {
      console.error('[getAccessibleFamilyIds] Error loading inventory scope:', error)
      // Fallback: solo familia nativa
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { departments: { select: { familyId: true } } },
      })
      const nativeFamilyId = user?.departments?.familyId
      return nativeFamilyId ? [nativeFamilyId] : []
    }
  }

  // Gestor de inventario (cualquier rol): sus familias asignadas + familia nativa
  if (canManageInventory) {
    const assignments = await prisma.inventory_manager_families.findMany({
      where: { managerId: userId },
      select: { familyId: true },
    })
    const assignedIds = assignments.map(a => a.familyId)

    // Siempre incluir la familia nativa (departamento del usuario)
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { departments: { select: { familyId: true } } },
    })
    const nativeFamilyId = user?.departments?.familyId

    const allIds = nativeFamilyId ? [...new Set([...assignedIds, nativeFamilyId])] : assignedIds

    // Si no tiene ninguna familia (ni asignada ni nativa), devolver undefined
    // para que vea todas — mejor que bloquearle completamente
    return allIds.length > 0 ? allIds : undefined
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
