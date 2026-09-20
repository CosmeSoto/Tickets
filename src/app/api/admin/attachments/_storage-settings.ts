import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'

export const ACTIVE_PROVIDER_KEY = 'attachmentsStorageProvider'

/**
 * Si el proveedor que se está desactivando/revocando es el destino activo
 * de adjuntos nuevos, lo vuelve a 'local'. Sin esto, `CloudStorageService
 * .getActiveProvider()` empezaría a lanzar en cada subida nueva de
 * cualquier módulo (tickets, documentos, equipos, licencias, contratos,
 * noticias, procesos) hasta que un admin lo notara y lo corrigiera a mano
 * en Ajustes → Almacenamiento — mismo principio "no huérfano" ya aplicado
 * a los toggles de módulo por usuario.
 */
export async function resetActiveProviderIfMatches(
  provider: 'google-drive' | 'onedrive' | 'sharepoint',
  actorUserId: string
): Promise<void> {
  const current = await prisma.system_settings.findUnique({ where: { key: ACTIVE_PROVIDER_KEY } })
  if (current?.value !== provider) return

  await prisma.system_settings.upsert({
    where: { key: ACTIVE_PROVIDER_KEY },
    update: { value: 'local', updatedAt: new Date() },
    create: {
      id: randomUUID(),
      key: ACTIVE_PROVIDER_KEY,
      value: 'local',
      description: 'Destino activo para adjuntos nuevos',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })

  await AuditServiceComplete.log({
    action: AuditActionsComplete.ATTACHMENTS_STORAGE_PROVIDER_CHANGED,
    entityType: 'attachments_storage_settings',
    entityId: ACTIVE_PROVIDER_KEY,
    userId: actorUserId,
    details: { from: provider, to: 'local', reason: 'provider_disabled_or_revoked' },
  }).catch(() => {})
}
