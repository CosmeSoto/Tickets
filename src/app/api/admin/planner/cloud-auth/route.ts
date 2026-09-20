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
import { authOptions } from '@/lib/auth'
import { requireSuperAdmin } from '@/lib/auth/require-super-admin'
import { getOAuthCredentials } from '@/lib/oauth-config'
import prisma from '@/lib/prisma'

const REDIRECT_URI_BASE = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
const REDIRECT_URI = `${REDIRECT_URI_BASE}/api/admin/planner/cloud-auth/callback`
const REFRESH_TOKEN_KEY = 'plannerMicrosoftRefreshToken'

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

  const creds = await getOAuthCredentials('azure-ad-planner')
  if (!creds) {
    return NextResponse.json({ authorized: false, oauthConfigured: false, authUrl: null })
  }

  const tenant = creds.tenantId ?? 'common'
  const params = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope:
      'https://graph.microsoft.com/Tasks.ReadWrite https://graph.microsoft.com/Group.Read.All offline_access',
    state: `planner:${session!.user!.id}`,
  })

  return NextResponse.json({
    authorized: false,
    oauthConfigured: true,
    authUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params}`,
  })
}

export async function DELETE() {
  const session = await getServerSession(authOptions)
  const authCheck = await requireSuperAdmin(session)
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status })
  }

  await prisma.system_settings.deleteMany({ where: { key: REFRESH_TOKEN_KEY } })

  return NextResponse.json({ success: true, message: 'Conexión con Microsoft Planner revocada' })
}
