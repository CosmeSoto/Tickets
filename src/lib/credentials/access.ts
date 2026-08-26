import prisma from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { getNativeFamilyId } from '@/lib/auth/family-scope'
import { resolveModuleFamilyScopeIds } from '@/lib/auth/user-family-access'
import { DEFAULT_AREA_VAULT_NAME } from '@/lib/credentials/constants'

export { DEFAULT_AREA_VAULT_NAME }

export type CredentialsAccessContext = {
  userId: string
  role: string
  isSuperAdmin?: boolean
}

type VaultShape = { familyId: string | null; ownerUserId: string | null; kind: string }

type EntryAccessShape = {
  id: string
  createdById: string
  vault: VaultShape
  createdBy?: { role: string; isSuperAdmin: boolean | null }
}

/** SuperAdmin(4) > Admin(3) > Técnico(2) > Cliente(1) */
export function credentialsRoleRank(role: string, isSuperAdmin?: boolean): number {
  if (role === 'ADMIN' && isSuperAdmin) return 4
  if (role === 'ADMIN') return 3
  if (role === 'TECHNICIAN') return 2
  if (role === 'CLIENT') return 1
  return 0
}

/** Roles estrictamente inferiores (nunca pares ni superiores). */
export function inferiorCredentialRoles(
  role: string,
  isSuperAdmin?: boolean
): Array<'ADMIN' | 'TECHNICIAN' | 'CLIENT'> {
  const rank = credentialsRoleRank(role, isSuperAdmin)
  if (rank >= 4) return ['ADMIN', 'TECHNICIAN', 'CLIENT']
  if (rank === 3) return ['TECHNICIAN', 'CLIENT']
  if (rank === 2) return ['CLIENT']
  return []
}

export async function checkCredentialsModuleAccess(
  ctx: CredentialsAccessContext
): Promise<boolean> {
  const { userId, role, isSuperAdmin } = ctx

  if (role === 'ADMIN' && isSuperAdmin) return true

  if (role !== 'ADMIN' && role !== 'TECHNICIAN' && role !== 'CLIENT') return false

  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { credentialsEnabled: true, isActive: true },
  })
  return !!user?.isActive && user.credentialsEnabled === true
}

/**
 * Crear credenciales propias: basta el módulo activo.
 * («Ver credenciales inferiores» NO es requisito para crear.)
 */
export async function canCreateCredentials(
  userId: string,
  role: string,
  isSuperAdmin?: boolean
): Promise<boolean> {
  return checkCredentialsModuleAccess({ userId, role, isSuperAdmin })
}

/**
 * Ver credenciales inferiores = ver/editar las de roles inferiores en la familia nativa.
 * SuperAdmin siempre. ADMIN/TECH requieren canManageCredentials.
 */
export async function canManageCredentialsHierarchy(
  userId: string,
  role: string,
  isSuperAdmin?: boolean
): Promise<boolean> {
  if (role === 'ADMIN' && isSuperAdmin) return true

  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { canManageCredentials: true, credentialsEnabled: true, isActive: true },
  })
  return !!user?.isActive && user.credentialsEnabled === true && user.canManageCredentials === true
}

/** @deprecated Usar canManageCredentialsHierarchy o canCreateCredentials */
export async function canManageCredentialsVault(
  userId: string,
  role: string,
  isSuperAdmin?: boolean
): Promise<boolean> {
  return canManageCredentialsHierarchy(userId, role, isSuperAdmin)
}

/**
 * Familias visibles en credenciales.
 * - SuperAdmin: todas activas
 * - Resto: familia nativa + grants del módulo credentials (sin fallback a inventario)
 */
export async function getCredentialsFamilyScopeIds(
  userId: string,
  opts?: { isSuperAdmin?: boolean }
): Promise<string[]> {
  if (opts?.isSuperAdmin) {
    const all = await prisma.families.findMany({
      where: { isActive: true },
      select: { id: true },
    })
    return all.map(f => f.id)
  }

  return resolveModuleFamilyScopeIds(userId, 'credentials', 'canView')
}

