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
  const { userId, userRole, isSuperAdmin } = context

  // Super Admin: sin filtro
  if (userRole === 'ADMIN' && isSuperAdmin) {
    return {}
  }

  // Family Admin: solo sus familias
  if (userRole === 'ADMIN' && !isSuperAdmin) {
    const familyIds = await getUserFamilyIds(userId)

    if (familyIds.length === 0) {
      // No tiene familias asignadas, no puede ver nada
      return { id: 'none' }
    }

    return { familyId: { in: familyIds } }
  }

  // Technician: equipos de sus familias asignadas
  if (userRole === 'TECHNICIAN') {
    const familyIds = await getTechnicianFamilyIds(userId)

    if (familyIds.length === 0) {
      // No tiene familias asignadas, no puede ver nada
      return { id: 'none' }
    }

    return { familyId: { in: familyIds } }
  }

  // Client: solo equipos asignados a él
  if (userRole === 'CLIENT') {
    const equipmentIds = await getClientAssignedEquipmentIds(userId)

    if (equipmentIds.length === 0) {
      // No tiene equipos asignados, no puede ver nada
      return { id: 'none' }
    }

    return { id: { in: equipmentIds } }
  }

  // Por defecto, no puede ver nada
  return { id: 'none' }
}

/**
 * Aplica filtro de familia para solicitudes de activos
 */
export async function applyAssetRequestFamilyFilter(context: UserContext): Promise<any> {
  const { userId, userRole, isSuperAdmin } = context

  // Super Admin: sin filtro
  if (userRole === 'ADMIN' && isSuperAdmin) {
    return {}
  }

  // Family Admin: solo solicitudes de sus familias
  if (userRole === 'ADMIN' && !isSuperAdmin) {
    const familyIds = await getUserFamilyIds(userId)

    if (familyIds.length === 0) {
      return { id: 'none' }
    }

    return { familyId: { in: familyIds } }
  }

  // Technician: solicitudes de sus familias
  if (userRole === 'TECHNICIAN') {
    const familyIds = await getTechnicianFamilyIds(userId)

    if (familyIds.length === 0) {
      return { id: 'none' }
    }

    return { familyId: { in: familyIds } }
  }

  // Client: solo sus propias solicitudes
  if (userRole === 'CLIENT') {
    return { requesterId: userId }
  }

  return { id: 'none' }
}

/**
 * Aplica filtro de familia para contratos
 */
export async function applyContractFamilyFilter(context: UserContext): Promise<any> {
  const { userId, userRole, isSuperAdmin } = context

  // Super Admin: sin filtro
  if (userRole === 'ADMIN' && isSuperAdmin) {
    return {}
  }

  // Family Admin: solo contratos de sus familias
  if (userRole === 'ADMIN' && !isSuperAdmin) {
    const familyIds = await getUserFamilyIds(userId)

    if (familyIds.length === 0) {
      return { id: 'none' }
    }

    return { familyId: { in: familyIds } }
  }

  // Technician y Client: no pueden ver contratos
  return { id: 'none' }
}

/**
 * Verifica si el usuario tiene acceso a una familia específica
 */
export async function hasAccessToFamily(
  userId: string,
  userRole: UserRole,
  isSuperAdmin: boolean,
  familyId: string
): Promise<boolean> {
  // Super Admin: acceso a todo
  if (userRole === 'ADMIN' && isSuperAdmin) {
    return true
  }

  // Family Admin: verificar asignación
  if (userRole === 'ADMIN' && !isSuperAdmin) {
    const familyIds = await getUserFamilyIds(userId)
    return familyIds.includes(familyId)
  }

  // Technician: verificar asignación
  if (userRole === 'TECHNICIAN') {
    const familyIds = await getTechnicianFamilyIds(userId)
    return familyIds.includes(familyId)
  }

  // Client: no tiene acceso directo a familias
  return false
}

/**
 * Verifica si el usuario tiene acceso a un equipo específico
 */
export async function hasAccessToEquipment(
  userId: string,
  userRole: UserRole,
  isSuperAdmin: boolean,
  equipmentId: string
): Promise<boolean> {
  // Super Admin: acceso a todo
  if (userRole === 'ADMIN' && isSuperAdmin) {
    return true
  }

  // Obtener el equipo
  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    select: { type: { select: { familyId: true } } },
  })

  if (!equipment) {
    return false
  }

  const familyId = equipment.type?.familyId ?? null

  // Family Admin: verificar asignación
  if (userRole === 'ADMIN' && !isSuperAdmin) {
    if (!familyId) return false
    // Verificar en admin_family_assignments Y inventory_manager_families
    const familyIds = await getUserFamilyIds(userId)
    if (familyIds.includes(familyId)) return true

    // Fallback: verificar en inventory_manager_families (admin con canManageInventory)
    const inventoryAssignment = await prisma.inventory_manager_families.findFirst({
      where: { managerId: userId, familyId },
    })
    return !!inventoryAssignment
  }

  // Technician: verificar familia
  if (userRole === 'TECHNICIAN') {
    if (!familyId) return false
    const hasFamily = await hasAccessToFamily(userId, userRole, isSuperAdmin, familyId)
    if (hasFamily) return true

    // Fallback: verificar en inventory_manager_families (técnico con canManageInventory)
    const inventoryAssignment = await prisma.inventory_manager_families.findFirst({
      where: { managerId: userId, familyId },
    })
    return !!inventoryAssignment
  }

  // Client: verificar asignación
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

  return false
}

// ── Funciones Auxiliares ──────────────────────────────────────────────────────

/**
 * Obtiene los IDs de familias asignadas a un Family Admin (incluye nativa)
 */
async function getUserFamilyIds(userId: string): Promise<string[]> {
  const { getAdminFamilyScope } = await import('@/lib/auth/admin-scope')
  const scope = await getAdminFamilyScope(userId, false)
  return scope.familyIds ?? []
}

/**
 * Obtiene los IDs de familias asignadas a un Technician
 */
async function getTechnicianFamilyIds(userId: string): Promise<string[]> {
  const assignments = await prisma.technician_family_assignments.findMany({
    where: {
      technicianId: userId,
      isActive: true,
    },
    select: { familyId: true },
  })

  return assignments.map(a => a.familyId)
}

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
  const { userId, userRole, isSuperAdmin } = context

  // Super Admin: todas las familias
  if (userRole === 'ADMIN' && isSuperAdmin) {
    return await prisma.families.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true, color: true },
      orderBy: { name: 'asc' },
    })
  }

  // Family Admin: sus familias
  if (userRole === 'ADMIN' && !isSuperAdmin) {
    const familyIds = await getUserFamilyIds(userId)

    return await prisma.families.findMany({
      where: {
        id: { in: familyIds },
        isActive: true,
      },
      select: { id: true, name: true, code: true, color: true },
      orderBy: { name: 'asc' },
    })
  }

  // Technician: sus familias
  if (userRole === 'TECHNICIAN') {
    const familyIds = await getTechnicianFamilyIds(userId)

    return await prisma.families.findMany({
      where: {
        id: { in: familyIds },
        isActive: true,
      },
      select: { id: true, name: true, code: true, color: true },
      orderBy: { name: 'asc' },
    })
  }

  // Client: ninguna familia
  return []
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
