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
 */
export async function canManageAsset(
  userId: string,
  role: string,
  isSuperAdmin: boolean,
  assetFamilyId: string | null | undefined
): Promise<boolean> {
  if (role === 'ADMIN' && isSuperAdmin) return true

  if (role === 'ADMIN') {
    if (!assetFamilyId) return true
    const assignments = await prisma.admin_family_assignments.findMany({
      where: { adminId: userId, isActive: true },
      select: { familyId: true },
    })
    if (assignments.length === 0) return true
    return assignments.some(a => a.familyId === assetFamilyId)
  }

  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { canManageInventory: true, isActive: true },
  })
  if (!user?.isActive || !user.canManageInventory) return false

  if (!assetFamilyId) return false
  const assignment = await prisma.inventory_manager_families.findFirst({
    where: { managerId: userId, familyId: assetFamilyId },
  })
  return assignment !== null
}

/**
 * Obtiene el familyId de un activo (equipo o licencia) a partir de su tipo.
 */
export async function getAssetFamilyId(
  assetType: 'EQUIPMENT' | 'LICENSE',
  assetId: string
): Promise<string | null> {
  try {
    if (assetType === 'EQUIPMENT') {
      const eq = await prisma.equipment.findUnique({
        where: { id: assetId },
        select: { type: { select: { familyId: true } } },
      })
      return eq?.type?.familyId ?? null
    } else {
      const lic = await prisma.software_licenses.findUnique({
        where: { id: assetId },
        select: { licenseType: { select: { familyId: true } } },
      })
      return lic?.licenseType?.familyId ?? null
    }
  } catch {
    return null
  }
}

/**
 * Verifica si un TECHNICIAN está asignado a una familia específica.
 */
export async function isTechnicianOfFamily(
  technicianId: string,
  familyId: string
): Promise<boolean> {
  try {
    const assignment = await prisma.technician_family_assignments.findFirst({
      where: { technicianId, familyId, isActive: true },
    })
    return assignment !== null
  } catch {
    return false
  }
}

/**
 * Verifica si un usuario es GESTOR de una familia específica.
 * (canManageInventory = true + asignado a esa familia en inventory_manager_families)
 */
export async function isManagerOfFamily(
  userId: string,
  familyId: string
): Promise<boolean> {
  try {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { canManageInventory: true, isActive: true },
    })
    if (!user?.isActive || !user.canManageInventory) return false

    const assignment = await prisma.inventory_manager_families.findFirst({
      where: { managerId: userId, familyId },
    })
    return assignment !== null
  } catch {
    return false
  }
}

/**
 * Verifica si un ADMIN puede aprobar bajas de una familia específica.
 * - SuperAdmin: siempre sí
 * - Admin normal: solo si tiene esa familia asignada (o si no tiene ninguna asignada)
 */
export async function isAdminOfFamily(
  userId: string,
  isSuperAdmin: boolean,
  familyId: string | null
): Promise<boolean> {
  if (isSuperAdmin) return true
  if (!familyId) return true // activo sin familia → cualquier admin puede

  try {
    const assignments = await prisma.admin_family_assignments.findMany({
      where: { adminId: userId, isActive: true },
      select: { familyId: true },
    })
    if (assignments.length === 0) return true // sin asignaciones explícitas → acceso total
    return assignments.some(a => a.familyId === familyId)
  } catch {
    return false
  }
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
