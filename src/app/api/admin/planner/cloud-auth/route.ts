/**
 * GET  /api/admin/planner/cloud-auth
 *   → Devuelve la URL de autorización OAuth para conectar la cuenta de Microsoft 365 dedicada a Planner
 *
 * DELETE /api/admin/planner/cloud-auth
 *   → Revoca la autorización (elimina el refresh token guardado)
 *
 * Calcado de src/app/api/admin/backups/cloud-auth/route.ts para OneDrive.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { randomUUID } from 'crypto'
import { authOptions } from '@/lib/auth'
import { requireSuperAdmin } from '@/lib/auth/require-super-admin'
import { getOAuthCredentials } from '@/lib/oauth-config'
import { buildMicrosoftAuthorizeUrl } from '@/lib/oauth/microsoft-authorize'
import prisma from '@/lib/prisma'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import { PLANNER_OAUTH_CALLBACK_PATH, PLANNER_OAUTH_NONCE_COOKIE } from '@/lib/planner/oauth-shared'

const REDIRECT_URI_BASE = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
const REDIRECT_URI = `${REDIRECT_URI_BASE}${PLANNER_OAUTH_CALLBACK_PATH}`
const REFRESH_TOKEN_KEY = 'plannerMicrosoftRefreshToken'
const PLANNER_SCOPE =
  'https://graph.microsoft.com/Tasks.ReadWrite https://graph.microsoft.com/Group.Read.All offline_access'

export async function GET() {
  const session = await getServerSession(authOptions)
  const authCheck = await requireSuperAdmin(session)
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
  }

  const existing = await prisma.system_settings.findUnique({ where: { key: REFRESH_TOKEN_KEY } })
  if (existing?.value) {
    return NextResponse.json({ authorized: true, oauthConfigured: true })
  }

  const creds = await getOAuthCredentials('azure-ad')
  if (!creds) {
    return NextResponse.json({ authorized: false, oauthConfigured: false, authUrl: null })
  }

  const nonce = randomUUID()
  const response = NextResponse.json({
    authorized: false,
    oauthConfigured: true,
    authUrl: buildMicrosoftAuthorizeUrl({
      credentials: creds,
      redirectUri: REDIRECT_URI,
      scope: PLANNER_SCOPE,
      state: `admin-planner:${session!.user!.id}:${nonce}`,
    }),
  })
  response.cookies.set(PLANNER_OAUTH_NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/api/planner',
  })
  return response
}

export async function DELETE() {
  const session = await getServerSession(authOptions)
  const authCheck = await requireSuperAdmin(session)
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
  }

  await prisma.system_settings.deleteMany({ where: { key: REFRESH_TOKEN_KEY } })

  await AuditServiceComplete.log({
    action: AuditActionsComplete.PLANNER_OAUTH_REVOKED,
    entityType: 'planner_oauth',
    entityId: session!.user!.id,
    userId: session!.user!.id,
  }).catch(() => {})

  return NextResponse.json({ success: true, message: 'Conexión con Microsoft Planner revocada' })
}
