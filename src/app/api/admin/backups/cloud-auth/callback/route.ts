/**
 * GET /api/admin/backups/cloud-auth/callback
 * Callback OAuth — intercambia el código por tokens y los guarda en system_settings.
 * Redirige al admin de vuelta a la página de configuración de backups.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getOAuthCredentials } from '@/lib/oauth-config'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'

const REDIRECT_URI_BASE = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
const REDIRECT_URI = `${REDIRECT_URI_BASE}/api/admin/backups/cloud-auth/callback`
const SUCCESS_REDIRECT = `${REDIRECT_URI_BASE}/admin/backups?tab=config&cloud=authorized`
const ERROR_REDIRECT = `${REDIRECT_URI_BASE}/admin/backups?tab=config&cloud=error`

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state') ?? ''
  const error = request.nextUrl.searchParams.get('error')

  if (error) {
    console.error(
      '[CLOUD AUTH] OAuth error:',
      error,
      request.nextUrl.searchParams.get('error_description')
    )
    return NextResponse.redirect(`${ERROR_REDIRECT}&reason=${encodeURIComponent(error)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${ERROR_REDIRECT}&reason=no_code`)
  }

  // El state tiene formato "provider:userId"
  const [provider, userId] = state.split(':')

  if (userId) {
    const requester = await prisma.users.findUnique({
      where: { id: userId },
      select: { isSuperAdmin: true },
    })
    if (!requester?.isSuperAdmin) {
      return NextResponse.redirect(`${ERROR_REDIRECT}&reason=not_super_admin`)
    }
  }

  try {
    if (provider === 'google-drive') {
      await handleGoogleCallback(code)
    } else if (provider === 'onedrive') {
      await handleMicrosoftCallback(code)
    } else {
      return NextResponse.redirect(`${ERROR_REDIRECT}&reason=invalid_provider`)
    }

    return NextResponse.redirect(SUCCESS_REDIRECT)
  } catch (err) {
    console.error('[CLOUD AUTH] Token exchange error:', err)
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.redirect(`${ERROR_REDIRECT}&reason=${encodeURIComponent(msg)}`)
  }
}

async function handleGoogleCallback(code: string) {
  const creds = await getOAuthCredentials('google')
  if (!creds) throw new Error('Google OAuth no configurado')

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Google token error: ${err.error_description ?? err.error}`)
  }

  const data = await res.json()

  if (!data.refresh_token) {
    throw new Error('Google no devolvió refresh_token. Asegúrate de usar prompt=consent.')
  }

  // Guardar refresh token en system_settings
  await prisma.system_settings.upsert({
    where: { key: 'backupGoogleRefreshToken' },
    update: { value: data.refresh_token, updatedAt: new Date() },
    create: {
      id: randomUUID(),
      key: 'backupGoogleRefreshToken',
      value: data.refresh_token,
      description: 'Refresh token de Google Drive para backups',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })

  console.log('[CLOUD AUTH] Google Drive autorizado correctamente')
}

async function handleMicrosoftCallback(code: string) {
  const creds = await getOAuthCredentials('azure-ad')
  if (!creds) throw new Error('Microsoft OAuth no configurado')

  const tenant = creds.tenantId ?? 'common'

  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
      scope: 'https://graph.microsoft.com/Files.ReadWrite offline_access',
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Microsoft token error: ${err.error_description ?? err.error}`)
  }

  const data = await res.json()

  await prisma.system_settings.upsert({
    where: { key: 'backupMicrosoftRefreshToken' },
    update: { value: data.refresh_token, updatedAt: new Date() },
    create: {
      id: randomUUID(),
      key: 'backupMicrosoftRefreshToken',
      value: data.refresh_token,
      description: 'Refresh token de OneDrive para backups',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })

  console.log('[CLOUD AUTH] OneDrive autorizado correctamente')
}
