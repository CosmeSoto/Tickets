import prisma from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
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
 * Ver credenciales inferiores = ver/editar las de roles inferiores en el área.
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

/** Inferiores cuya nativa/grants de credentials intersectan el scope del viewer. */
async function getInferiorCreatorIdsInCredentialsScope(
  familyIds: string[],
  inferiorRoles: Array<'ADMIN' | 'TECHNICIAN' | 'CLIENT'>
): Promise<string[]> {
  if (familyIds.length === 0 || inferiorRoles.length === 0) return []

  const moduleKey = (await import('@/lib/auth/family-access-modules')).resolveFamilyAccessModuleKey(
    'credentials'
  )

  const users = await prisma.users.findMany({
    where: {
      isActive: true,
      isSuperAdmin: false,
      role: { in: inferiorRoles },
      OR: [
        { departments: { familyId: { in: familyIds } } },
        {
          userFamilyAccess: {
            some: {
              module: moduleKey,
              isActive: true,
              canView: true,
              familyId: { in: familyIds },
            },
          },
        },
      ],
    },
    select: { id: true },
  })
  return users.map(u => u.id)
}

async function personalVaultOverlapsCredentialsScope(
  viewerUserId: string,
  creatorUserId: string,
  isSuperAdmin?: boolean
): Promise<boolean> {
  const scope = await getCredentialsFamilyScopeIds(viewerUserId, { isSuperAdmin })
  if (scope.length === 0) return false
  const { mapCredentialShareFamilyIds } = await import('@/lib/credentials/share-scope')
  const creatorFamilies = (await mapCredentialShareFamilyIds([creatorUserId])).get(creatorUserId) ?? []
  if (creatorFamilies.length === 0) return false
  const set = new Set(scope)
  return creatorFamilies.some(id => set.has(id))
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
 * 1) Propias (createdBy o bóveda personal)
 * 2) Compartidas conmigo
 * 3) Con gestión completa: creadas por roles inferiores en familias de mi alcance
 * 4) SuperAdmin: todas
 * Nunca pares ni superiores salvo share explícito.
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
    return personalVaultOverlapsCredentialsScope(ctx.userId, entry.createdById, ctx.isSuperAdmin)
  }

  if (!entry.vault.familyId) return false
  const scope = await getCredentialsFamilyScopeIds(ctx.userId, {
    isSuperAdmin: ctx.isSuperAdmin,
  })
  return scope.includes(entry.vault.familyId)
}

/** Editar/borrar/compartir: dueño, o gestor de jerarquía sobre un inferior. */
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
    return personalVaultOverlapsCredentialsScope(ctx.userId, entry.createdById, ctx.isSuperAdmin)
  }
  if (!entry.vault.familyId) return false
  const scope = await getCredentialsFamilyScopeIds(ctx.userId, {
    isSuperAdmin: ctx.isSuperAdmin,
  })
  return scope.includes(entry.vault.familyId)
}

/** Prisma where para listado GET /entries según jerarquía. */
export async function buildCredentialEntriesVisibilityWhere(
  ctx: CredentialsAccessContext
): Promise<Prisma.credential_entriesWhereInput> {
  if (ctx.isSuperAdmin) {
    return { isActive: true, vault: { isActive: true } }
  }

  const familyIds = await getCredentialsFamilyScopeIds(ctx.userId, {
    isSuperAdmin: false,
  })
  const canHierarchy = await canManageCredentialsHierarchy(ctx.userId, ctx.role, ctx.isSuperAdmin)
  const inferiorRoles = inferiorCredentialRoles(ctx.role, ctx.isSuperAdmin)

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

  if (canHierarchy && inferiorRoles.length > 0) {
    const inferiorIds = await getInferiorCreatorIdsInCredentialsScope(familyIds, inferiorRoles)
    if (inferiorIds.length > 0) {
      or.push({
        createdById: { in: inferiorIds },
        vault: {
          isActive: true,
          OR: [
            ...(familyIds.length > 0 ? [{ familyId: { in: familyIds } }] : []),
            { kind: 'PERSONAL' as const },
          ],
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
