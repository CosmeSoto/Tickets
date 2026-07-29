/**
 * Scope de familias por capas (nativa vs adicional).
 *
 * Nativa     → departamento del usuario. Rol operativo completo en el módulo.
 * Adicional  → asignaciones por módulo. Solo consumo cross-área (solicitar tickets
 *              a otras áreas); no gestionar ni dar soporte en esas colas.
 *
 * Modos (tickets):
 * - consumer:    familias donde puede SOLICITAR / crear tickets (nativa + asignadas)
 * - operational: familias donde puede RESOLVER / gestionar (solo nativa)
 * - visibility:  cola de soporte en listados = operational para ADMIN/TECH;
 *                CLIENT = consumer (ve sus solicitudes por clientId en la API)
 */

import prisma from '@/lib/prisma'

export type FamilyScopeMode = 'consumer' | 'operational' | 'visibility'

function dedupeIds(ids: (string | null | undefined)[]): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))]
}

/**
 * Descarta familias inactivas y remapea TECHNOLOGY (legacy) → ADMINISTRATIVE.
 * Evita "sin áreas" / "sin categorías" cuando asignaciones quedaron en la familia absorbida.
 * También elimina IDs huérfanos (p. ej. restore de users sin tabla families).
 */
export async function normalizeActiveFamilyIds(ids: string[]): Promise<string[]> {
  const unique = dedupeIds(ids)
  if (unique.length === 0) return []

  const [legacyTech, adminFamily] = await Promise.all([
    prisma.families.findUnique({
      where: { code: 'TECHNOLOGY' },
      select: { id: true },
    }),
    prisma.families.findUnique({
      where: { code: 'ADMINISTRATIVE' },
      select: { id: true },
    }),
  ])

  const remapped = unique.map(id =>
    legacyTech && adminFamily && id === legacyTech.id ? adminFamily.id : id
  )

  const active = await prisma.families.findMany({
    where: { id: { in: dedupeIds(remapped) }, isActive: true },
    select: { id: true },
  })
  return active.map(f => f.id)
}

/**
 * Resuelve un familyId usable para FKs (asignaciones, sync).
 * - null/undefined → null
 * - TECHNOLOGY (legacy) → ADMINISTRATIVE si existe
 * - UUID inexistente o familia inactiva → null
 */
export async function resolveValidFamilyId(
  familyId: string | null | undefined
): Promise<string | null> {
  if (!familyId) return null
  const [normalized] = await normalizeActiveFamilyIds([familyId])
  return normalized ?? null
}

/**
 * Familia nativa del departamento = su `familyId` si apunta a una familia activa.
 * Si el FK es huérfano, retorna null (limpieza: repairOrphanFamilyForeignKeys).
 */
export async function getDepartmentNativeFamilyId(departmentId: string): Promise<string | null> {
  const dept = await prisma.departments.findUnique({
    where: { id: departmentId },
    select: { familyId: true },
  })
  return resolveValidFamilyId(dept?.familyId ?? null)
}

export async function getNativeFamilyId(userId: string): Promise<string | null> {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { departmentId: true, departments: { select: { familyId: true } } },
  })
  if (user?.departmentId) {
    return getDepartmentNativeFamilyId(user.departmentId)
  }
  return resolveValidFamilyId(user?.departments?.familyId ?? null)
}

/** Familias adicionales de consumo (client_family_assignments). */
export async function getClientAssignmentFamilyIds(userId: string): Promise<string[]> {
  const rows = await prisma.client_family_assignments.findMany({
    where: { clientId: userId, isActive: true },
    select: { familyId: true },
  })
  return rows.map(r => r.familyId)
}

/** Familias adicionales de tickets para técnicos (solicitar servicio en otra área). */
export async function getTechnicianConsumerFamilyIds(userId: string): Promise<string[]> {
  const rows = await prisma.technician_family_assignments.findMany({
    where: { technicianId: userId, isActive: true },
    select: { familyId: true },
  })
  return rows.map(r => r.familyId)
}

