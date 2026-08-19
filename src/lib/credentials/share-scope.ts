/**
 * Alcance de compartición de credenciales (usuario → usuario).
 *
 * Visibilidad automática (jerarquía) y compartido son reglas distintas:
 * - Jerarquía: solo hacia abajo y solo familia nativa (ver access.ts).
 * - Compartir: cualquier rango (cliente → técnico, técnico → admin, etc.)
 *   si hay intersección de familia nativa o asignada de Credenciales.
 * - Nunca hacia SuperAdmin salvo que el emisor sea SuperAdmin.
 * - SuperAdmin: puede compartir con cualquier usuario activo (auditable).
 *
 * El destinatario debe tener credentialsEnabled (o ser SuperAdmin) para usar el módulo;
 * los candidatos sin módulo se listan marcados para que el gestor sepa activarlos.
 *
 * Nota: «Ver credenciales inferiores» NO es requisito para compartir; basta el módulo ON
 * y ser dueño (o gestor) de la entrada.
 */

import prisma from '@/lib/prisma'
import { normalizeActiveFamilyIds } from '@/lib/auth/family-scope'
import { resolveFamilyAccessModuleKey } from '@/lib/auth/family-access-modules'

export type ShareActor = {
  userId: string
  role: string
  isSuperAdmin?: boolean
}

export type ShareCandidate = {
  id: string
  name: string
  email: string
  role: string
  isSuperAdmin: boolean
  credentialsEnabled: boolean
  canReceiveShare: boolean
  reasonBlocked?: string
  /** Familias usadas para el cruce (nativa + asignadas credenciales). */
  familyIds?: string[]
}

function roleRank(role: string, isSuperAdmin: boolean): number {
  if (role === 'ADMIN' && isSuperAdmin) return 4
  if (role === 'ADMIN') return 3
  if (role === 'TECHNICIAN') return 2
  if (role === 'CLIENT') return 1
  return 0
}

function familiesOverlap(a: string[], b: string[]): boolean {
  if (a.length === 0 || b.length === 0) return false
  const set = new Set(a)
  return b.some(id => set.has(id))
}

/** Destino de share por rango: cualquier rol de familia, nunca SuperAdmin (salvo emisor SuperAdmin). */
export function isAllowedCredentialShareTarget(
  actor: { role: string; isSuperAdmin?: boolean },
  target: { role: string; isSuperAdmin?: boolean }
): boolean {
  if (actor.isSuperAdmin === true) return true
  if (target.isSuperAdmin === true) return false
  return roleRank(actor.role, false) > 0 && roleRank(target.role, false) > 0
}

/**
 * Familias para compartir: nativa (departamento) + asignadas del módulo Credenciales.
 * Misma regla para emisor y destinatario, en todos los roles.
 */
export async function mapCredentialShareFamilyIds(
  userIds: string[]
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  const uniqueIds = [...new Set(userIds.filter(Boolean))]
  if (uniqueIds.length === 0) return map

  const moduleKey = resolveFamilyAccessModuleKey('credentials')

  const [users, grants] = await Promise.all([
    prisma.users.findMany({
      where: { id: { in: uniqueIds } },
      select: {
        id: true,
        departments: { select: { familyId: true } },
      },
    }),
    prisma.user_family_access.findMany({
      where: {
        userId: { in: uniqueIds },
        module: moduleKey,
        isActive: true,
        canView: true,
      },
      select: { userId: true, familyId: true },
    }),
  ])

  const raw = new Map<string, string[]>()
  for (const id of uniqueIds) raw.set(id, [])

  for (const u of users) {
    const ids = raw.get(u.id) ?? []
    if (u.departments?.familyId) ids.push(u.departments.familyId)
    raw.set(u.id, ids)
  }
  for (const g of grants) {
    const ids = raw.get(g.userId) ?? []
    ids.push(g.familyId)
    raw.set(g.userId, ids)
  }

  await Promise.all(
    uniqueIds.map(async id => {
      map.set(id, await normalizeActiveFamilyIds(raw.get(id) ?? []))
    })
  )

  return map
}

export async function getCredentialShareFamilyIds(userId: string): Promise<string[]> {
  const map = await mapCredentialShareFamilyIds([userId])
  return map.get(userId) ?? []
}

