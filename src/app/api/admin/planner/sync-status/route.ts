/**
 * GET /api/admin/planner/sync-status
 * Últimos enlaces tarea-interna ↔ tarea-Planner, para diagnóstico en la
 * pantalla de configuración (ver qué está sincronizado / en error).
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { assertCanManagePlanner } from '@/lib/planner/access'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const denied = await assertCanManagePlanner(session.user.id, session.user.role)
  if (denied) return denied

  const links = await prisma.planner_task_links.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 50,
  })

  const taskIds = links.map(l => l.sourceId)
  const tasks = await prisma.resolution_tasks.findMany({
    where: { id: { in: taskIds } },
    select: { id: true, title: true },
  })
  const titleById = new Map(tasks.map(t => [t.id, t.title]))

  return NextResponse.json({
    links: links.map(l => ({
      id: l.id,
      taskId: l.sourceId,
      taskTitle: titleById.get(l.sourceId) ?? '(tarea eliminada)',
      syncStatus: l.syncStatus,
      syncError: l.syncError,
      lastSyncedAt: l.lastSyncedAt,
    })),
    errorCount: links.filter(l => l.syncStatus === 'error').length,
  })
}
