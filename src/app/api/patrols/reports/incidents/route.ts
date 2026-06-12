/**
 * GET /api/patrols/reports/incidents — Reporte de incidentes con métricas
 *
 * Query params:
 *   - familyId (optional) — Filtrar por familia (via patrol.familyId)
 *   - dateFrom, dateTo (optional) — Rango de fechas sobre incidents.createdAt
 *   - agentId (optional) — Filtrar por agente
 *
 * Response:
 *   - bySeverity: conteo por severidad
 *   - byStatus: conteo por estado
 *   - resolutionStats: avgResolutionMinutes, escalationRate, totalIncidents
 *   - hotSpots: Top 10 checkpoints con más incidentes
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getPatrolAccessibleFamilyIds } from '@/lib/patrol/patrol-access'

// Acceso al modelo patrol_incidents hasta regenerar el Prisma Client
const db = prisma as any

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate session
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const userRole = session.user.role
    const isSuperAdmin = (session.user as any).isSuperAdmin === true

    // Require ADMIN or TECHNICIAN with patrol family access
    if (userRole !== 'ADMIN' && userRole !== 'TECHNICIAN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // For TECHNICIAN, verify patrol family access
    if (userRole === 'TECHNICIAN') {
      const accessibleFamilyIds = await getPatrolAccessibleFamilyIds(
        session.user.id,
        userRole,
        isSuperAdmin
      )
      if (accessibleFamilyIds !== undefined && accessibleFamilyIds.length === 0) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      }
    }

    // 2. Parse query params
    const { searchParams } = new URL(request.url)
    const familyId = searchParams.get('familyId') ?? undefined
    const dateFrom = searchParams.get('dateFrom') ?? undefined
    const dateTo = searchParams.get('dateTo') ?? undefined
    const agentId = searchParams.get('agentId') ?? undefined

    // Get accessible family IDs for scope
    const accessibleFamilyIds = await getPatrolAccessibleFamilyIds(
      session.user.id,
      userRole,
      isSuperAdmin
    )

    // Validate familyId is within scope if provided
    if (familyId && accessibleFamilyIds !== undefined && !accessibleFamilyIds.includes(familyId)) {
      return NextResponse.json({ error: 'No autorizado para esta familia' }, { status: 403 })
    }

    // 3. Build where clause
    const where: any = {}

    // Date range filter on incidents.createdAt
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = new Date(dateFrom)
      if (dateTo) where.createdAt.lte = new Date(dateTo)
    }

    // Agent filter
    if (agentId) {
      where.agentId = agentId
    }

    // Family filter via patrol relation
    if (familyId) {
      where.patrol = { familyId }
    } else if (accessibleFamilyIds !== undefined) {
      // Restrict to accessible families
      where.patrol = { familyId: { in: accessibleFamilyIds } }
    }

    // 4. Ejecutar consultas en paralelo
    const [
      severityCounts,
      statusCounts,
      totalIncidents,
      escalatedCount,
      resolvedIncidents,
      hotSpotsRaw,
    ] = await Promise.all([
      // a. Conteo agrupado por severidad
      db.patrol_incidents.groupBy({
        by: ['severity'],
        where,
        _count: { id: true },
      }),

      // b. Conteo agrupado por estado
      db.patrol_incidents.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),

      // c. Total de novedades
      db.patrol_incidents.count({ where }),

      // d. Total escaladas a ticket
      db.patrol_incidents.count({
        where: { ...where, status: 'ESCALATED' },
      }),

      // e. Novedades resueltas para calcular tiempo promedio de resolución
      db.patrol_incidents.findMany({
        where: { ...where, status: 'RESOLVED', resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
      }),

      // f. Puntos calientes: top 10 checkpoints con más novedades
      db.patrol_incidents.groupBy({
        by: ['checkpointId'],
        where,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ])

    // 5. Formatear resultados

    // a. Conteo por severidad
    const bySeverity: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 }
    for (const item of severityCounts) {
      bySeverity[item.severity as string] = item._count.id
    }

    // b. Conteo por estado
    const byStatus: Record<string, number> = { OPEN: 0, RESOLVED: 0, ESCALATED: 0 }
    for (const item of statusCounts) {
      byStatus[item.status as string] = item._count.id
    }

    // c. Tiempo promedio de resolución
    let avgResolutionMinutes = 0
    if (resolvedIncidents.length > 0) {
      const totalMinutes = resolvedIncidents.reduce((sum: number, incident: any) => {
        const created = new Date(incident.createdAt).getTime()
        const resolved = new Date(incident.resolvedAt!).getTime()
        return sum + (resolved - created) / (1000 * 60)
      }, 0)
      avgResolutionMinutes = Math.round(totalMinutes / resolvedIncidents.length)
    }

    const escalationRate =
      totalIncidents > 0 ? Math.round((escalatedCount / totalIncidents) * 1000) / 10 : 0

    const resolutionStats = {
      avgResolutionMinutes,
      escalationRate,
      totalIncidents,
    }

    // d. Hot spots — enrich with checkpoint names/locations
    let hotSpots: Array<{
      checkpointId: string
      checkpointName: string
      location: string
      count: number
    }> = []

    if (hotSpotsRaw.length > 0) {
      const checkpointIds = hotSpotsRaw.map((h: any) => h.checkpointId)
      const checkpoints = await prisma.patrol_checkpoints.findMany({
        where: { id: { in: checkpointIds } },
        select: { id: true, name: true, location: true },
      })

      const checkpointMap = new Map(checkpoints.map(c => [c.id, c]))

      hotSpots = hotSpotsRaw.map((h: any) => {
        const cp = checkpointMap.get(h.checkpointId)
        return {
          checkpointId: h.checkpointId,
          checkpointName: cp?.name ?? 'Desconocido',
          location: cp?.location ?? '',
          count: h._count.id,
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        bySeverity,
        byStatus,
        resolutionStats,
        hotSpots,
      },
    })
  } catch (error) {
    console.error('[patrols/reports/incidents] GET:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