export async function listCredentialShareCandidates(
  actor: ShareActor,
  opts?: { q?: string; take?: number }
): Promise<ShareCandidate[]> {
  const q = opts?.q?.trim() ?? ''
  const take = opts?.take ?? 50

  const users = await prisma.users.findMany({
    where: {
      isActive: true,
      id: { not: actor.userId },
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { email: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isSuperAdmin: true,
      credentialsEnabled: true,
    },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
    take: 120,
  })

  const familyMap =
    actor.isSuperAdmin === true
      ? new Map<string, string[]>()
      : await mapCredentialShareFamilyIds([actor.userId, ...users.map(u => u.id)])

  const actorFamilyIds = actor.isSuperAdmin === true ? null : (familyMap.get(actor.userId) ?? [])

  const out: ShareCandidate[] = []

  for (const u of users) {
    if (actor.isSuperAdmin === true) {
      const canReceive = u.credentialsEnabled === true || u.isSuperAdmin === true
      out.push({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        isSuperAdmin: u.isSuperAdmin === true,
        credentialsEnabled: u.credentialsEnabled === true,
        canReceiveShare: canReceive,
        reasonBlocked: canReceive
          ? undefined
          : 'Activa el módulo Credenciales en Usuarios para este destinatario',
      })
      if (out.length >= take) break
      continue
    }

    if (
      !isAllowedCredentialShareTarget(actor, {
        role: u.role,
        isSuperAdmin: u.isSuperAdmin === true,
      })
    ) {
      continue
    }

    if (!actorFamilyIds || actorFamilyIds.length === 0) continue

    const targetFamilies = familyMap.get(u.id) ?? []
    if (!familiesOverlap(actorFamilyIds, targetFamilies)) continue

    const canReceive = u.credentialsEnabled === true
    out.push({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isSuperAdmin: false,
      credentialsEnabled: u.credentialsEnabled === true,
      canReceiveShare: canReceive,
      familyIds: targetFamilies,
      reasonBlocked: canReceive
        ? undefined
        : 'Activa el módulo Credenciales en Usuarios para este destinatario',
    })
    if (out.length >= take) break
  }

  return out
}

export async function assertCanShareCredentialWith(
  actor: ShareActor,
  targetUserId: string
): Promise<{ ok: true; target: ShareCandidate } | { ok: false; error: string }> {
  if (targetUserId === actor.userId) {
    return { ok: false, error: 'No puedes compartirte la credencial a ti mismo' }
  }

  const targetUser = await prisma.users.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isSuperAdmin: true,
      credentialsEnabled: true,
      isActive: true,
    },
  })
  if (!targetUser?.isActive) {
    return { ok: false, error: 'Usuario destino no encontrado o inactivo' }
  }

  if (actor.isSuperAdmin !== true) {
    if (
      !isAllowedCredentialShareTarget(actor, {
        role: targetUser.role,
        isSuperAdmin: targetUser.isSuperAdmin === true,
      })
    ) {
      return { ok: false, error: 'No puedes compartir hacia un SuperAdmin desde tu rol' }
    }

    const familyMap = await mapCredentialShareFamilyIds([actor.userId, targetUserId])
    const actorFamilies = familyMap.get(actor.userId) ?? []
    const targetFamilies = familyMap.get(targetUserId) ?? []

    if (actorFamilies.length === 0) {
      return {
        ok: false,
        error: 'No tienes área nativa ni familias de Credenciales asignadas para compartir',
      }
    }
    if (!familiesOverlap(actorFamilies, targetFamilies)) {
      return {
        ok: false,
        error: 'El usuario no comparte tu área nativa ni ninguna familia asignada de Credenciales',
      }
    }
  }

  const canReceive =
    targetUser.credentialsEnabled === true ||
    (targetUser.role === 'ADMIN' && targetUser.isSuperAdmin === true)
  if (!canReceive) {
    return {
      ok: false,
      error: 'Activa el módulo Credenciales en Usuarios para este destinatario',
    }
  }

  return {
    ok: true,
    target: {
      id: targetUser.id,
      name: targetUser.name,
      email: targetUser.email,
      role: targetUser.role,
      isSuperAdmin: targetUser.isSuperAdmin === true,
      credentialsEnabled: targetUser.credentialsEnabled === true,
      canReceiveShare: true,
    },
  }
}
