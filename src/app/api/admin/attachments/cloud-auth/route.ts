/**
 * GET  /api/admin/attachments/cloud-auth?provider=google-drive|onedrive
 *   → Devuelve la URL de autorización OAuth para que el admin autorice el acceso
 *
 * DELETE /api/admin/attachments/cloud-auth?provider=google-drive|onedrive
 *   → Revoca la autorización (elimina el refresh token y desactiva el proveedor)
 *
 * Mismo flujo que `/api/admin/backups/cloud-auth`, con claves de
 * `system_settings` propias (`attachments*`) — independiente de backups.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getOAuthCredentials } from '@/lib/oauth-config'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { requireAttachmentsSuperAdmin } from '../_auth'

const REDIRECT_URI_BASE = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
const REDIRECT_URI = `${REDIRECT_URI_BASE}/api/admin/attachments/cloud-auth/callback`

const TOKEN_KEY_BY_PROVIDER: Record<'google-drive' | 'onedrive', string> = {
  'google-drive': 'attachmentsGoogleRefreshToken',
  onedrive: 'attachmentsMicrosoftRefreshToken',
}

const ENABLED_KEY_BY_PROVIDER: Record<'google-drive' | 'onedrive', string> = {
  'google-drive': 'attachmentsGoogleDriveEnabled',
  onedrive: 'attachmentsOneDriveEnabled',
}

export async function GET(request: NextRequest) {
  const { session, errorResponse } = await requireAttachmentsSuperAdmin()
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

  const existing = await prisma.system_settings.findUnique({
    where: { key: TOKEN_KEY_BY_PROVIDER[provider] },
  })

  if (existing?.value) {
    return NextResponse.json({ authorized: true, oauthConfigured: true, provider })
  }

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

  const creds = await getOAuthCredentials('azure-ad')
  if (!creds) {
    return NextResponse.json({ authorized: false, oauthConfigured: false, authUrl: null, provider })
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

export async function DELETE(request: NextRequest) {
  const { errorResponse } = await requireAttachmentsSuperAdmin()
  if (errorResponse) return errorResponse

  const provider = request.nextUrl.searchParams.get('provider') as
    | 'google-drive'
    | 'onedrive'
    | null
  if (!provider || !['google-drive', 'onedrive'].includes(provider)) {
    return NextResponse.json({ error: 'Proveedor inválido' }, { status: 400 })
  }

  await prisma.system_settings.deleteMany({ where: { key: TOKEN_KEY_BY_PROVIDER[provider] } })

  // Revocar el token también apaga el interruptor — no tiene sentido dejarlo
  // "activado" sin autorización, y evita que quede como destino elegible.
  await prisma.system_settings.upsert({
    where: { key: ENABLED_KEY_BY_PROVIDER[provider] },
    update: { value: 'false', updatedAt: new Date() },
    create: {
      id: randomUUID(),
      key: ENABLED_KEY_BY_PROVIDER[provider],
      value: 'false',
      description: `${provider} habilitado como destino de adjuntos`,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })

  return NextResponse.json({ success: true, message: `Autorización de ${provider} revocada` })
}
