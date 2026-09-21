/**
 * GET /api/planner/ms-todo/callback
 * Callback OAuth — intercambia el código por tokens y guarda la cuenta de
 * Microsoft To Do del usuario en oauth_accounts (una fila por usuario, a
 * diferencia del refresh token único y compartido de Planner). Misma doble
 * validación de sesión real + `state` que /api/admin/planner/cloud-auth/callback.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getOAuthCredentials } from '@/lib/oauth-config'
import { exchangeMicrosoftCodeForTokens } from '@/lib/oauth/microsoft-authorize'
import {
  MsTodoGraphService,
  MS_TODO_SCOPE,
  MS_TODO_OAUTH_NONCE_COOKIE,
} from '@/lib/services/ms-todo-graph-service'

const REDIRECT_URI_BASE = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
const REDIRECT_URI = `${REDIRECT_URI_BASE}/api/planner/ms-todo/callback`
const SUCCESS_REDIRECT = `${REDIRECT_URI_BASE}/profile?msTodo=authorized`
const ERROR_REDIRECT = `${REDIRECT_URI_BASE}/profile?msTodo=error`

/** Limpia la cookie del nonce en la respuesta que se devuelva — de un solo
 *  uso, éxito o error, para que no se pueda reintentar con el mismo state. */
function withClearedNonce(response: NextResponse): NextResponse {
  response.cookies.set(MS_TODO_OAUTH_NONCE_COOKIE, '', { maxAge: 0, path: '/api/planner/ms-todo' })
  return response
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user)
    return withClearedNonce(NextResponse.redirect(`${ERROR_REDIRECT}&reason=not_authenticated`))

  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state') ?? ''
  const error = request.nextUrl.searchParams.get('error')
  const expectedNonce = request.cookies.get(MS_TODO_OAUTH_NONCE_COOKIE)?.value

  if (error) {
    console.error(
      '[MS TODO OAUTH] Error:',
      error,
      request.nextUrl.searchParams.get('error_description')
    )
    return withClearedNonce(
      NextResponse.redirect(`${ERROR_REDIRECT}&reason=${encodeURIComponent(error)}`)
    )
  }
  if (!code) return withClearedNonce(NextResponse.redirect(`${ERROR_REDIRECT}&reason=no_code`))

  const [provider, stateUserId, nonce] = state.split(':')
  // El nonce debe existir, coincidir con el emitido en /connect Y llegar tal
  // cual en `state` — sin esto, un callback armado a mano con el userId de
  // otra persona (conocido/adivinable) bastaría para enlazar una cuenta de
  // Microsoft ajena a la sesión de la víctima.
  if (
    provider !== 'todo' ||
    stateUserId !== session.user.id ||
    !nonce ||
    !expectedNonce ||
    nonce !== expectedNonce
  ) {
    return withClearedNonce(NextResponse.redirect(`${ERROR_REDIRECT}&reason=state_mismatch`))
  }

  try {
    // Mismo App Registration que Planner ('azure-ad-planner') — no una
    // credencial separada, ver oauth-config.ts.
    const creds = await getOAuthCredentials('azure-ad-planner')
    if (!creds) throw new Error('Microsoft OAuth (Planner/To Do) no configurado')

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

    console.log('[MS TODO OAUTH] Cuenta conectada para el usuario', session.user.id)
    return withClearedNonce(NextResponse.redirect(SUCCESS_REDIRECT))
  } catch (err) {
    console.error('[MS TODO OAUTH] Token exchange error:', err)
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return withClearedNonce(
      NextResponse.redirect(`${ERROR_REDIRECT}&reason=${encodeURIComponent(msg)}`)
    )
  }
}