/**
 * Inferiores con familia nativa = área nativa del viewer.
 * Las familias asignadas no dan visibilidad automática: solo shares.
 */
async function getInferiorCreatorIdsInNativeFamily(
  nativeFamilyId: string,
  inferiorRoles: Array<'ADMIN' | 'TECHNICIAN' | 'CLIENT'>
): Promise<string[]> {
  if (!nativeFamilyId || inferiorRoles.length === 0) return []

  const users = await prisma.users.findMany({
    where: {
      isActive: true,
      isSuperAdmin: false,
      role: { in: inferiorRoles },
      departments: { familyId: nativeFamilyId },
    },
    select: { id: true },
  })
  return users.map(u => u.id)
}

async function creatorSharesNativeFamily(
  viewerUserId: string,
  creatorUserId: string
): Promise<boolean> {
  const [viewerNative, creatorNative] = await Promise.all([
    getNativeFamilyId(viewerUserId),
    getNativeFamilyId(creatorUserId),
  ])
  return Boolean(viewerNative && creatorNative && viewerNative === creatorNative)
}

/**
 * Acceso a bóveda (para listar bóvedas / crear en ella):
 * - PERSONAL: solo el dueño
 * - AREA: familia en scope (sigue haciendo falta para guardar en el área)
 * Nota: ver entradas del área NO implica ser dueño de todas; eso lo filtra userCanAccessEntry.
 */
export async function userCanAccessVault(
  ctx: CredentialsAccessContext,
  vault: VaultShape
): Promise<boolean> {
  if (!(await checkCredentialsModuleAccess(ctx))) return false

  if (vault.kind === 'PERSONAL') {
    return vault.ownerUserId === ctx.userId
  }

  if (ctx.isSuperAdmin) return true

  if (!vault.familyId) return false
  const scope = await getCredentialsFamilyScopeIds(ctx.userId, {
    isSuperAdmin: ctx.isSuperAdmin,
  })
  return scope.includes(vault.familyId)
}

function isCreatorInferior(
  viewer: CredentialsAccessContext,
  creator: { role: string; isSuperAdmin: boolean | null }
): boolean {
  const viewerRank = credentialsRoleRank(viewer.role, viewer.isSuperAdmin)
  const creatorRank = credentialsRoleRank(creator.role, creator.isSuperAdmin === true)
  return creatorRank > 0 && creatorRank < viewerRank
}

/**
 * Visibilidad de una entrada:
 * 1) SuperAdmin: todas
 * 2) Propias (createdBy o bóveda personal)
 * 3) Compartidas conmigo (cualquier rango, si alguien me las dio)
 * 4) Con «Ver credenciales inferiores»: solo roles inferiores de mi familia nativa
 *    (nunca pares/superiores; nunca dump automático en familias asignadas)
 */
export async function userCanAccessEntry(
  ctx: CredentialsAccessContext,
  entry: EntryAccessShape
): Promise<boolean> {
  if (!(await checkCredentialsModuleAccess(ctx))) return false

  if (ctx.isSuperAdmin) return true

  if (entry.createdById === ctx.userId) return true

  if (entry.vault.kind === 'PERSONAL' && entry.vault.ownerUserId === ctx.userId) return true

  const share = await prisma.credential_shares.findFirst({
    where: { entryId: entry.id, userId: ctx.userId },
    select: { id: true },
  })
  if (share) return true

  if (!(await canManageCredentialsHierarchy(ctx.userId, ctx.role, ctx.isSuperAdmin))) {
    return false
  }

  let creator = entry.createdBy
  if (!creator) {
    const row = await prisma.users.findUnique({
      where: { id: entry.createdById },
      select: { role: true, isSuperAdmin: true },
    })
    if (!row) return false
    creator = row
  }

  if (!isCreatorInferior(ctx, creator)) return false

  if (entry.vault.kind === 'PERSONAL') {
    return creatorSharesNativeFamily(ctx.userId, entry.createdById)
  }

  const nativeId = await getNativeFamilyId(ctx.userId)
  return Boolean(nativeId && entry.vault.familyId === nativeId)
}

