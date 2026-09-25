/**
 * GET /api/attachments/personal-drive/connect
 * Arma la URL de autorización de Microsoft para que el usuario logueado
 * conecte SU PROPIO OneDrive como destino de sus adjuntos nuevos (tickets,
 * documentos, equipos, licencias, contratos, noticias, procesos) — mismo
 * patrón que /api/planner/ms-todo/connect, pero para adjuntos en vez de
 * tareas, y gateado por el toggle de admin en Ajustes → Almacenamiento en
 * vez de `assertCanViewPlanner` (no tiene relación con el módulo Tareas).
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { randomUUID } from 'crypto'
import { authOptions } from '@/lib/auth'
import { getOAuthCredentials } from '@/lib/oauth-config'
import { buildMicrosoftAuthorizeUrl } from '@/lib/oauth/microsoft-authorize'
import { CloudStorageService } from '@/lib/services/cloud-storage-service'
import { PERSONAL_DRIVE_SCOPE } from '@/lib/services/personal-drive-graph-service'
import {
  PERSONAL_DRIVE_OAUTH_CALLBACK_PATH,
  PERSONAL_DRIVE_OAUTH_NONCE_COOKIE,
} from '@/lib/attachments/oauth-shared'

const REDIRECT_URI_BASE = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
const REDIRECT_URI = `${REDIRECT_URI_BASE}${PERSONAL_DRIVE_OAUTH_CALLBACK_PATH}`

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const enabled = await CloudStorageService.isPersonalDriveEnabled()
  if (!enabled) {
    return NextResponse.json({ enabled: false, oauthConfigured: false, authUrl: null })
  }

  // Mismo App Registration que login/Planner/To Do ('azure-ad') — ver el
  // comentario de OAuthProviderKey en oauth-config.ts. No hace falta
  // configurar una segunda credencial.
  const creds = await getOAuthCredentials('azure-ad')
  if (!creds) {
    return NextResponse.json({ enabled: true, oauthConfigured: false, authUrl: null })
  }

  // Nonce anti-CSRF: sin esto, `state` solo llevaría el userId (conocido/
  // adivinable) y un callback armado a mano bastaría para enlazar un Drive
  // ajeno a la sesión de otra persona.
  const nonce = randomUUID()
  const response = NextResponse.json({
    enabled: true,
    oauthConfigured: true,
    authUrl: buildMicrosoftAuthorizeUrl({
      credentials: creds,
      redirectUri: REDIRECT_URI,
      scope: PERSONAL_DRIVE_SCOPE,
      state: `personal-drive:${session.user.id}:${nonce}`,
    }),
  })
  response.cookies.set(PERSONAL_DRIVE_OAUTH_NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/api/attachments/personal-drive',
  })
  return response
}
