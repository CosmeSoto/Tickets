import { createHash, randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { resolveModuleFamilyScopeIds } from '@/lib/auth/user-family-access'
import { ACCESS_SCAN_MESSAGES, resolveAccessPassState } from '@/lib/access/access-pass-state'

// Re-exportado por compatibilidad: la máquina de estados y sus catálogos viven en
// access-pass-state.ts (única fuente de verdad, sin dependencia de Prisma, compartida
// con el cliente) desde que se centralizaron junto con la validación de transiciones.
export { resolveAccessPassState, ACCESS_SCAN_MESSAGES }

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

/**
 * `access_organizations` es un catálogo global (sin `familyId`): lo puede usar
 * cualquier área. Un gestor con permiso en una sola área puede mutar/borrar una
 * organización solo si ningún `access_subject` que la usa está fuera de su
 * scope de familias — así no puede renombrar/desactivar algo que otras áreas
 * dependen. Super Admin (scope global, `familyIds` undefined) no restringe.
 */
export async function isAccessOrganizationInScope(
  permission: AccessModulePermission,
  organizationId: string
): Promise<boolean> {
  if (permission.familyIds === undefined) return true
  const outOfScope = await prisma.access_subjects.count({
    where: { organizationId, familyId: { notIn: permission.familyIds } },
  })
  return outOfScope === 0
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

const CREDENTIAL_CODE_RE = /^ACC-\d{4}-[A-Z0-9]{8}$/i

export function isAccessCredentialCode(value: string): boolean {
  return CREDENTIAL_CODE_RE.test(value.trim())
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
  const db = prisma

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
