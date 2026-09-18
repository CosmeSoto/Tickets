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
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { requireAttachmentsSuperAdmin } from '../_auth'

type ActiveProvider = 'local' | 'google-drive' | 'onedrive' | 'sharepoint'

const SETTINGS_KEYS = [
  'attachmentsStorageProvider',
  'attachmentsGoogleDriveEnabled',
  'attachmentsOneDriveEnabled',
  'attachmentsSharePointEnabled',
  'attachmentsGoogleRefreshToken',
  'attachmentsMicrosoftRefreshToken',
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
    // SharePoint todavía no tiene flujo de autorización (fase futura, ver
    // plan) — se expone en el estado para que la UI muestre la tarjeta
    // deshabilitada, no para que se pueda activar como destino real.
    sharePoint: {
      enabled: false,
      available: false,
    },
  }
}

export async function GET() {
  const { errorResponse } = await requireAttachmentsSuperAdmin()
  if (errorResponse) return errorResponse

  const settings = await loadSettings()
  return NextResponse.json(settings)
}

export async function PUT(request: NextRequest) {
  const { errorResponse } = await requireAttachmentsSuperAdmin()
  if (errorResponse) return errorResponse

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const { activeProvider, googleDriveEnabled, oneDriveEnabled } = body as {
    activeProvider?: ActiveProvider
    googleDriveEnabled?: boolean
    oneDriveEnabled?: boolean
  }

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
  }

  if (typeof oneDriveEnabled === 'boolean') {
    await upsert(
      'attachmentsOneDriveEnabled',
      String(oneDriveEnabled),
      'OneDrive habilitado como destino de adjuntos'
    )
  }

  if (activeProvider) {
    if (!['local', 'google-drive', 'onedrive'].includes(activeProvider)) {
      return NextResponse.json(
        { error: 'Destino inválido o todavía no disponible (SharePoint llega en una fase futura)' },
        { status: 400 }
      )
    }

    // No se permite fijar como destino activo un proveedor que no esté
    // habilitado + autorizado — evita dejar la config en un estado que
    // rompería la próxima subida sin que el admin lo haya notado acá mismo.
    if (activeProvider !== 'local') {
      const settingsAfterToggle = await loadSettings()
      const enabled =
        activeProvider === 'google-drive'
          ? typeof googleDriveEnabled === 'boolean'
            ? googleDriveEnabled
            : settingsAfterToggle.googleDrive.enabled
          : typeof oneDriveEnabled === 'boolean'
            ? oneDriveEnabled
            : settingsAfterToggle.oneDrive.enabled
      const authorized =
        activeProvider === 'google-drive'
          ? settingsAfterToggle.googleDrive.authorized
          : settingsAfterToggle.oneDrive.authorized

      if (!enabled || !authorized) {
        return NextResponse.json(
          {
            error:
              'Ese proveedor debe estar habilitado y autorizado antes de fijarlo como destino activo',
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
  }

  const settings = await loadSettings()
  return NextResponse.json(settings)
}
