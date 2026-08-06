/**
 * Acceso unificado a áreas por módulo (user_family_access) — fuente única.
 *
 * - Familia nativa: NO se persiste (departamento).
 * - Lectura/escritura: solo user_family_access.
 * - Módulos futuros: registrar en family-access-modules.ts (module string libre).
 */

import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import {
  FAMILY_ACCESS_MODULES,
  getModuleDefaults,
  resolveFamilyAccessModuleKey,
  type FamilyAccessCapability,
} from '@/lib/auth/family-access-modules'
import { normalizeActiveFamilyIds, getNativeFamilyId } from '@/lib/auth/family-scope'

export type FamilyAccessCapabilityFlag = keyof FamilyAccessCapability

function dedupe(ids: (string | null | undefined)[]): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))]
}

function hasUserFamilyAccessModel(): boolean {
  return typeof prisma.user_family_access?.findMany === 'function'
}

async function getUserRole(userId: string): Promise<string> {
  const u = await prisma.users.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  return u?.role ?? 'CLIENT'
}

async function readGrantIds(
  userId: string,
  moduleKey: string,
  capability?: FamilyAccessCapabilityFlag
): Promise<string[]> {
  if (!hasUserFamilyAccessModel()) return []
  const where: Record<string, unknown> = { userId, module: moduleKey, isActive: true }
  if (capability) where[capability] = true
  const rows = await prisma.user_family_access.findMany({
    where,
    select: { familyId: true },
  })
  return rows.map(r => r.familyId)
}

/** True si el usuario ya tiene filas (activas o no) para el módulo. */
export async function isUserModuleAccessInitialized(
  userId: string,
  moduleInput: string
): Promise<boolean> {
  if (!hasUserFamilyAccessModel()) return false
  const moduleKey = resolveFamilyAccessModuleKey(moduleInput)
  const n = await prisma.user_family_access.count({
    where: { userId, module: moduleKey },
  })
  return n > 0
}

/**
 * Semilla content desde grants de tickets (1ª vez).
 * Ya no hay tablas legacy: solo user_family_access.
 */
export async function syncUserModuleFamilyAccess(
  userId: string,
  moduleInput: string,
  _opts?: { force?: boolean }
): Promise<number> {
  if (!hasUserFamilyAccessModel()) return 0

  const moduleKey = resolveFamilyAccessModuleKey(moduleInput)
  if (moduleKey !== 'content') return 0

  const everInitialized = await prisma.user_family_access.count({
    where: { userId, module: moduleKey },
  })
  if (everInitialized > 0) return 0

  const role = await getUserRole(userId)
  const defaults = getModuleDefaults('content', role)
  const ticketIds = await normalizeActiveFamilyIds(await readGrantIds(userId, 'tickets'))
  if (ticketIds.length === 0) return 0

  let upserted = 0
  for (const familyId of ticketIds) {
    await prisma.user_family_access.upsert({
      where: { userId_familyId_module: { userId, familyId, module: 'content' } },
      create: {
        id: randomUUID(),
        userId,
        familyId,
        module: 'content',
        ...defaults,
        isActive: true,
        updatedAt: new Date(),
      },
      update: {
        isActive: true,
        ...defaults,
        updatedAt: new Date(),
      },
    })
    upserted++
  }
  return upserted
}

export async function syncAllUserFamilyAccess(userId: string): Promise<void> {
  await syncUserModuleFamilyAccess(userId, 'content')
}

/** Bulk: solo asegura semilla content. Migración legacy → unified es SQL one-shot. */
export async function syncAllUsersFamilyAccess(_opts?: {
  force?: boolean
}): Promise<{ users: number; upserts: number }> {
  if (!hasUserFamilyAccessModel()) return { users: 0, upserts: 0 }
  const users = await prisma.users.findMany({
    where: { isActive: true },
    select: { id: true },
  })
  let upserts = 0
  for (const u of users) {
    upserts += await syncUserModuleFamilyAccess(u.id, 'content')
  }
  return { users: users.length, upserts }
}

