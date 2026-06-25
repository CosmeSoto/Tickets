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
import { checkPatrolModuleAccess } from '@/lib/patrol/patrol-helpers'
import { checkPatrolFamilyAccess } from '@/lib/patrol/patrol-access'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    if (!['ADMIN', 'TECHNICIAN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // ADMIN siempre tiene acceso al dashboard. TECHNICIAN necesita patrolsEnabled.
    const denied = await checkPatrolModuleAccess(session.user.id, session.user.role)
    if (denied) return denied

    const { searchParams } = new URL(request.url)
    const familyIdParam = searchParams.get('familyId')

    // Determinar familias accesibles para el usuario
    const { getPatrolAccessibleFamilyIds } = await import('@/lib/patrol/patrol-access')
    const isSuperAdmin = (session.user as any).isSuperAdmin === true
    const accessibleFamilyIds = await getPatrolAccessibleFamilyIds(
      session.user.id,
      session.user.role,
      isSuperAdmin
    )

    // Si se pasa familyId explícito, usarlo (validando que tenga acceso)
    // Si no, usar todas las familias accesibles del usuario
    let familyFilter: Record<string, any> = {}
    if (familyIdParam) {
      const hasAccess = await checkPatrolFamilyAccess(
        session.user.id,
        familyIdParam,
        session.user.role,
        isSuperAdmin
      )
      if (!hasAccess) {
        return NextResponse.json({ error: 'No tienes acceso a esta área' }, { status: 403 })
      }
      familyFilter = { familyId: familyIdParam }
    } else if (accessibleFamilyIds !== undefined && accessibleFamilyIds.length > 0) {
      familyFilter = { familyId: { in: accessibleFamilyIds } }
    }
    // Si accessibleFamilyIds es undefined (super admin) o no se pasa filtro, no filtrar

    const cacheKey = buildCacheKey('patrol:dashboard', {
      userId: session.user.id,
      familyId: familyIdParam ?? accessibleFamilyIds?.join(',') ?? 'all',
    })

    const data = await withCache(cacheKey, 30, async () => {
      // Usar timezone de Ecuador para calcular "hoy" correctamente
      const now = new Date()
      const ecuadorOffset = -5 * 60 // UTC-5 en minutos
      const localNow = new Date(now.getTime() + ecuadorOffset * 60 * 1000)
      const todayStart = new Date(
        Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate()) -
          ecuadorOffset * 60 * 1000
      )
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
      const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

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
      const [openIncidents, inProgressIncidents, recentIncidents, recentPatrols] = await Promise.all([
        prisma.tickets.count({
          where: { source: 'PATROL', status: 'OPEN', ...familyFilter },
        }),
        prisma.tickets.count({
          where: { source: 'PATROL', status: 'IN_PROGRESS', ...familyFilter },
        }),
        prisma.tickets.findMany({
          where: { source: 'PATROL', status: { in: ['OPEN', 'IN_PROGRESS'] }, ...familyFilter },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            createdAt: true,
            ticketCode: true,
            users_tickets_clientIdTousers: { select: { name: true } },
            family: { select: { name: true, color: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        // Patrullas recientes (completadas/incompletas) para tabla del dashboard
        prisma.patrols.findMany({
          where: {
            ...familyFilter,
            status: { in: ['COMPLETED', 'INCOMPLETE', 'MISSED'] },
            scheduledStart: { gte: last7Days },
          },
          select: {
            id: true,
            status: true,
            scheduledStart: true,
            startedAt: true,
            completedAt: true,
            completionPercentage: true,
            agent: { select: { name: true } },
            route: { select: { name: true } },
            family: { select: { name: true } },
          },
          orderBy: { scheduledStart: 'desc' },
          take: 10,
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
        recentIncidents: recentIncidents.map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          createdAt: t.createdAt,
          ticketCode: t.ticketCode,
          reportedBy: t.users_tickets_clientIdTousers.name,
          family: t.family?.name ?? null,
        })),
        recentPatrols: recentPatrols.map(p => ({
          id: p.id,
          status: p.status,
          routeName: p.route.name,
          agentName: p.agent.name,
          familyName: p.family.name,
          scheduledStart: p.scheduledStart,
          startedAt: p.startedAt,
          completedAt: p.completedAt,
          completionPercentage: p.completionPercentage,
        })),
      }
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[patrol/dashboard] GET:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
