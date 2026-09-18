/**
 * GET /api/admin/attachments/cloud-auth/callback
 * Callback OAuth — intercambia el código por tokens y los guarda en system_settings.
 * Redirige al admin de vuelta a Ajustes → Almacenamiento de adjuntos.
 *
 * Mismo endurecimiento que `/api/admin/backups/cloud-auth/callback`: exige
 * sesión real de Super Admin (no solo el `userId` embebido en `state`, que
 * cualquiera puede construir sin autenticarse) y valida que el `state`
 * corresponda a la misma sesión que inició el flujo.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireSuperAdmin } from '@/lib/auth/require-super-admin'
import { getOAuthCredentials } from '@/lib/oauth-config'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'

const REDIRECT_URI_BASE = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
const REDIRECT_URI = `${REDIRECT_URI_BASE}/api/admin/attachments/cloud-auth/callback`
const SUCCESS_REDIRECT = `${REDIRECT_URI_BASE}/admin/settings?tab=storage&cloud=authorized`
const ERROR_REDIRECT = `${REDIRECT_URI_BASE}/admin/settings?tab=storage&cloud=error`

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const authCheck = await requireSuperAdmin(session)
  if (!authCheck.ok) {
    return NextResponse.redirect(`${ERROR_REDIRECT}&reason=not_super_admin`)
  }

  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state') ?? ''
  const error = request.nextUrl.searchParams.get('error')

  if (error) {
    console.error(
      '[ATTACHMENTS CLOUD AUTH] OAuth error:',
      error,
      request.nextUrl.searchParams.get('error_description')
    )
    return NextResponse.redirect(`${ERROR_REDIRECT}&reason=${encodeURIComponent(error)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${ERROR_REDIRECT}&reason=no_code`)
  }

  const [provider, stateUserId] = state.split(':')
  if (stateUserId && stateUserId !== session?.user?.id) {
    return NextResponse.redirect(`${ERROR_REDIRECT}&reason=state_mismatch`)
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
    console.error('[ATTACHMENTS CLOUD AUTH] Token exchange error:', err)
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

  await prisma.system_settings.upsert({
    where: { key: 'attachmentsGoogleRefreshToken' },
    update: { value: data.refresh_token, updatedAt: new Date() },
    create: {
      id: randomUUID(),
      key: 'attachmentsGoogleRefreshToken',
      value: data.refresh_token,
      description: 'Refresh token de Google Drive para adjuntos',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })

  // Autorizar ya deja el proveedor listo para usarse — el admin lo activa
  // aparte desde Ajustes (interruptor independiente, ver plan).
  console.log('[ATTACHMENTS CLOUD AUTH] Google Drive autorizado correctamente')
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

  if (!data.refresh_token) {
    throw new Error('Microsoft no devolvió refresh_token.')
  }

  await prisma.system_settings.upsert({
    where: { key: 'attachmentsMicrosoftRefreshToken' },
    update: { value: data.refresh_token, updatedAt: new Date() },
    create: {
      id: randomUUID(),
      key: 'attachmentsMicrosoftRefreshToken',
      value: data.refresh_token,
      description: 'Refresh token de OneDrive para adjuntos',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })

  console.log('[ATTACHMENTS CLOUD AUTH] OneDrive autorizado correctamente')
}
