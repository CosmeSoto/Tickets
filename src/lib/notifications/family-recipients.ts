/**
 * Destinatarios de notificaciones por familia.
 *
 * Regla de negocio:
 * - Super Admin: recibe eventos de todas las familias.
 * - Admin de familia: solo el admin cuya familia NATIVA (departamento) coincide.
 *   Las familias adicionales en user_family_access son para visibilidad/gestión,
 *   no para recibir notificaciones operativas.
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
 * Super admins + admin(s) nativo(s) de una familia.
 * Si no hay familyId, solo super admins.
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
