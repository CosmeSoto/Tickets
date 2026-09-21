/**
 * GET /api/planner/ms-todo/connect
 * Arma la URL de autorización de Microsoft para que el usuario logueado
 * vincule SU PROPIA cuenta de Microsoft To Do (a diferencia del flujo de
 * Planner en /api/admin/planner/cloud-auth, que es de un solo Super Admin
 * para una cuenta de servicio compartida) — cualquier usuario con acceso al
 * módulo Tareas puede conectar la suya desde /profile.
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { randomUUID } from 'crypto'
import { authOptions } from '@/lib/auth'
import { getOAuthCredentials } from '@/lib/oauth-config'
import { buildMicrosoftAuthorizeUrl } from '@/lib/oauth/microsoft-authorize'
import { assertCanViewPlanner } from '@/lib/planner/access'
import { MS_TODO_SCOPE, MS_TODO_OAUTH_NONCE_COOKIE } from '@/lib/services/ms-todo-graph-service'

const REDIRECT_URI_BASE = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
const REDIRECT_URI = `${REDIRECT_URI_BASE}/api/planner/ms-todo/callback`

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const denied = await assertCanViewPlanner(session.user.id, session.user.role)
  if (denied) return denied

  // Mismo App Registration que la cuenta de servicio de Planner
  // ('azure-ad-planner') — ver el comentario de OAuthProviderKey en
  // oauth-config.ts. No hace falta configurar una segunda credencial.
  const creds = await getOAuthCredentials('azure-ad-planner')
  if (!creds) {
    return NextResponse.json({ oauthConfigured: false, authUrl: null })
  }

  // Nonce anti-CSRF: sin esto, `state` solo llevaría el userId (conocido/
  // adivinable), y alguien podría enlazar SU cuenta de Microsoft a la
  // sesión de otra persona con solo lograr que abra un callback armado a
  // mano con el userId de la víctima. El callback exige que este valor
  // coincida con el que trae `state`.
  const nonce = randomUUID()
  const response = NextResponse.json({
    oauthConfigured: true,
    authUrl: buildMicrosoftAuthorizeUrl({
      credentials: creds,
      redirectUri: REDIRECT_URI,
      scope: MS_TODO_SCOPE,
      state: `todo:${session.user.id}:${nonce}`,
    }),
  })
  response.cookies.set(MS_TODO_OAUTH_NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/api/planner/ms-todo',
  })
  return response
}
