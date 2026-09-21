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
import { MsTodoGraphService, MS_TODO_SCOPE } from '@/lib/services/ms-todo-graph-service'

const REDIRECT_URI_BASE = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
const REDIRECT_URI = `${REDIRECT_URI_BASE}/api/planner/ms-todo/callback`
const SUCCESS_REDIRECT = `${REDIRECT_URI_BASE}/profile?msTodo=authorized`
const ERROR_REDIRECT = `${REDIRECT_URI_BASE}/profile?msTodo=error`

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.redirect(`${ERROR_REDIRECT}&reason=not_authenticated`)

  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state') ?? ''
  const error = request.nextUrl.searchParams.get('error')

  if (error) {
    console.error(
      '[MS TODO OAUTH] Error:',
      error,
      request.nextUrl.searchParams.get('error_description')
    )
    return NextResponse.redirect(`${ERROR_REDIRECT}&reason=${encodeURIComponent(error)}`)
  }
  if (!code) return NextResponse.redirect(`${ERROR_REDIRECT}&reason=no_code`)

  const [provider, stateUserId] = state.split(':')
  if (provider !== 'todo' || stateUserId !== session.user.id) {
    return NextResponse.redirect(`${ERROR_REDIRECT}&reason=state_mismatch`)
  }

  try {
    const creds = await getOAuthCredentials('azure-ad-todo')
    if (!creds) throw new Error('Microsoft OAuth (To Do) no configurado')

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
    return NextResponse.redirect(SUCCESS_REDIRECT)
  } catch (err) {
    console.error('[MS TODO OAUTH] Token exchange error:', err)
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.redirect(`${ERROR_REDIRECT}&reason=${encodeURIComponent(msg)}`)
  }
}
