/**
 * GET /api/patrols/reports/compliance
 * Reporte de cumplimiento por guardia o por ruta.
 * Caché Redis 60s.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { withCache, buildCacheKey } from '@/lib/api-cache'

const querySchema = z.object({
  familyId: z.string().uuid().optional(),
  guardId: z.string().uuid().optional(),
  routeId: z.string().uuid().optional(),
  from: z.string().datetime(),
  to: z.string().datetime(),
  groupBy: z.enum(['guard', 'route']).default('guard'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    if (!['ADMIN', 'TECHNICIAN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

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
    const rawParams = Object.fromEntries(searchParams.entries())

    const parsed = querySchema.safeParse(rawParams)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', details: parsed.error.errors },
        { status: 400 }
      )
    }

    const { familyId, guardId, routeId, from, to, groupBy, page, limit } = parsed.data
    const fromDate = new Date(from)
    const toDate = new Date(to)

    if (toDate <= fromDate) {
      return NextResponse.json(
        { error: 'La fecha de fin debe ser posterior a la de inicio' },
        { status: 400 }
      )
    }

    const cacheKey = buildCacheKey('patrol:compliance', {
      familyId,
      guardId,
      routeId,
      from,
      to,
      groupBy,
      page,
      limit,
    })

    const data = await withCache(cacheKey, 60, async () => {
      const baseWhere = {
        ...(familyId ? { familyId } : {}),
        ...(guardId ? { guardId } : {}),
        ...(routeId ? { routeId } : {}),
        scheduledStart: { gte: fromDate, lte: toDate },
      }

      if (groupBy === 'guard') {
        const stats = await prisma.patrols.groupBy({
          by: ['guardId'],
          where: baseWhere,
          _count: { id: true },
          _avg: { completionPercentage: true },
        })

        const completedStats = await prisma.patrols.groupBy({
          by: ['guardId'],
          where: { ...baseWhere, status: 'COMPLETED' },
          _count: { id: true },
        })
        const missedStats = await prisma.patrols.groupBy({
          by: ['guardId'],
          where: { ...baseWhere, status: 'MISSED' },
          _count: { id: true },
        })
        const incompleteStats = await prisma.patrols.groupBy({
          by: ['guardId'],
          where: { ...baseWhere, status: 'INCOMPLETE' },
          _count: { id: true },
        })

        const guardIds = stats.map(s => s.guardId)
        const guards = await prisma.users.findMany({
          where: { id: { in: guardIds } },
          select: { id: true, name: true },
        })
        const guardMap = new Map(guards.map(g => [g.id, g.name]))

        const completedMap = new Map(completedStats.map(s => [s.guardId, s._count.id]))
        const missedMap = new Map(missedStats.map(s => [s.guardId, s._count.id]))
        const incompleteMap = new Map(incompleteStats.map(s => [s.guardId, s._count.id]))

        const total = stats.length
        const paginated = stats.slice((page - 1) * limit, page * limit)

        return {
          groupBy: 'guard',
          byGuard: paginated.map(s => ({
            guardId: s.guardId,
            guardName: guardMap.get(s.guardId) ?? s.guardId,
            assigned: s._count.id,
            completed: completedMap.get(s.guardId) ?? 0,
            missed: missedMap.get(s.guardId) ?? 0,
            incomplete: incompleteMap.get(s.guardId) ?? 0,
            avgCompletion: Math.round(s._avg.completionPercentage ?? 0),
          })),
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            hasNext: page * limit < total,
            hasPrev: page > 1,
          },
        }
      }

      // groupBy === 'route'
      const stats = await prisma.patrols.groupBy({
        by: ['routeId'],
        where: baseWhere,
        _count: { id: true },
        _avg: { completionPercentage: true },
      })

      const routeIds = stats.map(s => s.routeId)
      const routes = await prisma.patrol_routes.findMany({
        where: { id: { in: routeIds } },
        select: { id: true, name: true },
      })
      const routeMap = new Map(routes.map(r => [r.id, r.name]))

      // Calcular duración promedio
      const durationStats = await prisma.patrols.findMany({
        where: {
          ...baseWhere,
          status: { in: ['COMPLETED', 'INCOMPLETE'] },
          startedAt: { not: null },
          completedAt: { not: null },
        },
        select: { routeId: true, startedAt: true, completedAt: true },
      })

      const durationByRoute = new Map<string, number[]>()
      for (const p of durationStats) {
        if (p.startedAt && p.completedAt) {
          const mins = (p.completedAt.getTime() - p.startedAt.getTime()) / 60000
          const arr = durationByRoute.get(p.routeId) ?? []
          arr.push(mins)
          durationByRoute.set(p.routeId, arr)
        }
      }

      // Checkpoints más perdidos por ruta
      const missedCheckpointData = await prisma.patrols.findMany({
        where: { ...baseWhere, status: 'INCOMPLETE' },
        select: { routeId: true, missedCheckpointIds: true },
      })

      const missedCountByRouteCheckpoint = new Map<string, Map<string, number>>()
      for (const p of missedCheckpointData) {
        const routeMissed = missedCountByRouteCheckpoint.get(p.routeId) ?? new Map<string, number>()
        for (const cid of p.missedCheckpointIds) {
          routeMissed.set(cid, (routeMissed.get(cid) ?? 0) + 1)
        }
        missedCountByRouteCheckpoint.set(p.routeId, routeMissed)
      }

      // Obtener nombres de checkpoints
      const allMissedIds = [...new Set(missedCheckpointData.flatMap(p => p.missedCheckpointIds))]
      const checkpoints = await prisma.patrol_checkpoints.findMany({
        where: { id: { in: allMissedIds } },
        select: { id: true, name: true },
      })
      const checkpointMap = new Map(checkpoints.map(c => [c.id, c.name]))

      const total = stats.length
      const paginated = stats.slice((page - 1) * limit, page * limit)

      return {
        groupBy: 'route',
        byRoute: paginated.map(s => {
          const durations = durationByRoute.get(s.routeId) ?? []
          const avgDuration =
            durations.length > 0
              ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
              : 0

          const routeMissed = missedCountByRouteCheckpoint.get(s.routeId) ?? new Map()
          const mostMissed = [...routeMissed.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([cid, count]) => ({
              checkpointId: cid,
              name: checkpointMap.get(cid) ?? cid,
              missCount: count,
            }))

          return {
            routeId: s.routeId,
            routeName: routeMap.get(s.routeId) ?? s.routeId,
            executions: s._count.id,
            completionRate: Math.round(s._avg.completionPercentage ?? 0),
            avgDurationMinutes: avgDuration,
            mostMissedCheckpoints: mostMissed,
          }
        }),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      }
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[patrol/reports/compliance] GET:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
