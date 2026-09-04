/**
 * Family Filter Middleware
 *
 * Aplica filtros automáticos según el rol del usuario para garantizar
 * que solo vean los datos a los que tienen acceso.
 *
 * Roles:
 * - SUPER_ADMIN: Ve todo
 * - FAMILY_ADMIN: Ve solo sus familias asignadas
 * - TECHNICIAN: Ve equipos de sus familias asignadas
 * - CLIENT: Ve solo equipos asignados a él
 */

import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface FamilyFilterResult {
  familyId?: { in: string[] } | string
  id?: { in: string[] }
}

export interface UserContext {
  userId: string
  userRole: UserRole
  isSuperAdmin: boolean
  canManageInventory?: boolean
}

// ── Funciones Principales ─────────────────────────────────────────────────────

/**
 * Aplica filtro de familia para equipos según el rol del usuario
 */
export async function applyEquipmentFamilyFilter(context: UserContext): Promise<any> {
  const { userId, userRole, isSuperAdmin, canManageInventory } = context

  if (userRole === 'ADMIN' && isSuperAdmin) {
    return {}
  }

  if (userRole === 'CLIENT') {
    const equipmentIds = await getClientAssignedEquipmentIds(userId)
    if (equipmentIds.length === 0) {
      return { id: 'none' }
    }
    return { id: { in: equipmentIds } }
  }

  const { getAccessibleFamilyIds } = await import('@/lib/inventory/family-access')
  const familyIds = await getAccessibleFamilyIds(
    userId,
    userRole,
    isSuperAdmin,
    canManageInventory ?? false
  )

  if (familyIds === undefined) {
    return {}
  }

  if (familyIds.length === 0) {
    return { id: 'none' }
  }

  return { familyId: { in: familyIds } }
}

/**
 * Aplica filtro de familia para solicitudes de activos
 */
export async function applyAssetRequestFamilyFilter(context: UserContext): Promise<any> {
  const { userId, userRole, isSuperAdmin, canManageInventory } = context

  if (userRole === 'ADMIN' && isSuperAdmin) {
    return {}
  }

  if (userRole === 'CLIENT') {
    return { requesterId: userId }
  }

  if (userRole === 'ADMIN' || userRole === 'TECHNICIAN') {
    const { getAccessibleFamilyIds } = await import('@/lib/inventory/family-access')
    const familyIds = await getAccessibleFamilyIds(
      userId,
      userRole,
      isSuperAdmin,
      canManageInventory ?? false
    )

    if (familyIds === undefined) {
      return {}
    }

    if (familyIds.length === 0) {
      return { id: 'none' }
    }

    return { familyId: { in: familyIds } }
  }

  return { id: 'none' }
}

/**
 * Aplica filtro de familia para contratos
 */
export async function applyContractFamilyFilter(context: UserContext): Promise<any> {
  const { userId, userRole, isSuperAdmin, canManageInventory } = context

  if (userRole === 'ADMIN' && isSuperAdmin) {
    return {}
  }

  if (userRole === 'ADMIN') {
    const { getAccessibleFamilyIds } = await import('@/lib/inventory/family-access')
    const familyIds = await getAccessibleFamilyIds(
      userId,
      userRole,
      isSuperAdmin,
      canManageInventory ?? false
    )

    if (familyIds === undefined) {
      return {}
    }

    if (familyIds.length === 0) {
      return { id: 'none' }
    }

    return { familyId: { in: familyIds } }
  }

  return { id: 'none' }
}

/**
 * Verifica si el usuario tiene acceso a una familia específica
 */
export async function hasAccessToFamily(
  userId: string,
  userRole: UserRole,
  isSuperAdmin: boolean,
  familyId: string,
  canManageInventory = false
): Promise<boolean> {
  if (userRole === 'ADMIN' && isSuperAdmin) {
    return true
  }

  if (userRole === 'CLIENT') {
    return false
  }

  const { checkFamilyAccess } = await import('@/lib/inventory/family-access')
  return checkFamilyAccess(userId, familyId, userRole, isSuperAdmin, canManageInventory)
}

/**
 * Verifica si el usuario tiene acceso a un equipo específico
 */
export async function hasAccessToEquipment(
  userId: string,
  userRole: UserRole,
  isSuperAdmin: boolean,
  equipmentId: string,
  canManageInventory = false
): Promise<boolean> {
  if (userRole === 'ADMIN' && isSuperAdmin) {
    return true
  }

  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    select: { type: { select: { familyId: true } } },
  })

  if (!equipment) {
    return false
  }

  const familyId = equipment.type?.familyId ?? null

  if (userRole === 'CLIENT') {
    const assignment = await prisma.equipment_assignments.findFirst({
      where: {
        equipmentId,
        receiverId: userId,
        isActive: true,
      },
    })
    return !!assignment
  }

  if (!familyId) return false

  const { checkFamilyAccess } = await import('@/lib/inventory/family-access')
  return checkFamilyAccess(userId, familyId, userRole, isSuperAdmin, canManageInventory)
}

/**
 * Verifica si un CLIENT tiene acceso a una licencia específica por tenerla
 * asignada — mismo criterio que hasAccessToEquipment para CLIENT (la
 * asignación personal, no la familia, es lo que da acceso de lectura).
 */
export async function hasAccessToLicense(userId: string, licenseId: string): Promise<boolean> {
  const license = await prisma.software_licenses.findUnique({
    where: { id: licenseId },
    select: { assignedToUser: true },
  })
  return !!license && license.assignedToUser === userId
}

// ── Funciones Auxiliares ──────────────────────────────────────────────────────

/**
 * Obtiene los IDs de equipos asignados a un Client
 */
async function getClientAssignedEquipmentIds(userId: string): Promise<string[]> {
  const assignments = await prisma.equipment_assignments.findMany({
    where: {
      receiverId: userId,
      isActive: true,
    },
    select: { equipmentId: true },
  })

  return assignments.map(a => a.equipmentId)
}

/**
 * Obtiene las familias accesibles para el usuario (para dropdowns)
 */
export async function getAccessibleFamilies(
  context: UserContext
): Promise<Array<{ id: string; name: string; code: string; color: string | null }>> {
  const { userId, userRole, isSuperAdmin, canManageInventory } = context

  if (userRole === 'ADMIN' && isSuperAdmin) {
    return await prisma.families.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true, color: true },
      orderBy: { name: 'asc' },
    })
  }

  if (userRole === 'CLIENT') {
    return []
  }

  const { getAccessibleFamilyIds } = await import('@/lib/inventory/family-access')
  const familyIds = await getAccessibleFamilyIds(
    userId,
    userRole,
    isSuperAdmin,
    canManageInventory ?? false
  )

  if (familyIds === undefined) {
    return await prisma.families.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true, color: true },
      orderBy: { name: 'asc' },
    })
  }

  if (familyIds.length === 0) {
    return []
  }

  return await prisma.families.findMany({
    where: {
      id: { in: familyIds },
      isActive: true,
    },
    select: { id: true, name: true, code: true, color: true },
    orderBy: { name: 'asc' },
  })
}

/**
 * Crea contexto de usuario desde la sesión
 */
export function createUserContext(session: any): UserContext {
  return {
    userId: session.user.id,
    userRole: session.user.role,
    isSuperAdmin: session.user.isSuperAdmin || false,
    canManageInventory: session.user.canManageInventory || false,
  }
}
