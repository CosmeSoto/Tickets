/**
 * GET /api/planner/oauth-callback
 * Callback OAuth ÚNICO para los dos flujos de Microsoft del módulo Tareas:
 *   - 'admin-planner': el Super Admin conecta la cuenta de servicio
 *     compartida (Planner) — token en system_settings.
 *   - 'user-todo': cualquier usuario conecta su PROPIA cuenta de Microsoft
 *     To Do desde /profile — token en oauth_accounts, una fila por usuario.
 * Ambos usan el mismo App Registration ('azure-ad', ver oauth-config.ts —
 * la misma credencial que login/OneDrive) — `state` (armado en cada ruta de
 * "connect") es lo único que distingue un flujo del otro, así que basta con
 * UN Redirect URI registrado en el portal de Azure en vez de dos.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { randomUUID } from 'crypto'
import { authOptions } from '@/lib/auth'
import { requireSuperAdmin } from '@/lib/auth/require-super-admin'
import { getOAuthCredentials } from '@/lib/oauth-config'
import { exchangeMicrosoftCodeForTokens } from '@/lib/oauth/microsoft-authorize'
import prisma from '@/lib/prisma'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import { MsTodoGraphService, MS_TODO_SCOPE } from '@/lib/services/ms-todo-graph-service'
import { PLANNER_OAUTH_CALLBACK_PATH, PLANNER_OAUTH_NONCE_COOKIE } from '@/lib/planner/oauth-shared'

const REDIRECT_URI_BASE = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
const REDIRECT_URI = `${REDIRECT_URI_BASE}${PLANNER_OAUTH_CALLBACK_PATH}`
const PLANNER_SCOPE =
  'https://graph.microsoft.com/Tasks.ReadWrite https://graph.microsoft.com/Group.Read.All offline_access'
const REFRESH_TOKEN_KEY = 'plannerMicrosoftRefreshToken'

const ADMIN_SUCCESS_REDIRECT = `${REDIRECT_URI_BASE}/admin/planner/settings?cloud=authorized`
const ADMIN_ERROR_REDIRECT = `${REDIRECT_URI_BASE}/admin/planner/settings?cloud=error`
const TODO_SUCCESS_REDIRECT = `${REDIRECT_URI_BASE}/profile?msTodo=authorized`
const TODO_ERROR_REDIRECT = `${REDIRECT_URI_BASE}/profile?msTodo=error`

/** Nonce de un solo uso — se limpia siempre, éxito o error. */
function withClearedNonce(response: NextResponse): NextResponse {
  response.cookies.set(PLANNER_OAUTH_NONCE_COOKIE, '', { maxAge: 0, path: '/api/planner' })
  return response
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state') ?? ''
  const error = request.nextUrl.searchParams.get('error')
  const expectedNonce = request.cookies.get(PLANNER_OAUTH_NONCE_COOKIE)?.value

  const [flow, stateUserId, nonce] = state.split(':')
  // Sin flujo reconocible, no sabemos ni a dónde redirigir el error — se
  // manda al perfil por defecto en vez de asumir el destino admin.
  const errorRedirect = flow === 'admin-planner' ? ADMIN_ERROR_REDIRECT : TODO_ERROR_REDIRECT

  if (!session?.user) {
    return withClearedNonce(NextResponse.redirect(`${errorRedirect}&reason=not_authenticated`))
  }

  if (error) {
    console.error(
      '[PLANNER OAUTH] Error de Microsoft:',
      error,
      request.nextUrl.searchParams.get('error_description')
    )
    return withClearedNonce(
      NextResponse.redirect(`${errorRedirect}&reason=${encodeURIComponent(error)}`)
    )
  }
  if (!code) return withClearedNonce(NextResponse.redirect(`${errorRedirect}&reason=no_code`))

  // Nonce anti-CSRF para ambos flujos: sin esto, `state` solo llevaría el
  // userId (conocido/adivinable) y un callback armado a mano bastaría para
  // enlazar una cuenta de Microsoft ajena a la sesión de la víctima.
  if (stateUserId !== session.user.id || !nonce || !expectedNonce || nonce !== expectedNonce) {
    return withClearedNonce(NextResponse.redirect(`${errorRedirect}&reason=state_mismatch`))
  }

  if (flow === 'admin-planner') {
    const authCheck = await requireSuperAdmin(session)
    if (!authCheck.ok) {
      return withClearedNonce(
        NextResponse.redirect(`${ADMIN_ERROR_REDIRECT}&reason=not_super_admin`)
      )
    }

    try {
      const creds = await getOAuthCredentials('azure-ad')
      if (!creds) throw new Error('Microsoft OAuth no configurado')

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

      console.log('[PLANNER OAUTH] Cuenta de Microsoft Planner autorizada correctamente')
      await AuditServiceComplete.log({
        action: AuditActionsComplete.PLANNER_OAUTH_CONNECTED,
        entityType: 'planner_oauth',
        entityId: session.user.id,
        userId: session.user.id,
      }).catch(() => {})

      return withClearedNonce(NextResponse.redirect(ADMIN_SUCCESS_REDIRECT))
    } catch (err) {
      console.error('[PLANNER OAUTH] Token exchange error (admin-planner):', err)
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      return withClearedNonce(
        NextResponse.redirect(`${ADMIN_ERROR_REDIRECT}&reason=${encodeURIComponent(msg)}`)
      )
    }
  }

  if (flow === 'user-todo') {
    try {
      // Mismo App Registration que login/Planner ('azure-ad') — no una
      // credencial separada, ver oauth-config.ts.
      const creds = await getOAuthCredentials('azure-ad')
      if (!creds) throw new Error('Microsoft OAuth no configurado')

      const data = await exchangeMicrosoftCodeForTokens({
        credentials: creds,
        redirectUri: REDIRECT_URI,
        code,
        scope: MS_TODO_SCOPE,
      })
      if (!data.refresh_token) {
        throw new Error('Microsoft no devolvió refresh_token para To Do.')
      }

      await MsTodoGraphService.saveNewAccount({
        userId: session.user.id,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        scope: data.scope,
        expiresIn: data.expires_in,
      })

      // Si el usuario ya tenía cuenta conectada y vuelve a pasar por acá
      // (token revocado, o conecta una cuenta de Microsoft DISTINTA), los
      // enlaces viejos quedan apuntando a la lista/tareas de la cuenta
      // anterior — no hay forma barata de saber si es la misma cuenta sin
      // una llamada extra a Graph, así que se limpian siempre.
      await prisma.personal_task_ms_todo_links.deleteMany({ where: { userId: session.user.id } })

      console.log(
        '[PLANNER OAUTH] Cuenta de Microsoft To Do conectada para el usuario',
        session.user.id
      )
      return withClearedNonce(NextResponse.redirect(TODO_SUCCESS_REDIRECT))
    } catch (err) {
      console.error('[PLANNER OAUTH] Token exchange error (user-todo):', err)
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      return withClearedNonce(
        NextResponse.redirect(`${TODO_ERROR_REDIRECT}&reason=${encodeURIComponent(msg)}`)
      )
    }
  }

  return withClearedNonce(NextResponse.redirect(`${TODO_ERROR_REDIRECT}&reason=unknown_flow`))
}
