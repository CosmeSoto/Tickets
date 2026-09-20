/**
 * GET    /api/admin/attachments/sharepoint-site
 *   → Sitio de SharePoint configurado actualmente (si lo hay).
 *
 * PUT    /api/admin/attachments/sharepoint-site
 *   → Resuelve una URL de sitio contra Microsoft Graph (requiere que el
 *     permiso Sites.Selected ya haya sido otorgado a la app sobre ese
 *     sitio específico — paso hecho aparte en Microsoft 365, no aquí) y
 *     guarda el resultado. Es el equivalente de "Autorizar acceso" de
 *     Google Drive/OneDrive, pero sin popup: SharePoint usa credenciales
 *     de aplicación, no un usuario que consiente.
 *
 * DELETE /api/admin/attachments/sharepoint-site
 *   → Quita el sitio configurado (no toca las credenciales de aplicación
 *     de Ajustes → OAuth, igual que revocar Google/OneDrive no borra el
 *     resto de la config).
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { requireAttachmentsSuperAdmin } from '../_auth'
import { resetActiveProviderIfMatches } from '../_storage-settings'
import { CloudStorageService } from '@/lib/services/cloud-storage-service'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'

const SITE_URL_KEY = 'attachmentsSharePointSiteUrl'
const DRIVE_ID_KEY = 'attachmentsSharePointDriveId'

async function loadSiteConfig() {
  const rows = await prisma.system_settings.findMany({
    where: { key: { in: [SITE_URL_KEY, DRIVE_ID_KEY] } },
  })
  const map = new Map(rows.map(r => [r.key, r.value]))
  return {
    configured: !!map.get(DRIVE_ID_KEY),
    siteUrl: map.get(SITE_URL_KEY) || null,
  }
}

export async function GET() {
  const { errorResponse } = await requireAttachmentsSuperAdmin()
  if (errorResponse) return errorResponse

  return NextResponse.json(await loadSiteConfig())
}

export async function PUT(request: NextRequest) {
  const { session, errorResponse } = await requireAttachmentsSuperAdmin()
  if (errorResponse) return errorResponse

  const body = await request.json().catch(() => null)
  const siteUrl = typeof body?.siteUrl === 'string' ? body.siteUrl.trim() : ''
  if (!siteUrl) {
    return NextResponse.json({ error: 'La URL del sitio es requerida' }, { status: 400 })
  }

  let resolved: { siteId: string; driveId: string }
  try {
    resolved = await CloudStorageService.resolveSharePointSite(siteUrl)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 400 })
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

  await Promise.all([
    upsert(SITE_URL_KEY, siteUrl, 'URL del sitio de SharePoint para adjuntos'),
    upsert(
      DRIVE_ID_KEY,
      resolved.driveId,
      'Id de la biblioteca de documentos de SharePoint resuelta'
    ),
  ])

  await AuditServiceComplete.log({
    action: AuditActionsComplete.ATTACHMENTS_STORAGE_PROVIDER_CHANGED,
    entityType: 'attachments_storage_settings',
    entityId: SITE_URL_KEY,
    userId: session!.user!.id,
    details: { action: 'sharepoint_site_configured', siteUrl },
  }).catch(() => {})

  return NextResponse.json(await loadSiteConfig())
}

export async function DELETE() {
  const { session, errorResponse } = await requireAttachmentsSuperAdmin()
  if (errorResponse) return errorResponse

  await prisma.system_settings.deleteMany({ where: { key: { in: [SITE_URL_KEY, DRIVE_ID_KEY] } } })

  await resetActiveProviderIfMatches('sharepoint', session!.user!.id)

  await AuditServiceComplete.log({
    action: AuditActionsComplete.ATTACHMENTS_STORAGE_PROVIDER_CHANGED,
    entityType: 'attachments_storage_settings',
    entityId: SITE_URL_KEY,
    userId: session!.user!.id,
    details: { action: 'sharepoint_site_removed' },
  }).catch(() => {})

  return NextResponse.json(await loadSiteConfig())
}