/** Familias adicionales de consumo para admins (solicitar tickets a otras áreas). */
export async function getAdminAssignmentFamilyIds(userId: string): Promise<string[]> {
  const rows = await prisma.admin_family_assignments.findMany({
    where: { adminId: userId, isActive: true },
    select: { familyId: true },
  })
  return rows.map(r => r.familyId)
}

/**
 * Familias donde el usuario puede crear/solicitar tickets.
 * Técnico/admin: adicionales = solicitar en otra área, no operar.
 */
export async function getTicketConsumerFamilyIds(
  userId: string,
  role: string,
  isSuperAdmin: boolean
): Promise<string[] | undefined> {
  if (role === 'ADMIN' && isSuperAdmin) return undefined

  const nativeId = await getNativeFamilyId(userId)
  const clientIds = await getClientAssignmentFamilyIds(userId)

  let raw: string[]
  if (role === 'CLIENT') {
    raw = dedupeIds([nativeId, ...clientIds])
  } else if (role === 'TECHNICIAN') {
    const techConsumer = await getTechnicianConsumerFamilyIds(userId)
    raw = dedupeIds([nativeId, ...techConsumer, ...clientIds])
  } else if (role === 'ADMIN') {
    const adminIds = await getAdminAssignmentFamilyIds(userId)
    raw = dedupeIds([nativeId, ...adminIds, ...clientIds])
  } else {
    raw = nativeId ? [nativeId] : []
  }

  const normalized = await normalizeActiveFamilyIds(raw)

  // Admin sin nativa/asignaciones activas (p. ej. TECHNOLOGY legacy sin remapear en DB):
  // no bloquear creación — mismo criterio que Super Admin (sin límite consumer).
  if (role === 'ADMIN' && normalized.length === 0) return undefined

  return normalized
}

/** Familias donde el usuario opera tickets (resolver, asignar, cola sin asignar). Solo nativa. */
export async function getTicketOperationalFamilyIds(
  userId: string,
  role: string,
  isSuperAdmin: boolean
): Promise<string[] | undefined> {
  if (isSuperAdmin && role === 'ADMIN') return undefined

  const nativeId = await getNativeFamilyId(userId)
  if (role === 'ADMIN' || role === 'TECHNICIAN') {
    return nativeId ? normalizeActiveFamilyIds([nativeId]) : []
  }
  return []
}

/**
 * Familias visibles en listados/cola de soporte de tickets.
 * ADMIN/TECH: solo nativa (las asignadas son consumer → "Mis solicitudes").
 * CLIENT: nativa + client_family_assignments.
 */
export async function getTicketVisibilityFamilyIds(
  userId: string,
  role: string,
  isSuperAdmin: boolean
): Promise<string[] | undefined> {
  if (role === 'ADMIN' && isSuperAdmin) return undefined

  if (role === 'CLIENT') {
    return getTicketConsumerFamilyIds(userId, role, isSuperAdmin)
  }

  // ADMIN y TECHNICIAN: cola de soporte = operational (nativa)
  if (role === 'ADMIN' || role === 'TECHNICIAN') {
    return getTicketOperationalFamilyIds(userId, role, isSuperAdmin)
  }

  const nativeId = await getNativeFamilyId(userId)
  return nativeId ? [nativeId] : []
}

export async function getTicketScopeFamilyIds(
  userId: string,
  role: string,
  isSuperAdmin: boolean,
  mode: FamilyScopeMode
): Promise<string[] | undefined> {
  switch (mode) {
    case 'consumer':
      return getTicketConsumerFamilyIds(userId, role, isSuperAdmin)
    case 'operational':
      return getTicketOperationalFamilyIds(userId, role, isSuperAdmin)
    case 'visibility':
      return getTicketVisibilityFamilyIds(userId, role, isSuperAdmin)
  }
}

