import { createHash, randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { resolveModuleFamilyScopeIds } from '@/lib/auth/user-family-access'

export type AccessModulePermission = {
  canScan: boolean
  canManage: boolean
  /** Borrado permanente: solo Super Admin. */
  canDelete: boolean
  /** undefined is global scope (Super Admin). */
  familyIds?: string[]
}

export async function getAccessModulePermission(
  userId: string,
  role: string
): Promise<AccessModulePermission> {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: {
      isActive: true,
      isSuperAdmin: true,
      role: true,
      accessEnabled: true,
      canManageAccess: true,
    },
  })
  if (!user?.isActive) {
    return { canScan: false, canManage: false, canDelete: false, familyIds: [] }
  }
  if (user.isSuperAdmin) {
    return { canScan: true, canManage: true, canDelete: true }
  }

  const canManage = user.canManageAccess
  const canScan = user.accessEnabled || canManage
  if (!canScan) return { canScan: false, canManage: false, canDelete: false, familyIds: [] }

  const familyIds = await resolveModuleFamilyScopeIds(
    userId,
    'access',
    canManage ? 'canOperate' : 'canView'
  )
  return { canScan, canManage, canDelete: false, familyIds }
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

export async function assertCanDeleteAccess(userId: string, role: string) {
  const permission = await getAccessModulePermission(userId, role)
  if (!permission.canDelete) {
    return NextResponse.json(
      { error: 'Solo Super Admin puede eliminar pases de acceso.' },
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

  const accMatch = trimmed.match(/ACC-\d{4}-[A-Z0-9]{8}/i)
  if (accMatch) return accMatch[0]

  return trimmed
}

export function resolveAccessPassState(pass: {
  status: 'PENDING_PRIVACY' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED'
  validFrom: Date
  validUntil: Date
  subject: { isActive: boolean }
}):
  | 'VALID'
  | 'EXPIRED'
  | 'NOT_YET_VALID'
  | 'REVOKED'
  | 'SUSPENDED'
  | 'PENDING_PRIVACY'
  | 'INACTIVE_SUBJECT' {
  const now = new Date()
  if (!pass.subject.isActive) return 'INACTIVE_SUBJECT'
  if (pass.status === 'REVOKED') return 'REVOKED'
  if (pass.status === 'PENDING_PRIVACY') return 'PENDING_PRIVACY'
  if (pass.status === 'SUSPENDED') return 'SUSPENDED'
  // "Todavía no inicia" y "ya venció" son estados distintos para quien escanea:
  // uno se resuelve esperando a la hora de inicio, el otro requiere reemitir el pase.
  if (pass.validFrom > now) return 'NOT_YET_VALID'
  // Inválido desde el instante de vencimiento (validUntil inclusive como límite).
  if (pass.validUntil <= now) return 'EXPIRED'
  return 'VALID'
}

const CREDENTIAL_CODE_RE = /^ACC-\d{4}-[A-Z0-9]{8}$/i

export function isAccessCredentialCode(value: string): boolean {
  return CREDENTIAL_CODE_RE.test(value.trim())
}

export const ACCESS_SCAN_MESSAGES: Record<string, string> = {
  VALID: 'Acceso autorizado',
  EXPIRED: 'Credencial vencida',
  NOT_YET_VALID: 'Credencial aún no vigente: su periodo de acceso todavía no inicia',
  REVOKED: 'Credencial revocada',
  SUSPENDED: 'Credencial suspendida',
  PENDING_PRIVACY: 'Credencial pendiente: la persona aún no ha aceptado el aviso de privacidad.',
  INACTIVE_SUBJECT: 'La persona de esta credencial está inactiva',
  NOT_FOUND: 'Credencial no reconocida. Usa el QR o el código ACC-… de la tabla.',
  OUT_OF_SCOPE: 'No tienes autorización para verificar esta área.',
  FORBIDDEN: 'No tienes acceso al módulo de Accesos.',
}

const PASS_SCAN_INCLUDE = {
  subject: {
    select: {
      firstName: true,
      lastName: true,
      accessType: true,
      organization: true,
      purpose: true,
      photoPath: true,
      isActive: true,
    },
  },
  family: { select: { id: true, name: true, code: true } },
}

/** Busca por token QR (ACCESS:…) o por código visible ACC-YYYY-XXXXXXXX. */
export async function findAccessPassByScanPayload(raw: string) {
  const token = normalizeAccessQrPayload(raw)
  if (!token) return null
  const db = prisma as any

  if (token.length >= 32 && !isAccessCredentialCode(token)) {
    const byToken = await db.access_passes.findUnique({
      where: { tokenHash: hashAccessQrSecret(token) },
      include: PASS_SCAN_INCLUDE,
    })
    if (byToken) return byToken
  }

  if (isAccessCredentialCode(token)) {
    return db.access_passes.findFirst({
      where: { credentialCode: token.trim().toUpperCase() },
      include: PASS_SCAN_INCLUDE,
    })
  }

  return db.access_passes.findUnique({
    where: { tokenHash: hashAccessQrSecret(token) },
    include: PASS_SCAN_INCLUDE,
  })
}
