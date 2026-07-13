/**
 * GET  /api/admin/backups/cloud-auth?provider=google-drive|onedrive
 *   → Devuelve la URL de autorización OAuth para que el admin autorice el acceso
 *
 * POST /api/admin/backups/cloud-auth
 *   → Recibe el código de autorización, lo intercambia por tokens y los guarda
 *
 * DELETE /api/admin/backups/cloud-auth?provider=google-drive|onedrive
 *   → Revoca la autorización (elimina el refresh token)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getOAuthCredentials } from '@/lib/oauth-config'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { requireBackupSuperAdmin } from '../_auth'

const REDIRECT_URI_BASE = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
const REDIRECT_URI = `${REDIRECT_URI_BASE}/api/admin/backups/cloud-auth/callback`

// ── GET — generar URL de autorización ────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { session, errorResponse } = await requireBackupSuperAdmin()
  if (errorResponse) return errorResponse
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const provider = request.nextUrl.searchParams.get('provider') as
    | 'google-drive'
    | 'onedrive'
    | null
  if (!provider || !['google-drive', 'onedrive'].includes(provider)) {
    return NextResponse.json({ error: 'Proveedor inválido' }, { status: 400 })
  }

  // Verificar si ya está autorizado
  const tokenKey =
    provider === 'google-drive' ? 'backupGoogleRefreshToken' : 'backupMicrosoftRefreshToken'
  const existing = await prisma.system_settings.findUnique({ where: { key: tokenKey } })

  if (existing?.value) {
    return NextResponse.json({ authorized: true, oauthConfigured: true, provider })
  }

  // Generar URL de autorización (200 siempre para lecturas de estado: evita ruido 400 en consola del navegador)
  if (provider === 'google-drive') {
    const creds = await getOAuthCredentials('google')
    if (!creds) {
      return NextResponse.json({
        authorized: false,
        oauthConfigured: false,
        authUrl: null,
        provider,
      })
    }

    const params = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/drive.file',
      access_type: 'offline',
      prompt: 'consent',
      state: `google-drive:${session.user.id}`,
    })

    return NextResponse.json({
      authorized: false,
      oauthConfigured: true,
      authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
      provider,
    })
  }

  // OneDrive
  const creds = await getOAuthCredentials('azure-ad')
  if (!creds) {
    return NextResponse.json({
      authorized: false,
      oauthConfigured: false,
      authUrl: null,
      provider,
    })
  }

  const tenant = creds.tenantId ?? 'common'
  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'https://graph.microsoft.com/Files.ReadWrite offline_access',
    state: `onedrive:${session.user.id}`,
  })

  return NextResponse.json({
    authorized: false,
    oauthConfigured: true,
    authUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params}`,
    provider,
  })
}

// ── DELETE — revocar autorización ─────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const { errorResponse } = await requireBackupSuperAdmin()
  if (errorResponse) return errorResponse

  const provider = request.nextUrl.searchParams.get('provider') as string
  const tokenKey =
    provider === 'google-drive' ? 'backupGoogleRefreshToken' : 'backupMicrosoftRefreshToken'

  await prisma.system_settings.deleteMany({ where: { key: tokenKey } })

  // También desactivar cloud storage si se revoca
  await prisma.system_settings.upsert({
    where: { key: 'backupCloudStorage' },
    update: { value: 'false', updatedAt: new Date() },
    create: {
      id: randomUUID(),
      key: 'backupCloudStorage',
      value: 'false',
      description: 'Cloud storage habilitado',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })

  return NextResponse.json({ success: true, message: `Autorización de ${provider} revocada` })
}
