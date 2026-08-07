import prisma from '@/lib/prisma'
import {
  getUserModuleFamilyGrantIds,
  resolveModuleFamilyScopeIds,
} from '@/lib/auth/user-family-access'
import { getNativeFamilyId, normalizeActiveFamilyIds } from '@/lib/auth/family-scope'
import { DEFAULT_AREA_VAULT_NAME } from '@/lib/credentials/constants'

export { DEFAULT_AREA_VAULT_NAME }

export type CredentialsAccessContext = {
  userId: string
  role: string
  isSuperAdmin?: boolean
}

function dedupe(ids: (string | null | undefined)[]): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))]
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

/** Gestionar = crear/editar/borrar. ADMIN con módulo ON, o TECH/CLIENT con canManage. */
export async function canManageCredentialsVault(
  userId: string,
  role: string,
  isSuperAdmin?: boolean
): Promise<boolean> {
  if (role === 'ADMIN' && isSuperAdmin) return true

  if (role === 'ADMIN') {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { credentialsEnabled: true, isActive: true },
    })
    return !!user?.isActive && user.credentialsEnabled === true
  }

  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { canManageCredentials: true, credentialsEnabled: true, isActive: true },
  })
  return !!user?.isActive && user.credentialsEnabled === true && user.canManageCredentials === true
}

/**
 * Familias visibles en credenciales.
 * - SuperAdmin: todas activas
 * - Si hay grants de credentials: nativa + grants credentials
 * - Si no hay grants credentials: fallback a scope de inventario (útil al enlazar equipos)
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

  const grants = await getUserModuleFamilyGrantIds(userId, 'credentials', 'canView')
  if (grants.length > 0) {
    const nativeId = await getNativeFamilyId(userId)
    return normalizeActiveFamilyIds(dedupe([nativeId, ...grants]))
  }

  return resolveModuleFamilyScopeIds(userId, 'inventory', 'canView')
}

export async function userCanAccessVault(
  ctx: CredentialsAccessContext,
  vault: { familyId: string | null; ownerUserId: string | null; kind: string }
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

/** Acceso a una entrada: bóveda del área/personal, o share explícito (userId). */
export async function userCanAccessEntry(
  ctx: CredentialsAccessContext,
  entry: {
    id: string
    vault: { familyId: string | null; ownerUserId: string | null; kind: string }
  }
): Promise<boolean> {
  if (await userCanAccessVault(ctx, entry.vault)) return true

  if (!(await checkCredentialsModuleAccess(ctx))) return false

  const share = await prisma.credential_shares.findFirst({
    where: {
      entryId: entry.id,
      userId: ctx.userId,
    },
    select: { id: true },
  })
  return !!share
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
  createdBy: { select: { id: true, name: true } },
} as const