/** Editar/borrar/compartir: dueño, o gestor de jerarquía sobre un inferior nativo. */
export async function userCanMutateEntry(
  ctx: CredentialsAccessContext,
  entry: EntryAccessShape
): Promise<boolean> {
  if (!(await checkCredentialsModuleAccess(ctx))) return false
  if (ctx.isSuperAdmin) return true
  if (entry.createdById === ctx.userId) return true

  // Share VIEW no otorga mutación
  if (!(await canManageCredentialsHierarchy(ctx.userId, ctx.role, ctx.isSuperAdmin))) {
    return false
  }

  let creator = entry.createdBy
  if (!creator) {
    const row = await prisma.users.findUnique({
      where: { id: entry.createdById },
      select: { role: true, isSuperAdmin: true },
    })
    if (!row) return false
    creator = row
  }

  if (!isCreatorInferior(ctx, creator)) return false

  if (entry.vault.kind === 'PERSONAL') {
    return creatorSharesNativeFamily(ctx.userId, entry.createdById)
  }
  const nativeId = await getNativeFamilyId(ctx.userId)
  return Boolean(nativeId && entry.vault.familyId === nativeId)
}

/** Prisma where para listado GET /entries según jerarquía. */
export async function buildCredentialEntriesVisibilityWhere(
  ctx: CredentialsAccessContext
): Promise<Prisma.credential_entriesWhereInput> {
  if (ctx.isSuperAdmin) {
    return { isActive: true, vault: { isActive: true } }
  }

  const canHierarchy = await canManageCredentialsHierarchy(ctx.userId, ctx.role, ctx.isSuperAdmin)
  const inferiorRoles = inferiorCredentialRoles(ctx.role, ctx.isSuperAdmin)
  const nativeFamilyId = await getNativeFamilyId(ctx.userId)

  const or: Prisma.credential_entriesWhereInput[] = [
    { createdById: ctx.userId },
    {
      vault: {
        isActive: true,
        kind: 'PERSONAL',
        ownerUserId: ctx.userId,
      },
    },
    {
      vault: { isActive: true },
      shares: { some: { userId: ctx.userId } },
    },
  ]

  if (canHierarchy && inferiorRoles.length > 0 && nativeFamilyId) {
    const inferiorIds = await getInferiorCreatorIdsInNativeFamily(nativeFamilyId, inferiorRoles)
    if (inferiorIds.length > 0) {
      or.push({
        createdById: { in: inferiorIds },
        vault: {
          isActive: true,
          OR: [{ familyId: nativeFamilyId }, { kind: 'PERSONAL' as const }],
        },
      })
    }
  }

  return {
    isActive: true,
    OR: or,
  }
}

/** Share solo VIEW en MVP: no otorga editar/borrar. */
export async function userHasEntryShare(userId: string, entryId: string): Promise<boolean> {
  const share = await prisma.credential_shares.findFirst({
    where: { entryId, userId },
    select: { id: true },
  })
  return !!share
}

/** Valida que el equipo exista y su familia esté en scope (o SuperAdmin). */
export async function assertEquipmentLinkAllowed(
  ctx: CredentialsAccessContext,
  equipmentId: string | null | undefined,
  vaultFamilyId: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!equipmentId) return { ok: true }

  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    select: {
      id: true,
      type: { select: { familyId: true } },
    },
  })
  if (!equipment) return { ok: false, error: 'Equipo no encontrado' }

  const equipmentFamilyId = equipment.type?.familyId ?? null
  if (!equipmentFamilyId) {
    return { ok: false, error: 'El equipo no tiene área asociada' }
  }

  if (vaultFamilyId && vaultFamilyId !== equipmentFamilyId) {
    return { ok: false, error: 'El equipo pertenece a otra área distinta de la bóveda' }
  }

  if (ctx.isSuperAdmin) return { ok: true }

  const scope = await getCredentialsFamilyScopeIds(ctx.userId, {
    isSuperAdmin: ctx.isSuperAdmin,
  })
  if (!scope.includes(equipmentFamilyId)) {
    return { ok: false, error: 'Equipo fuera de tu alcance de credenciales' }
  }

  return { ok: true }
}

