/**
 * GET /api/attachments/personal-drive/oauth-callback
 * Callback OAuth para que el usuario conecte su Drive personal de adjuntos —
 * ruta y callback propios en vez de sumar un tercer `flow` al callback de
 * Planner/Microsoft To Do (/api/planner/oauth-callback): son dominios
 * distintos (Tareas vs. Adjuntos) y ese callback ya importa código propio de
 * Planner que no debería mezclarse acá. Mismo App Registration ('azure-ad')
 * igual — ver oauth-shared.ts.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getOAuthCredentials } from '@/lib/oauth-config'
import { exchangeMicrosoftCodeForTokens } from '@/lib/oauth/microsoft-authorize'
import { CloudStorageService } from '@/lib/services/cloud-storage-service'
import {
  PersonalDriveGraphService,
  PERSONAL_DRIVE_SCOPE,
} from '@/lib/services/personal-drive-graph-service'
import {
  PERSONAL_DRIVE_OAUTH_CALLBACK_PATH,
  PERSONAL_DRIVE_OAUTH_NONCE_COOKIE,
} from '@/lib/attachments/oauth-shared'

const REDIRECT_URI_BASE = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
const REDIRECT_URI = `${REDIRECT_URI_BASE}${PERSONAL_DRIVE_OAUTH_CALLBACK_PATH}`
const SUCCESS_REDIRECT = `${REDIRECT_URI_BASE}/profile?personalDrive=authorized`
const ERROR_REDIRECT = `${REDIRECT_URI_BASE}/profile?personalDrive=error`

/** Nonce de un solo uso — se limpia siempre, éxito o error. */
function withClearedNonce(response: NextResponse): NextResponse {
  response.cookies.set(PERSONAL_DRIVE_OAUTH_NONCE_COOKIE, '', {
    maxAge: 0,
    path: '/api/attachments/personal-drive',
  })
  return response
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state') ?? ''
  const error = request.nextUrl.searchParams.get('error')
  const expectedNonce = request.cookies.get(PERSONAL_DRIVE_OAUTH_NONCE_COOKIE)?.value

  const [flow, stateUserId, nonce] = state.split(':')

  if (!session?.user) {
    return withClearedNonce(NextResponse.redirect(`${ERROR_REDIRECT}&reason=not_authenticated`))
  }
  if (error) {
    console.error(
      '[PERSONAL DRIVE OAUTH] Error de Microsoft:',
      error,
      request.nextUrl.searchParams.get('error_description')
    )
    return withClearedNonce(
      NextResponse.redirect(`${ERROR_REDIRECT}&reason=${encodeURIComponent(error)}`)
    )
  }
  if (!code) return withClearedNonce(NextResponse.redirect(`${ERROR_REDIRECT}&reason=no_code`))

  if (
    flow !== 'personal-drive' ||
    stateUserId !== session.user.id ||
    !nonce ||
    !expectedNonce ||
    nonce !== expectedNonce
  ) {
    return withClearedNonce(NextResponse.redirect(`${ERROR_REDIRECT}&reason=state_mismatch`))
  }

  // El admin pudo desactivar el toggle entre que el usuario abrió el popup
  // y volvió del consentimiento de Microsoft — se revalida acá, no solo en
  // /connect, para no guardar una cuenta conectada con la función apagada.
  const enabled = await CloudStorageService.isPersonalDriveEnabled()
  if (!enabled) {
    return withClearedNonce(NextResponse.redirect(`${ERROR_REDIRECT}&reason=feature_disabled`))
  }

  try {
    const creds = await getOAuthCredentials('azure-ad')
    if (!creds) throw new Error('Microsoft OAuth no configurado')

    const data = await exchangeMicrosoftCodeForTokens({
      credentials: creds,
      redirectUri: REDIRECT_URI,
      code,
      scope: PERSONAL_DRIVE_SCOPE,
    })
    if (!data.refresh_token) {
      throw new Error('Microsoft no devolvió refresh_token para el Drive personal.')
    }

    await PersonalDriveGraphService.saveNewAccount({
      userId: session.user.id,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      scope: data.scope,
      expiresIn: data.expires_in,
    })

    console.log('[PERSONAL DRIVE OAUTH] Drive personal conectado para el usuario', session.user.id)
    return withClearedNonce(NextResponse.redirect(SUCCESS_REDIRECT))
  } catch (err) {
    console.error('[PERSONAL DRIVE OAUTH] Token exchange error:', err)
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return withClearedNonce(
      NextResponse.redirect(`${ERROR_REDIRECT}&reason=${encodeURIComponent(msg)}`)
    )
  }
}
