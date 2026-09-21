/**
 * GET /api/admin/planner/cloud-auth/callback
 * Callback OAuth — intercambia el código por tokens y guarda el refresh token
 * de la cuenta de Microsoft 365 dedicada a Planner en system_settings.
 *
 * Calcado de src/app/api/admin/backups/cloud-auth/callback/route.ts, incluida
 * la doble validación de sesión real + `state` (evita que alguien externo
 * complete su propio consentimiento OAuth apuntando a este callback sin
 * autenticarse en la app).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireSuperAdmin } from '@/lib/auth/require-super-admin'
import { getOAuthCredentials } from '@/lib/oauth-config'
import { exchangeMicrosoftCodeForTokens } from '@/lib/oauth/microsoft-authorize'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'

const REDIRECT_URI_BASE = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
const REDIRECT_URI = `${REDIRECT_URI_BASE}/api/admin/planner/cloud-auth/callback`
const SUCCESS_REDIRECT = `${REDIRECT_URI_BASE}/admin/planner/settings?cloud=authorized`
const ERROR_REDIRECT = `${REDIRECT_URI_BASE}/admin/planner/settings?cloud=error`
const REFRESH_TOKEN_KEY = 'plannerMicrosoftRefreshToken'
const PLANNER_SCOPE =
  'https://graph.microsoft.com/Tasks.ReadWrite https://graph.microsoft.com/Group.Read.All offline_access'

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
      '[PLANNER CLOUD AUTH] OAuth error:',
      error,
      request.nextUrl.searchParams.get('error_description')
    )
    return NextResponse.redirect(`${ERROR_REDIRECT}&reason=${encodeURIComponent(error)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${ERROR_REDIRECT}&reason=no_code`)
  }

  const [provider, stateUserId] = state.split(':')
  if (provider !== 'planner' || (stateUserId && stateUserId !== session?.user?.id)) {
    return NextResponse.redirect(`${ERROR_REDIRECT}&reason=state_mismatch`)
  }

  try {
    const creds = await getOAuthCredentials('azure-ad-planner')
    if (!creds) throw new Error('Microsoft OAuth (Planner) no configurado')

    const data = await exchangeMicrosoftCodeForTokens({
      credentials: creds,
      redirectUri: REDIRECT_URI,
      code,
      scope: PLANNER_SCOPE,
    })
    if (!data.refresh_token) {
      throw new Error('Microsoft no devolvió refresh_token para Planner.')
    }

    await prisma.system_settings.upsert({
      where: { key: REFRESH_TOKEN_KEY },
      update: { value: data.refresh_token, updatedAt: new Date() },
      create: {
        id: randomUUID(),
        key: REFRESH_TOKEN_KEY,
        value: data.refresh_token,
        description:
          'Refresh token de Microsoft 365 (cuenta dedicada) para sincronización con Planner',
        updatedAt: new Date(),
      },
    })

    console.log('[PLANNER CLOUD AUTH] Cuenta de Microsoft Planner autorizada correctamente')

    await AuditServiceComplete.log({
      action: AuditActionsComplete.PLANNER_OAUTH_CONNECTED,
      entityType: 'planner_oauth',
      entityId: session!.user!.id,
      userId: session!.user!.id,
    }).catch(() => {})

    return NextResponse.redirect(SUCCESS_REDIRECT)
  } catch (err) {
    console.error('[PLANNER CLOUD AUTH] Token exchange error:', err)
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.redirect(`${ERROR_REDIRECT}&reason=${encodeURIComponent(msg)}`)
  }
}