export function isFamilyInScope(
  familyId: string | null | undefined,
  scopeIds: string[] | undefined
): boolean {
  if (!familyId) return true
  if (scopeIds === undefined) return true
  if (scopeIds.length === 0) return false
  return scopeIds.includes(familyId)
}

/** Admin puede ver cola de soporte en familia nativa (visibility = operational). */
export async function adminCanViewTicketFamily(
  adminId: string,
  familyId: string | null,
  isSuperAdmin: boolean
): Promise<boolean> {
  if (isSuperAdmin) return true
  const ids = await getTicketVisibilityFamilyIds(adminId, 'ADMIN', false)
  return isFamilyInScope(familyId, ids)
}

/** Admin puede operar (asignar, cerrar, configurar flujo) solo en familia nativa. */
export async function adminCanOperateTicketFamily(
  adminId: string,
  familyId: string | null,
  isSuperAdmin: boolean
): Promise<boolean> {
  if (isSuperAdmin) return true
  const ids = await getTicketOperationalFamilyIds(adminId, 'ADMIN', false)
  return isFamilyInScope(familyId, ids)
}

/** Técnico puede tomar tickets sin asignar solo en su familia nativa. */
export async function technicianCanAccessUnassignedQueue(
  technicianId: string,
  familyId: string | null
): Promise<boolean> {
  const nativeId = await getNativeFamilyId(technicianId)
  if (!familyId) return true
  return nativeId === familyId
}

/** IDs de técnicos cuya familia NATIVA coincide (resolutores del área). */
export async function getTechnicianIdsNativeToFamily(familyId: string): Promise<string[]> {
  const departments = await prisma.departments.findMany({
    where: { familyId, isActive: true },
    select: { id: true },
  })
  if (departments.length === 0) return []

  const technicians = await prisma.users.findMany({
    where: {
      role: 'TECHNICIAN',
      isActive: true,
      departmentId: { in: departments.map(d => d.id) },
    },
    select: { id: true },
  })
  return technicians.map(t => t.id)
}

/** Técnico tiene familia nativa operativa igual a la del ticket. */
export async function technicianIsNativeToFamily(
  technicianId: string,
  familyId: string
): Promise<boolean> {
  const nativeId = await getNativeFamilyId(technicianId)
  return nativeId === familyId
}

// ── Rondas (patrols) ─────────────────────────────────────────────────────────
// Admin: operar config (rutas, horarios) solo en nativa; ver reportes en adicionales.
// Agente/supervisor (TECHNICIAN/CLIENT): operar patrullas en nativa + patrol_family_assignments.

export async function getPatrolAssignmentFamilyIds(userId: string): Promise<string[]> {
  const rows = await prisma.patrol_family_assignments.findMany({
    where: { userId, isActive: true },
    select: { familyId: true },
  })
  return rows.map(r => r.familyId)
}

export async function getPatrolVisibilityFamilyIds(
  userId: string,
  role: string,
  isSuperAdmin: boolean
): Promise<string[] | undefined> {
  if (role === 'ADMIN' && isSuperAdmin) return undefined

  const nativeId = await getNativeFamilyId(userId)

  if (role === 'ADMIN') {
    const { getModuleFamilyIds } = await import('@/lib/auth/admin-scope')
    const patrolIds = await getModuleFamilyIds(userId, 'patrols')
    return patrolIds.length > 0 ? patrolIds : nativeId ? [nativeId] : []
  }

  if (role === 'TECHNICIAN' || role === 'CLIENT') {
    const patrolIds = await getPatrolAssignmentFamilyIds(userId)
    return dedupeIds([nativeId, ...patrolIds])
  }

  return []
}

