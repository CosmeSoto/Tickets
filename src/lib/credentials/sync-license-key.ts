/**
 * Sincroniza la «Clave de Licencia» del inventario hacia la bóveda de Credenciales.
 * Fuente de verdad del secreto: credential_entries (si el usuario puede gestionar).
 * Si se sincroniza bien, se limpia software_licenses.key para evitar doble almacén.
 */

import prisma from '@/lib/prisma'
import { EncryptionService } from '@/lib/services/encryption.service'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import {
  assertLicenseLinkAllowed,
  canManageCredentialsVault,
  ensureDefaultAreaVault,
  type CredentialsAccessContext,
} from '@/lib/credentials/access'

export async function syncLicenseKeyToVault(opts: {
  ctx: CredentialsAccessContext
  licenseId: string
  familyId: string
  title: string
  plaintextKey: string
}): Promise<{ synced: boolean; reason?: string; entryId?: string }> {
  const { ctx, licenseId, familyId, title, plaintextKey } = opts
  const secret = plaintextKey.trim()
  if (!secret) return { synced: false, reason: 'empty' }

  if (!(await canManageCredentialsVault(ctx.userId, ctx.role, ctx.isSuperAdmin))) {
    return { synced: false, reason: 'no_manage' }
  }

  const linkCheck = await assertLicenseLinkAllowed(ctx, licenseId, familyId)
  if (!linkCheck.ok) {
    return { synced: false, reason: linkCheck.error }
  }

  const vault = await ensureDefaultAreaVault(familyId)
  const secretEncrypted = EncryptionService.encrypt(secret)

  const existing = await prisma.credential_entries.findFirst({
    where: {
      licenseId,
      isActive: true,
      entryType: 'LICENSE',
      vault: { familyId, kind: 'AREA', isActive: true },
    },
    select: { id: true },
  })

  let entryId: string
  const entryTitle = title.trim() || 'Clave de licencia'
  if (existing) {
    await prisma.credential_entries.update({
      where: { id: existing.id },
      data: {
        title: entryTitle,
        secretEncrypted,
        updatedById: ctx.userId,
      },
    })
    entryId = existing.id
    await AuditServiceComplete.log({
      action: AuditActionsComplete.CREDENTIAL_UPDATED,
      entityType: 'credential_entry',
      entityId: entryId,
      userId: ctx.userId,
      details: { title: entryTitle, source: 'license_key_sync', licenseId },
    }).catch(() => {})
  } else {
    const created = await prisma.credential_entries.create({
      data: {
        vaultId: vault.id,
        title: entryTitle,
        entryType: 'LICENSE',
        licenseId,
        secretEncrypted,
        createdById: ctx.userId,
        updatedById: ctx.userId,
        isActive: true,
      },
      select: { id: true },
    })
    entryId = created.id
    await AuditServiceComplete.log({
      action: AuditActionsComplete.CREDENTIAL_CREATED,
      entityType: 'credential_entry',
      entityId: entryId,
      userId: ctx.userId,
      details: { title: entryTitle, source: 'license_key_sync', licenseId },
    }).catch(() => {})
  }

  // Evitar secreto duplicado en inventario
  await prisma.software_licenses.update({
    where: { id: licenseId },
    data: { key: null },
  })

  return { synced: true, entryId }
}
