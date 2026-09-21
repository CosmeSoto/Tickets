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
import { authOptions } from '@/lib/auth'
import { getOAuthCredentials } from '@/lib/oauth-config'
import { buildMicrosoftAuthorizeUrl } from '@/lib/oauth/microsoft-authorize'
import { assertCanViewPlanner } from '@/lib/planner/access'
import { MS_TODO_SCOPE } from '@/lib/services/ms-todo-graph-service'

const REDIRECT_URI_BASE = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
const REDIRECT_URI = `${REDIRECT_URI_BASE}/api/planner/ms-todo/callback`

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const denied = await assertCanViewPlanner(session.user.id, session.user.role)
  if (denied) return denied

  const creds = await getOAuthCredentials('azure-ad-todo')
  if (!creds) {
    return NextResponse.json({ oauthConfigured: false, authUrl: null })
  }

  return NextResponse.json({
    oauthConfigured: true,
    authUrl: buildMicrosoftAuthorizeUrl({
      credentials: creds,
      redirectUri: REDIRECT_URI,
      scope: MS_TODO_SCOPE,
      state: `todo:${session.user.id}`,
    }),
  })
}
