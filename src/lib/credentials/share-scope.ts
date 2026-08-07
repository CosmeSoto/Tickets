/**
 * Alcance de compartición de credenciales (usuario → usuario).
 *
 * Reglas:
 * - SuperAdmin: puede compartir con cualquier usuario activo (auditable).
 * - Admin (no super): usuarios de igual o menor rango cuya familia nativa o
 *   grants intersectan el alcance de credenciales del emisor. No SuperAdmins.
 * - Técnico / Cliente con canManage: solo roles ≤ al suyo en familias del alcance.
 *
 * El destinatario debe tener credentialsEnabled (o ser SuperAdmin) para usar el módulo;
 * los candidatos sin módulo se listan marcados para que el gestor sepa activarlos.
 */

import prisma from '@/lib/prisma'
import { getCredentialsFamilyScopeIds } from '@/lib/credentials/access'

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

async function mapUserFamilyTouchIds(userIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  if (userIds.length === 0) return map

  const [users, grants] = await Promise.all([
    prisma.users.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        departments: { select: { familyId: true } },
      },
    }),
    prisma.user_family_access.findMany({
      where: { userId: { in: userIds }, isActive: true },
      select: { userId: true, familyId: true },
    }),
  ])

  for (const u of users) {
    const ids = new Set<string>()
    if (u.departments?.familyId) ids.add(u.departments.familyId)
    map.set(u.id, [...ids])
  }
  for (const g of grants) {
    const cur = map.get(g.userId) ?? []
    if (!cur.includes(g.familyId)) cur.push(g.familyId)
    map.set(g.userId, cur)
  }
  return map
}

export async function listCredentialShareCandidates(
  actor: ShareActor,
  opts?: { q?: string; take?: number }
): Promise<ShareCandidate[]> {
  const q = opts?.q?.trim() ?? ''
  const take = opts?.take ?? 50

  const actorRank = roleRank(actor.role, actor.isSuperAdmin === true)
  const actorFamilyIds =
    actor.isSuperAdmin === true
      ? null
      : await getCredentialsFamilyScopeIds(actor.userId, { isSuperAdmin: false })

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
      : await mapUserFamilyTouchIds(users.map(u => u.id))

  const out: ShareCandidate[] = []

  for (const u of users) {
    const targetRank = roleRank(u.role, u.isSuperAdmin === true)

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

    if (u.isSuperAdmin) continue
    if (targetRank > actorRank) continue

    const targetFamilies = familyMap.get(u.id) ?? []
    if (!actorFamilyIds || actorFamilyIds.length === 0) continue
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

  // Reutiliza el listado (incluye reglas de rango/área); busca por id exacto con q vacío
  // y filtro amplio — para un id concreto validamos inline con la misma lógica.
  const actorRank = roleRank(actor.role, actor.isSuperAdmin === true)
  const targetRank = roleRank(targetUser.role, targetUser.isSuperAdmin === true)

  if (actor.isSuperAdmin !== true) {
    if (targetUser.isSuperAdmin) {
      return { ok: false, error: 'No puedes compartir hacia un SuperAdmin desde tu rol' }
    }
    if (targetRank > actorRank) {
      return { ok: false, error: 'Solo puedes compartir con usuarios de tu nivel o inferior' }
    }
    const [actorFamilyIds, familyMap] = await Promise.all([
      getCredentialsFamilyScopeIds(actor.userId, { isSuperAdmin: false }),
      mapUserFamilyTouchIds([targetUserId]),
    ])
    if (!familiesOverlap(actorFamilyIds, familyMap.get(targetUserId) ?? [])) {
      return { ok: false, error: 'El usuario no pertenece a tus áreas de credenciales' }
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
