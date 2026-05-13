/**
 * GET /api/patrols/dashboard
 * Dashboard de patrullas: estadísticas del día, patrullas activas, tendencias.
 * Caché Redis 30s para conteos agregados.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { withCache, buildCacheKey } from '@/lib/api-cache'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    if (!['ADMIN', 'TECHNICIAN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // ADMIN siempre tiene acceso al dashboard de patrullas (administra el módulo)
    // TECHNICIAN necesita patrolsEnabled para acceder
    if (session.user.role === 'TECHNICIAN') {
      const user = await prisma.users.findUnique({
        where: { id: session.user.id },
        select: { patrolsEnabled: true },
      })
      if (!user?.patrolsEnabled) {
        return NextResponse.json({ error: 'Módulo de patrullas no habilitado' }, { status: 403 })
      }
    }

    const { searchParams } = new URL(request.url)
    const familyId = searchParams.get('familyId')

    const cacheKey = buildCacheKey('patrol:dashboard', {
      userId: session.user.id,
      familyId: familyId ?? 'all',
    })

    const data = await withCache(cacheKey, 30, async () => {
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
      const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

      const familyFilter = familyId ? { familyId } : {}

      // Conteos del día
      const [scheduled, completed, inProgress, missed] = await Promise.all([
        prisma.patrols.count({
          where: { ...familyFilter, scheduledStart: { gte: todayStart, lt: todayEnd } },
        }),
        prisma.patrols.count({
          where: {
            ...familyFilter,
            status: 'COMPLETED',
            completedAt: { gte: todayStart, lt: todayEnd },
          },
        }),
        prisma.patrols.count({
          where: { ...familyFilter, status: 'IN_PROGRESS' },
        }),
        prisma.patrols.count({
          where: {
            ...familyFilter,
            status: 'MISSED',
            scheduledStart: { gte: todayStart, lt: todayEnd },
          },
        }),
      ])

      // Patrullas activas con progreso
      const activePatrols = await prisma.patrols.findMany({
        where: { ...familyFilter, status: 'IN_PROGRESS' },
        select: {
          id: true,
          startedAt: true,
          completionPercentage: true,
          agent: { select: { id: true, name: true } },
          checkIns: {
            where: { validationResult: 'VALID' },
            select: { checkpointId: true },
          },
          route: {
            select: {
              id: true,
              name: true,
              routeCheckpoints: { select: { checkpointId: true } },
            },
          },
        },
        orderBy: { startedAt: 'asc' },
        take: 20,
      })

      // Últimos 7 días
      const [last7Missed, last7Incomplete, last7Completed] = await Promise.all([
        prisma.patrols.count({
          where: { ...familyFilter, status: 'MISSED', scheduledStart: { gte: last7Days } },
        }),
        prisma.patrols.count({
          where: { ...familyFilter, status: 'INCOMPLETE', completedAt: { gte: last7Days } },
        }),
        prisma.patrols.count({
          where: { ...familyFilter, status: 'COMPLETED', completedAt: { gte: last7Days } },
        }),
      ])

      // Promedio de completitud por ruta (últimos 30 días)
      const routeStats = await prisma.patrols.groupBy({
        by: ['routeId'],
        where: {
          ...familyFilter,
          status: { in: ['COMPLETED', 'INCOMPLETE'] },
          completedAt: { gte: last30Days },
        },
        _avg: { completionPercentage: true },
        _count: { id: true },
      })

      const routeIds = routeStats.map(r => r.routeId)
      const routes = await prisma.patrol_routes.findMany({
        where: { id: { in: routeIds } },
        select: { id: true, name: true },
      })
      const routeMap = new Map(routes.map(r => [r.id, r.name]))

      const avgCompletionByRoute = routeStats.map(r => ({
        routeId: r.routeId,
        routeName: routeMap.get(r.routeId) ?? r.routeId,
        avgCompletion: Math.round(r._avg.completionPercentage ?? 0),
        totalExecutions: r._count.id,
      }))

      // Incidentes abiertos originados en patrullas
      const [openIncidents, inProgressIncidents] = await Promise.all([
        prisma.tickets.count({
          where: { source: 'PATROL', status: 'OPEN', ...(familyId ? { familyId } : {}) },
        }),
        prisma.tickets.count({
          where: { source: 'PATROL', status: 'IN_PROGRESS', ...(familyId ? { familyId } : {}) },
        }),
      ])

      return {
        today: { scheduled, completed, inProgress, missed },
        activePatrols: activePatrols.map(p => ({
          id: p.id,
          agentName: p.agent.name,
          routeName: p.route.name,
          startedAt: p.startedAt,
          completionPercentage: p.completionPercentage,
          visitedCheckpoints: p.checkIns.length,
          totalCheckpoints: p.route.routeCheckpoints.length,
        })),
        last7Days: { missed: last7Missed, incomplete: last7Incomplete, completed: last7Completed },
        last30Days: { avgCompletionByRoute },
        openIncidents: { open: openIncidents, inProgress: inProgressIncidents },
      }
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[patrol/dashboard] GET:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