/** Valida que la licencia exista y su familia esté en scope (o SuperAdmin). */
export async function assertLicenseLinkAllowed(
  ctx: CredentialsAccessContext,
  licenseId: string | null | undefined,
  vaultFamilyId: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!licenseId) return { ok: true }

  const license = await prisma.software_licenses.findUnique({
    where: { id: licenseId },
    select: {
      id: true,
      licenseType: { select: { familyId: true } },
    },
  })
  if (!license) return { ok: false, error: 'Licencia no encontrada' }

  const licenseFamilyId = license.licenseType?.familyId ?? null
  if (!licenseFamilyId) {
    return { ok: false, error: 'La licencia no tiene área asociada' }
  }

  if (vaultFamilyId && vaultFamilyId !== licenseFamilyId) {
    return { ok: false, error: 'La licencia pertenece a otra área distinta de la bóveda' }
  }

  if (ctx.isSuperAdmin) return { ok: true }

  const scope = await getCredentialsFamilyScopeIds(ctx.userId, {
    isSuperAdmin: ctx.isSuperAdmin,
  })
  if (!scope.includes(licenseFamilyId)) {
    return { ok: false, error: 'Licencia fuera de tu alcance de credenciales' }
  }

  return { ok: true }
}

export async function ensureDefaultAreaVault(familyId: string) {
  const existing = await prisma.credential_vaults.findFirst({
    where: {
      familyId,
      kind: 'AREA',
      isActive: true,
      name: DEFAULT_AREA_VAULT_NAME,
    },
  })
  if (existing) return existing

  return prisma.credential_vaults.create({
    data: {
      familyId,
      name: DEFAULT_AREA_VAULT_NAME,
      kind: 'AREA',
      isActive: true,
    },
  })
}

/**
 * Variante batch de ensureDefaultAreaVault: en vez de 1-2 round-trips *por
 * familia* en serie (lento y propenso a duplicados bajo concurrencia), hace
 * como máximo 2 queries fijas para cualquier cantidad de familias.
 * Pensada para el hot-path de GET /credentials/vaults, que corre en cada
 * carga/refresh del módulo.
 */
export async function ensureDefaultAreaVaults(familyIds: string[]): Promise<void> {
  const uniqueIds = Array.from(new Set(familyIds))
  if (uniqueIds.length === 0) return

  const existing = await prisma.credential_vaults.findMany({
    where: {
      familyId: { in: uniqueIds },
      kind: 'AREA',
      isActive: true,
      name: DEFAULT_AREA_VAULT_NAME,
    },
    select: { familyId: true },
  })
  const existingIds = new Set(existing.map(v => v.familyId))
  const missingIds = uniqueIds.filter(id => !existingIds.has(id))
  if (missingIds.length === 0) return

  await prisma.credential_vaults.createMany({
    data: missingIds.map(familyId => ({
      familyId,
      name: DEFAULT_AREA_VAULT_NAME,
      kind: 'AREA' as const,
      isActive: true,
    })),
    skipDuplicates: true,
  })
}

/** Metadata fields only — never include secretEncrypted. */
export const credentialEntryMetadataSelect = {
  id: true,
  vaultId: true,
  title: true,
  username: true,
  url: true,
  notes: true,
  entryType: true,
  equipmentId: true,
  licenseId: true,
  createdById: true,
  updatedById: true,
  lastRevealedAt: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  vault: {
    select: {
      id: true,
      name: true,
      familyId: true,
      ownerUserId: true,
      kind: true,
      family: { select: { id: true, name: true, code: true, color: true } },
    },
  },
  createdBy: {
    select: { id: true, name: true, email: true, role: true, isSuperAdmin: true },
  },
} as const
