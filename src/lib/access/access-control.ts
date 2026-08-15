import { createHash, randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { resolveModuleFamilyScopeIds } from '@/lib/auth/user-family-access'

export type AccessModulePermission = {
  canScan: boolean
  canManage: boolean
  /** undefined is global scope (Super Admin). */
  familyIds?: string[]
}

export async function getAccessModulePermission(
  userId: string,
  _role: string
): Promise<AccessModulePermission> {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { isActive: true, isSuperAdmin: true, accessEnabled: true, canManageAccess: true },
  })
  if (!user?.isActive) return { canScan: false, canManage: false, familyIds: [] }
  if (user.isSuperAdmin) return { canScan: true, canManage: true }

  const canManage = user.canManageAccess
  const canScan = user.accessEnabled || canManage
  if (!canScan) return { canScan: false, canManage: false, familyIds: [] }

  const familyIds = await resolveModuleFamilyScopeIds(
    userId,
    'access',
    canManage ? 'canOperate' : 'canView'
  )
  return { canScan, canManage, familyIds }
}

export async function assertCanScanAccess(userId: string, role: string) {
  const permission = await getAccessModulePermission(userId, role)
  if (!permission.canScan) {
    return NextResponse.json({ error: 'No tienes acceso al módulo de Accesos.' }, { status: 403 })
  }
  return null
}

export async function assertCanManageAccess(userId: string, role: string) {
  const permission = await getAccessModulePermission(userId, role)
  if (!permission.canManage) {
    return NextResponse.json(
      { error: 'No tienes permiso para gestionar pases de acceso.' },
      { status: 403 }
    )
  }
  return null
}

export function isAccessFamilyAllowed(
  permission: AccessModulePermission,
  familyId: string
): boolean {
  return !permission.familyIds || permission.familyIds.includes(familyId)
}

/** Token opaco; la BD persiste exclusivamente el hash SHA-256. */
export function generateAccessQrSecret(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: hashAccessQrSecret(token) }
}

export function hashAccessQrSecret(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function normalizeAccessQrPayload(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('ACCESS:')) return trimmed.slice('ACCESS:'.length)
  return trimmed
}

export function resolveAccessPassState(pass: {
  status: 'PENDING_PRIVACY' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED'
  validFrom: Date
  validUntil: Date
  subject: { isActive: boolean }
}): 'VALID' | 'EXPIRED' | 'REVOKED' | 'SUSPENDED' | 'INACTIVE_SUBJECT' {
  const now = new Date()
  if (!pass.subject.isActive) return 'INACTIVE_SUBJECT'
  if (pass.status === 'REVOKED') return 'REVOKED'
  if (pass.status === 'SUSPENDED' || pass.status === 'PENDING_PRIVACY') return 'SUSPENDED'
  // Inválido desde el instante de vencimiento (validUntil inclusive como límite).
  if (pass.validFrom > now || pass.validUntil <= now) return 'EXPIRED'
  return 'VALID'
}