export async function getPatrolOperationalFamilyIds(
  userId: string,
  role: string,
  isSuperAdmin: boolean
): Promise<string[] | undefined> {
  if (role === 'ADMIN' && isSuperAdmin) return undefined

  const nativeId = await getNativeFamilyId(userId)

  if (role === 'ADMIN') {
    return nativeId ? [nativeId] : []
  }

  if (role === 'TECHNICIAN' || role === 'CLIENT') {
    const patrolIds = await getPatrolAssignmentFamilyIds(userId)
    return dedupeIds([nativeId, ...patrolIds])
  }

  return []
}

export async function adminCanOperatePatrolFamily(
  adminId: string,
  familyId: string,
  isSuperAdmin: boolean
): Promise<boolean> {
  if (isSuperAdmin) return true
  const ids = await getPatrolOperationalFamilyIds(adminId, 'ADMIN', false)
  return isFamilyInScope(familyId, ids)
}

// ── Inventario ───────────────────────────────────────────────────────────────
// Gestor: operar en nativa + inventory_manager_families.
// Admin normal: operar solo nativa; ver/gestionar listados en familias asignadas al módulo.
// Solicitud de activos (canRequestAssets): nativa + familias consumer asignadas.

export async function getInventoryManagerFamilyIds(userId: string): Promise<string[]> {
  const rows = await prisma.inventory_manager_families.findMany({
    where: { managerId: userId },
    select: { familyId: true },
  })
  return rows.map(r => r.familyId)
}

/** Familias visibles en listados/dashboard de inventario. */
export async function getInventoryVisibilityFamilyIds(
  userId: string,
  role: string,
  isSuperAdmin: boolean,
  canManageInventory: boolean
): Promise<string[] | undefined> {
  if (role === 'ADMIN' && isSuperAdmin) return undefined

  const nativeId = await getNativeFamilyId(userId)

  if (role === 'ADMIN') {
    const { getModuleFamilyIds } = await import('@/lib/auth/admin-scope')
    const invIds = await getModuleFamilyIds(userId, 'inventory')
    return invIds.length > 0 ? invIds : nativeId ? [nativeId] : []
  }

  if (canManageInventory) {
    return dedupeIds([nativeId, ...(await getInventoryManagerFamilyIds(userId))])
  }

  if (nativeId) return [nativeId]
  return []
}

/** Familias donde puede crear/editar/eliminar activos y operaciones de gestión. */
export async function getInventoryOperationalFamilyIds(
  userId: string,
  role: string,
  isSuperAdmin: boolean,
  canManageInventory: boolean
): Promise<string[] | undefined> {
  if (role === 'ADMIN' && isSuperAdmin) return undefined

  const nativeId = await getNativeFamilyId(userId)

  if (role === 'ADMIN') {
    return nativeId ? [nativeId] : []
  }

  if (canManageInventory) {
    return dedupeIds([nativeId, ...(await getInventoryManagerFamilyIds(userId))])
  }

  return []
}

/** Familias donde puede solicitar activos (canRequestAssets). */
export async function getInventoryConsumerFamilyIds(
  userId: string,
  role: string,
  isSuperAdmin: boolean
): Promise<string[] | undefined> {
  if (role === 'ADMIN' && isSuperAdmin) return undefined

  const nativeId = await getNativeFamilyId(userId)
  const clientIds = await getClientAssignmentFamilyIds(userId)

  return dedupeIds([nativeId, ...clientIds])
}

export async function adminCanOperateInventoryFamily(
  adminId: string,
  familyId: string | null,
  isSuperAdmin: boolean
): Promise<boolean> {
  if (isSuperAdmin) return true
  const ids = await getInventoryOperationalFamilyIds(adminId, 'ADMIN', false, false)
  return isFamilyInScope(familyId, ids)
}

export async function managerCanOperateInventoryFamily(
  userId: string,
  familyId: string | null,
  canManageInventory: boolean
): Promise<boolean> {
  if (!canManageInventory) return false
  const ids = await getInventoryOperationalFamilyIds(userId, 'TECHNICIAN', false, true)
  return isFamilyInScope(familyId, ids)
}
