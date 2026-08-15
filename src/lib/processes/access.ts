import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { resolveModuleFamilyScopeIds } from '@/lib/auth/user-family-access'

export type ProcessAccess = {
  canView: boolean
  canManage: boolean
  /** undefined = sin límite (solo Super Admin). Array vacío = sin áreas. */
  familyIds?: string[]
}

/**
 * El módulo no fija áreas en código: el alcance se resuelve desde el
 * departamento nativo y las asignaciones `user_family_access` de `processes`.
 * ADMIN normal también queda restringido a su scope de familias.
 */
export async function getProcessAccess(userId: string, role: string): Promise<ProcessAccess> {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: {
      isActive: true,
      isSuperAdmin: true,
      processesEnabled: true,
      canManageProcesses: true,
    },
  })

  if (!user?.isActive) return { canView: false, canManage: false, familyIds: [] }

  if (user.isSuperAdmin) return { canView: true, canManage: true }

  const canManage = user.canManageProcesses === true
  const canView = user.processesEnabled === true || canManage
  if (!canView) return { canView: false, canManage: false, familyIds: [] }

  const capability = canManage ? 'canOperate' : 'canView'
  const familyIds = await resolveModuleFamilyScopeIds(userId, 'processes', capability)
  return { canView, canManage, familyIds }
}

export async function assertCanViewProcesses(userId: string, role: string) {
  const access = await getProcessAccess(userId, role)
  if (!access.canView) {
    return NextResponse.json({ error: 'No tienes acceso al módulo de procesos.' }, { status: 403 })
  }
  return null
}

export async function assertCanManageProcesses(userId: string, role: string) {
  const access = await getProcessAccess(userId, role)
  if (!access.canManage) {
    return NextResponse.json(
      { error: 'No tienes permisos para gestionar procesos y procedimientos.' },
      { status: 403 }
    )
  }
  return null
}

export function isFamilyWithinProcessScope(access: ProcessAccess, familyId: string): boolean {
  return !access.familyIds || access.familyIds.includes(familyId)
}

/** Campos seguros para devolver adjuntos al cliente (sin path del servidor). */
export function sanitizeProcessAttachment(attachment: {
  id: string
  processId: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  uploadedById: string
  createdAt: Date | string
}) {
  return {
    id: attachment.id,
    processId: attachment.processId,
    filename: attachment.filename,
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    uploadedById: attachment.uploadedById,
    createdAt: attachment.createdAt,
    url: `/api/processes/${attachment.processId}/attachments/${attachment.id}/file`,
  }
}

/** Valida que el responsable pueda ver/gestionar el área del proceso. */
export async function assertOwnerCanOwnProcess(ownerId: string, familyId: string) {
  const owner = await prisma.users.findFirst({
    where: { id: ownerId, isActive: true },
    select: {
      id: true,
      processesEnabled: true,
      canManageProcesses: true,
      isSuperAdmin: true,
      departments: { select: { familyId: true } },
    },
  })
  if (!owner) {
    return NextResponse.json({ error: 'El responsable no está activo.' }, { status: 400 })
  }
  if (owner.isSuperAdmin) return null
  if (!(owner.processesEnabled || owner.canManageProcesses)) {
    return NextResponse.json(
      { error: 'El responsable no tiene el módulo de procesos habilitado.' },
      { status: 400 }
    )
  }
  if (owner.departments?.familyId === familyId) return null
  const grant = await prisma.user_family_access.findFirst({
    where: {
      userId: ownerId,
      familyId,
      module: 'processes',
      OR: [{ canView: true }, { canOperate: true }, { canConsume: true }],
    },
    select: { id: true },
  })
  if (!grant) {
    return NextResponse.json(
      { error: 'El responsable no tiene acceso al área del proceso.' },
      { status: 400 }
    )
  }
  return null
}