/**
 * IDs de familias adicionales (sin nativa) para un módulo + capacidad.
 */
export async function getUserModuleFamilyGrantIds(
  userId: string,
  moduleInput: string,
  capability?: FamilyAccessCapabilityFlag
): Promise<string[]> {
  const moduleKey = resolveFamilyAccessModuleKey(moduleInput)
  await syncUserModuleFamilyAccess(userId, moduleKey)
  return normalizeActiveFamilyIds(await readGrantIds(userId, moduleKey, capability))
}

/** Scope = nativa + grants. */
export async function resolveModuleFamilyScopeIds(
  userId: string,
  moduleInput: string,
  capability?: FamilyAccessCapabilityFlag
): Promise<string[]> {
  const nativeId = await getNativeFamilyId(userId)
  const grants = await getUserModuleFamilyGrantIds(userId, moduleInput, capability)
  return normalizeActiveFamilyIds(dedupe([nativeId, ...grants]))
}

export async function userHasFamilyInModule(
  userId: string,
  moduleInput: string,
  familyId: string,
  capability?: FamilyAccessCapabilityFlag
): Promise<boolean> {
  if (!familyId) return true
  const scope = await resolveModuleFamilyScopeIds(userId, moduleInput, capability)
  const [normalized] = await normalizeActiveFamilyIds([familyId])
  const target = normalized ?? familyId
  return scope.includes(target) || scope.includes(familyId)
}

/** Salud: conteos por módulo (ya no hay drift legacy). */
export async function diagnoseUserFamilyAccessDrift(opts?: {
  userId?: string
  limit?: number
}): Promise<{
  checked: number
  drifts: never[]
  totals: Record<string, number>
}> {
  if (!hasUserFamilyAccessModel()) {
    return { checked: 0, drifts: [], totals: {} }
  }
  const moduleKeys = Object.keys(FAMILY_ACCESS_MODULES)
  const totals: Record<string, number> = {}
  for (const moduleKey of moduleKeys) {
    totals[moduleKey] = await prisma.user_family_access.count({
      where: {
        module: moduleKey,
        isActive: true,
        ...(opts?.userId ? { userId: opts.userId } : {}),
      },
    })
  }
  const checked = await prisma.users.count({
    where: { isActive: true, ...(opts?.userId ? { id: opts.userId } : {}) },
  })
  return { checked, drifts: [], totals }
}

export async function assignUserModuleFamily(params: {
  userId: string
  familyId: string
  moduleInput: string
  role?: string
  capabilities?: Partial<FamilyAccessCapability>
}): Promise<void> {
  if (!hasUserFamilyAccessModel()) {
    throw new Error('user_family_access no disponible — ejecuta db push / migrate')
  }

  const moduleKey = resolveFamilyAccessModuleKey(params.moduleInput)
  const role = params.role ?? (await getUserRole(params.userId))
  const defaults = getModuleDefaults(moduleKey, role)
  const caps = { ...defaults, ...params.capabilities }
  const [familyId] = await normalizeActiveFamilyIds([params.familyId])
  if (!familyId) throw new Error('Familia inválida o inactiva')

  const nativeId = await getNativeFamilyId(params.userId)
  if (nativeId && familyId === nativeId) {
    throw new Error('La familia nativa no se asigna como área adicional')
  }

  await prisma.user_family_access.upsert({
    where: {
      userId_familyId_module: { userId: params.userId, familyId, module: moduleKey },
    },
    create: {
      id: randomUUID(),
      userId: params.userId,
      familyId,
      module: moduleKey,
      ...caps,
      isActive: true,
      updatedAt: new Date(),
    },
    update: {
      ...caps,
      isActive: true,
      updatedAt: new Date(),
    },
  })
}

