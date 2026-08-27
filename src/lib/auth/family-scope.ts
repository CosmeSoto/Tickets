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

/** Grants adicionales de tickets (user_family_access, módulo tickets, canConsume). */
async function getTicketGrantFamilyIds(userId: string): Promise<string[]> {
  const { getUserModuleFamilyGrantIds } = await import('@/lib/auth/user-family-access')
  return getUserModuleFamilyGrantIds(userId, 'tickets', 'canConsume')
}

/** @deprecated Alias — usa getTicketGrantFamilyIds. */
export async function getClientAssignmentFamilyIds(userId: string): Promise<string[]> {
  return getTicketGrantFamilyIds(userId)
}

/** @deprecated Alias — usa getTicketGrantFamilyIds. */
export async function getTechnicianConsumerFamilyIds(userId: string): Promise<string[]> {
  return getTicketGrantFamilyIds(userId)
}

/** @deprecated Alias — usa getTicketGrantFamilyIds. */
export async function getAdminAssignmentFamilyIds(userId: string): Promise<string[]> {
  return getTicketGrantFamilyIds(userId)
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
  const grants = await getTicketGrantFamilyIds(userId)
  const raw =
    role === 'CLIENT' || role === 'TECHNICIAN' || role === 'ADMIN'
      ? dedupeIds([nativeId, ...grants])
      : nativeId
        ? [nativeId]
        : []

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
 * CLIENT: nativa + grants tickets (canConsume).
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
  // Normalizar TECHNOLOGY legacy del ticket para alinear con scope remapeado del admin
  const normalized = familyId ? await resolveValidFamilyId(familyId) : null
  return (
    isFamilyInScope(normalized ?? familyId, ids) ||
    (normalized !== familyId && isFamilyInScope(familyId, ids))
  )
}

/** Admin puede operar (asignar, cerrar, configurar flujo) solo en familia nativa. */
export async function adminCanOperateTicketFamily(
  adminId: string,
  familyId: string | null,
  isSuperAdmin: boolean
): Promise<boolean> {
  if (isSuperAdmin) return true
  const ids = await getTicketOperationalFamilyIds(adminId, 'ADMIN', false)
  const normalized = familyId ? await resolveValidFamilyId(familyId) : null
  return (
    isFamilyInScope(normalized ?? familyId, ids) ||
    (normalized !== familyId && isFamilyInScope(familyId, ids))
  )
}

/**
 * Tickets source=PATROL: encargados del área de rondas (nativa + grants patrols)
 * pueden ver/gestionar el ticket escalado sin abrir la cola general de tickets consumer.
 */
export async function adminCanAccessPatrolSourcedTicketFamily(
  adminId: string,
  familyId: string | null,
  isSuperAdmin: boolean
): Promise<boolean> {
  if (isSuperAdmin) return true
  if (await adminCanOperateTicketFamily(adminId, familyId, false)) return true

  const patrolIds = await getPatrolVisibilityFamilyIds(adminId, 'ADMIN', false)
  if (patrolIds === undefined) return true
  if (!familyId) return true

  const normalized = await resolveValidFamilyId(familyId)
  const targets = new Set(await normalizeActiveFamilyIds([...patrolIds, familyId]))
  if (normalized) targets.add(normalized)
  for (const id of patrolIds) targets.add(id)

  return targets.has(normalized ?? familyId) || targets.has(familyId)
}

/** Técnico puede tomar tickets sin asignar solo en su familia nativa. */
export async function technicianCanAccessUnassignedQueue(
  technicianId: string,
  familyId: string | null
): Promise<boolean> {
  const nativeId = await getNativeFamilyId(technicianId)
  if (!familyId) return true
  if (nativeId === familyId) return true
  const normalized = await resolveValidFamilyId(familyId)
  return Boolean(nativeId && normalized && nativeId === normalized)
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

/**
 * IDs de admins (no super) cuya familia NATIVA coincide — "el admin más
 * cercano" cuando ningún técnico/admin del departamento exacto está
 * disponible. No incluye Super Admin (ese ya tiene bypass propio donde se
 * necesita).
 */
export async function getAdminIdsNativeToFamily(familyId: string): Promise<string[]> {
  const departments = await prisma.departments.findMany({
    where: { familyId, isActive: true },
    select: { id: true },
  })
  if (departments.length === 0) return []

  const admins = await prisma.users.findMany({
    where: {
      role: 'ADMIN',
      isActive: true,
      isSuperAdmin: false,
      departmentId: { in: departments.map(d => d.id) },
    },
    select: { id: true },
  })
  return admins.map(a => a.id)
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
// Agente/supervisor (TECHNICIAN/CLIENT): operar patrullas en nativa + grants patrols.

export async function getPatrolAssignmentFamilyIds(userId: string): Promise<string[]> {
  const { getUserModuleFamilyGrantIds } = await import('@/lib/auth/user-family-access')
  return getUserModuleFamilyGrantIds(userId, 'patrols')
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
// Gestor: operar en nativa + grants inventory.
// Admin normal: operar solo nativa; ver/gestionar listados en familias asignadas al módulo.
// Solicitud de activos (canRequestAssets): nativa + familias consumer asignadas.

export async function getInventoryManagerFamilyIds(userId: string): Promise<string[]> {
  const { getUserModuleFamilyGrantIds } = await import('@/lib/auth/user-family-access')
  return getUserModuleFamilyGrantIds(userId, 'inventory')
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
    if (!canManageInventory) return []
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
  const grants = await getTicketGrantFamilyIds(userId)
  return dedupeIds([nativeId, ...grants])
}

export async function adminCanOperateInventoryFamily(
  adminId: string,
  familyId: string | null,
  isSuperAdmin: boolean
): Promise<boolean> {
  if (isSuperAdmin) return true
  // Caller ya validó canManageInventory; aquí solo scope de familia nativa.
  const ids = await getInventoryOperationalFamilyIds(adminId, 'ADMIN', false, true)
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
