/**
 * Destinatarios de notificaciones por familia.
 *
 * Tickets (creación / cierre):
 * - Super admin: sí, si no está involucrado en el ticket.
 * - Admin: familia nativa (departamento) o área asignada en user_family_access (módulo tickets).
 *
 * Inventario y otros módulos siguen usando getFamilyScopedAdmins (super + nativo).
 */

import prisma from '@/lib/prisma'

export type NotificationRecipient = {
  id: string
  name?: string | null
  email?: string | null
}

type RecipientSelect = {
  id: true
  name?: true
  email?: true
}

function dedupeById(recipients: NotificationRecipient[]): NotificationRecipient[] {
  const seen = new Set<string>()
  const result: NotificationRecipient[] = []
  for (const recipient of recipients) {
    if (!seen.has(recipient.id)) {
      seen.add(recipient.id)
      result.push(recipient)
    }
  }
  return result
}

export function excludeRecipients(
  recipients: NotificationRecipient[],
  excludeUserIds?: Array<string | null | undefined>
): NotificationRecipient[] {
  const skip = new Set((excludeUserIds ?? []).filter((id): id is string => Boolean(id)))
  if (skip.size === 0) return recipients
  return recipients.filter(r => !skip.has(r.id))
}

/** Super admins activos. */
export async function getSuperAdmins(
  select: RecipientSelect = { id: true }
): Promise<NotificationRecipient[]> {
  return prisma.users.findMany({
    where: { role: 'ADMIN', isSuperAdmin: true, isActive: true },
    select,
  })
}

/**
 * Admins cuya familia nativa (departamento) coincide con `familyId`.
 * No incluye super admins.
 */
export async function getNativeFamilyAdmins(
  familyId: string,
  select: RecipientSelect = { id: true }
): Promise<NotificationRecipient[]> {
  return prisma.users.findMany({
    where: {
      role: 'ADMIN',
      isSuperAdmin: false,
      isActive: true,
      departments: { familyId, isActive: true },
    },
    select,
  })
}

/**
 * Admins con el área asignada (no nativa) en user_family_access.
 */
export async function getAssignedFamilyAdmins(
  familyId: string,
  moduleKey = 'tickets',
  select: RecipientSelect = { id: true }
): Promise<NotificationRecipient[]> {
  return prisma.users.findMany({
    where: {
      role: 'ADMIN',
      isSuperAdmin: false,
      isActive: true,
      userFamilyAccess: {
        some: {
          familyId,
          module: moduleKey,
          isActive: true,
        },
      },
    },
    select,
  })
}

/**
 * Admins del área de tickets: nativa + asignada. Sin super admins.
 * Para notas internas u operativa del área, no para spam global.
 */
export async function getTicketFamilyAdmins(
  familyId: string | null | undefined,
  select: RecipientSelect = { id: true }
): Promise<NotificationRecipient[]> {
  if (!familyId) return []
  const [nativeAdmins, assignedAdmins] = await Promise.all([
    getNativeFamilyAdmins(familyId, select),
    getAssignedFamilyAdmins(familyId, 'tickets', select),
  ])
  return dedupeById([...nativeAdmins, ...assignedAdmins])
}

/**
 * Destinatarios de correos/alertas de creación y cierre de tickets:
 * super admins + admins del área (nativa o asignada), menos quienes ya están involucrados.
 */
export async function getTicketOversightAdmins(
  familyId: string | null | undefined,
  options?: {
    select?: RecipientSelect
    excludeUserIds?: Array<string | null | undefined>
    includeSuperAdmins?: boolean
  }
): Promise<NotificationRecipient[]> {
  const select = options?.select ?? { id: true }
  const includeSuperAdmins = options?.includeSuperAdmins !== false

  const [superAdmins, familyAdmins] = await Promise.all([
    includeSuperAdmins ? getSuperAdmins(select) : Promise.resolve([]),
    getTicketFamilyAdmins(familyId, select),
  ])

  return excludeRecipients(dedupeById([...superAdmins, ...familyAdmins]), options?.excludeUserIds)
}

/**
 * Super admins + admin(s) nativo(s) de una familia.
 * Si no hay familyId, solo super admins.
 * Inventario / sistema: no usa áreas asignadas de tickets.
 */
export async function getFamilyScopedAdmins(
  familyId: string | null | undefined,
  select: RecipientSelect = { id: true }
): Promise<NotificationRecipient[]> {
  const superAdmins = await getSuperAdmins(select)

  if (!familyId) {
    return dedupeById(superAdmins)
  }

  const nativeAdmins = await getNativeFamilyAdmins(familyId, select)
  return dedupeById([...superAdmins, ...nativeAdmins])
}

/** Super admins + admins nativos de varias familias (p. ej. cambio de familia). */
export async function getFamilyScopedAdminsForFamilies(
  familyIds: (string | null | undefined)[],
  select: RecipientSelect = { id: true }
): Promise<NotificationRecipient[]> {
  const validIds = [...new Set(familyIds.filter((id): id is string => Boolean(id)))]
  const superAdmins = await getSuperAdmins(select)

  if (validIds.length === 0) {
    return dedupeById(superAdmins)
  }

  const nativeAdmins = await Promise.all(validIds.map(id => getNativeFamilyAdmins(id, select)))
  return dedupeById([...superAdmins, ...nativeAdmins.flat()])
}
