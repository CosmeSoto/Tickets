/**
 * GET /api/admin/attachments/storage-settings
 *   → Estado de cada proveedor (habilitado / autorizado) + destino activo.
 *
 * PUT /api/admin/attachments/storage-settings
 *   → Actualiza el destino activo y/o los interruptores por proveedor.
 *
 * Deliberadamente separado del blob genérico de `/api/admin/settings`: ese
 * endpoint hace round-trip de TODO su estado en cada guardado (ver el bug de
 * `allowedFileTypes` corregido en esta misma conversación) — mezclar estas
 * claves ahí repetiría el mismo riesgo de que un guardado no relacionado
 * pise un valor que no debía tocar.
 *
 * SharePoint no tiene un flujo de "autorizar" (popup) como Google/OneDrive
 * — usa credenciales de aplicación configuradas en Ajustes → OAuth
 * ('azure-ad-sharepoint') más un sitio configurado vía
 * `/api/admin/attachments/sharepoint-site`. Por eso su equivalente de
 * "autorizado" acá es `configured` (¿hay un driveId resuelto?), no un
 * refresh token.
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { requireAttachmentsSuperAdmin } from '../_auth'
import { resetActiveProviderIfMatches } from '../_storage-settings'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'

type ActiveProvider = 'local' | 'google-drive' | 'onedrive' | 'sharepoint'
type CloudProvider = Exclude<ActiveProvider, 'local'>

const SETTINGS_KEYS = [
  'attachmentsStorageProvider',
  'attachmentsGoogleDriveEnabled',
  'attachmentsOneDriveEnabled',
  'attachmentsSharePointEnabled',
  'attachmentsGoogleRefreshToken',
  'attachmentsMicrosoftRefreshToken',
  'attachmentsSharePointDriveId',
  'attachmentsSharePointSiteUrl',
] as const

async function loadSettings() {
  const rows = await prisma.system_settings.findMany({ where: { key: { in: [...SETTINGS_KEYS] } } })
  const map = new Map(rows.map(r => [r.key, r.value]))
  return {
    activeProvider: (map.get('attachmentsStorageProvider') as ActiveProvider) || 'local',
    googleDrive: {
      enabled: map.get('attachmentsGoogleDriveEnabled') === 'true',
      authorized: !!map.get('attachmentsGoogleRefreshToken'),
    },
    oneDrive: {
      enabled: map.get('attachmentsOneDriveEnabled') === 'true',
      authorized: !!map.get('attachmentsMicrosoftRefreshToken'),
    },
    sharePoint: {
      enabled: map.get('attachmentsSharePointEnabled') === 'true',
      configured: !!map.get('attachmentsSharePointDriveId'),
      siteUrl: map.get('attachmentsSharePointSiteUrl') || null,
    },
  }
}

export type StorageSettingsSnapshot = Awaited<ReturnType<typeof loadSettings>>

export async function GET() {
  const { errorResponse } = await requireAttachmentsSuperAdmin()
  if (errorResponse) return errorResponse

  const settings = await loadSettings()
  return NextResponse.json(settings)
}

export async function PUT(request: NextRequest) {
  const { session, errorResponse } = await requireAttachmentsSuperAdmin()
  if (errorResponse) return errorResponse

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const { activeProvider, googleDriveEnabled, oneDriveEnabled, sharePointEnabled } = body as {
    activeProvider?: ActiveProvider
    googleDriveEnabled?: boolean
    oneDriveEnabled?: boolean
    sharePointEnabled?: boolean
  }

  const previousActiveProvider = (await loadSettings()).activeProvider

  const upsert = (key: string, value: string, description: string) =>
    prisma.system_settings.upsert({
      where: { key },
      update: { value, updatedAt: new Date() },
      create: {
        id: randomUUID(),
        key,
        value,
        description,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })

  if (typeof googleDriveEnabled === 'boolean') {
    await upsert(
      'attachmentsGoogleDriveEnabled',
      String(googleDriveEnabled),
      'Google Drive habilitado como destino de adjuntos'
    )
    // Si Google Drive era el destino activo, no lo dejamos huérfano: sin
    // esto, toda subida nueva empezaría a fallar hasta que un admin lo
    // notara y lo corrigiera a mano.
    if (!googleDriveEnabled) await resetActiveProviderIfMatches('google-drive', session!.user!.id)
  }

  if (typeof oneDriveEnabled === 'boolean') {
    await upsert(
      'attachmentsOneDriveEnabled',
      String(oneDriveEnabled),
      'OneDrive habilitado como destino de adjuntos'
    )
    if (!oneDriveEnabled) await resetActiveProviderIfMatches('onedrive', session!.user!.id)
  }

  if (typeof sharePointEnabled === 'boolean') {
    await upsert(
      'attachmentsSharePointEnabled',
      String(sharePointEnabled),
      'SharePoint habilitado como destino de adjuntos'
    )
    if (!sharePointEnabled) await resetActiveProviderIfMatches('sharepoint', session!.user!.id)
  }

  if (activeProvider) {
    if (!['local', 'google-drive', 'onedrive', 'sharepoint'].includes(activeProvider)) {
      return NextResponse.json({ error: 'Destino inválido' }, { status: 400 })
    }

    // No se permite fijar como destino activo un proveedor que no esté
    // habilitado + autorizado/configurado — evita dejar la config en un
    // estado que rompería la próxima subida sin que el admin lo haya
    // notado acá mismo.
    if (activeProvider !== 'local') {
      const s = await loadSettings()
      const pendingEnabled: Record<CloudProvider, boolean> = {
        'google-drive':
          typeof googleDriveEnabled === 'boolean' ? googleDriveEnabled : s.googleDrive.enabled,
        onedrive: typeof oneDriveEnabled === 'boolean' ? oneDriveEnabled : s.oneDrive.enabled,
        sharepoint:
          typeof sharePointEnabled === 'boolean' ? sharePointEnabled : s.sharePoint.enabled,
      }
      const ready: Record<CloudProvider, boolean> = {
        'google-drive': s.googleDrive.authorized,
        onedrive: s.oneDrive.authorized,
        sharepoint: s.sharePoint.configured,
      }

      if (!pendingEnabled[activeProvider] || !ready[activeProvider]) {
        return NextResponse.json(
          {
            error:
              activeProvider === 'sharepoint'
                ? 'SharePoint debe estar habilitado y con un sitio configurado antes de fijarlo como destino activo'
                : 'Ese proveedor debe estar habilitado y autorizado antes de fijarlo como destino activo',
          },
          { status: 400 }
        )
      }
    }

    await upsert(
      'attachmentsStorageProvider',
      activeProvider,
      'Destino activo para adjuntos nuevos'
    )

    if (activeProvider !== previousActiveProvider) {
      await AuditServiceComplete.log({
        action: AuditActionsComplete.ATTACHMENTS_STORAGE_PROVIDER_CHANGED,
        entityType: 'attachments_storage_settings',
        entityId: 'attachmentsStorageProvider',
        userId: session!.user!.id,
        details: { from: previousActiveProvider, to: activeProvider },
      }).catch(() => {})
    }
  }

  const settings = await loadSettings()
  return NextResponse.json(settings)
}
