/**
 * GET /api/planner/ms-todo/status
 * Estado de la conexión de Microsoft To Do del usuario logueado, para la
 * tarjeta "Vincular Microsoft To Do" en /profile.
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { assertCanViewPlanner } from '@/lib/planner/access'
import { MsTodoGraphService, MS_TODO_PROVIDER } from '@/lib/services/ms-todo-graph-service'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const denied = await assertCanViewPlanner(session.user.id, session.user.role)
  if (denied) return denied

  const account = await prisma.oauth_accounts.findUnique({
    where: { provider_providerId: { provider: MS_TODO_PROVIDER, providerId: session.user.id } },
  })
  if (!account) return NextResponse.json({ connected: false })

  const lastError = await prisma.personal_task_ms_todo_links.findFirst({
    where: { userId: session.user.id, syncStatus: 'error' },
    orderBy: { updatedAt: 'desc' },
    select: { syncError: true, updatedAt: true },
  })

  // account.updatedAt es la última vez que se RENOVÓ el token (puede pasar
  // sin que ninguna tarea se haya sincronizado) — la fecha real de la última
  // sincronización es el lastSyncedAt más reciente entre los enlaces.
  const lastSync = await prisma.personal_task_ms_todo_links.findFirst({
    where: { userId: session.user.id, lastSyncedAt: { not: null } },
    orderBy: { lastSyncedAt: 'desc' },
    select: { lastSyncedAt: true },
  })

  let connectedEmail: string | null = null
  try {
    const accessToken = await MsTodoGraphService.getAccessToken(session.user.id)
    connectedEmail = await MsTodoGraphService.getConnectedAccountEmail(accessToken)
  } catch {
    // No bloquea la respuesta — si el token ya no sirve, igual mostramos
    // "conectado" (hay una fila) y el usuario puede reconectar desde acá.
  }

  return NextResponse.json({
    connected: true,
    connectedEmail,
    lastSyncedAt: lastSync?.lastSyncedAt?.toISOString() ?? null,
    lastSyncError: lastError?.syncError ?? null,
  })
}