export async function unassignUserModuleFamily(params: {
  userId: string
  familyId: string
  moduleInput: string
  role?: string
}): Promise<void> {
  if (!hasUserFamilyAccessModel()) {
    throw new Error('user_family_access no disponible — ejecuta db push / migrate')
  }

  const moduleKey = resolveFamilyAccessModuleKey(params.moduleInput)
  await prisma.user_family_access.updateMany({
    where: { userId: params.userId, familyId: params.familyId, module: moduleKey },
    data: { isActive: false, updatedAt: new Date() },
  })
}

export async function setUserModuleFamilies(params: {
  userId: string
  moduleInput: string
  familyIds: string[]
  role?: string
}): Promise<string[]> {
  if (!hasUserFamilyAccessModel()) {
    throw new Error('user_family_access no disponible — ejecuta db push / migrate')
  }

  const moduleKey = resolveFamilyAccessModuleKey(params.moduleInput)
  const role = params.role ?? (await getUserRole(params.userId))
  const nativeId = await getNativeFamilyId(params.userId)
  const desired = await normalizeActiveFamilyIds(params.familyIds.filter(id => id !== nativeId))
  const defaults = getModuleDefaults(moduleKey, role)

  const current = await prisma.user_family_access.findMany({
    where: { userId: params.userId, module: moduleKey, isActive: true },
    select: { familyId: true },
  })
  const currentIds = current.map(r => r.familyId)
  const toAdd = desired.filter(id => !currentIds.includes(id))
  const toRemove = currentIds.filter(id => !desired.includes(id))

  for (const familyId of toAdd) {
    await assignUserModuleFamily({
      userId: params.userId,
      familyId,
      moduleInput: moduleKey,
      role,
      capabilities: defaults,
    })
  }
  for (const familyId of toRemove) {
    await unassignUserModuleFamily({
      userId: params.userId,
      familyId,
      moduleInput: moduleKey,
      role,
    })
  }

  return desired
}

/** @deprecated Ya no hay dual-write; usa assignUserModuleFamily. */
export async function mirrorLegacyAssignmentToUnified(params: {
  userId: string
  familyId: string
  moduleInput: string
  active: boolean
  role?: string
}): Promise<void> {
  if (params.active) {
    await assignUserModuleFamily({
      userId: params.userId,
      familyId: params.familyId,
      moduleInput: params.moduleInput,
      role: params.role,
    }).catch(() => {})
  } else {
    await unassignUserModuleFamily({
      userId: params.userId,
      familyId: params.familyId,
      moduleInput: params.moduleInput,
      role: params.role,
    }).catch(() => {})
  }
}

/** @deprecated Usa setUserModuleFamilies. */
export async function syncUnifiedModuleSetFromLegacy(params: {
  userId: string
  moduleInput: string
  familyIds: string[]
  role?: string
}): Promise<void> {
  await setUserModuleFamilies(params)
}

/** @deprecated */
export function voidMirrorLegacy(params: {
  userId: string
  familyId: string
  moduleInput: string
  active: boolean
  role?: string
}): void {
  void mirrorLegacyAssignmentToUnified(params)
}

export type UserFamilyAccessSnapshot = {
  module: string
  familyIds: string[]
  nativeFamilyId: string | null
}

export async function getUserFamilyAccessSnapshot(
  userId: string,
  modules?: string[]
): Promise<UserFamilyAccessSnapshot[]> {
  const keys = modules?.length
    ? modules.map(resolveFamilyAccessModuleKey)
    : Object.keys(FAMILY_ACCESS_MODULES)
  const unique = [...new Set(keys)]
  const nativeFamilyId = await getNativeFamilyId(userId)
  const out: UserFamilyAccessSnapshot[] = []
  for (const moduleKey of unique) {
    const familyIds = await getUserModuleFamilyGrantIds(userId, moduleKey)
    out.push({ module: moduleKey, familyIds, nativeFamilyId })
  }
  return out
}
