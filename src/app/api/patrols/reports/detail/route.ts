/**
 * GET /api/patrols/reports/detail
 * Reporte detallado de ejecución de patrullas.
 * Incluye: checkpoint timeline, start delay, duración, incidentSummary.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getPatrolAccessibleFamilyIds } from '@/lib/patrol/patrol-access'
import { checkPatrolModuleAccess } from '@/lib/patrol/patrol-helpers'
import { z } from 'zod'

const querySchema = z.object({
  patrolId: z.string().uuid().optional(),
  familyId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (!['ADMIN', 'TECHNICIAN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const denied = await checkPatrolModuleAccess(session.user.id, session.user.role)
    if (denied) return denied

    const { searchParams } = new URL(request.url)
    const rawParams = Object.fromEntries(searchParams.entries())

    const parsed = querySchema.safeParse(rawParams)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Parámetros inválidos', details: parsed.error.errors },
        { status: 400 }
      )
    }

    const { patrolId, familyId, agentId, dateFrom, dateTo, page, limit } = parsed.data

    // ── Determinar familias accesibles ──────────────────────────────────────────
    const isSuperAdmin = (session.user as any).isSuperAdmin === true
    const accessibleFamilyIds = await getPatrolAccessibleFamilyIds(
      session.user.id,
      session.user.role,
      isSuperAdmin
    )

    // ── Construir filtro ────────────────────────────────────────────────────────
    const where: Record<string, any> = {
      status: { in: ['IN_PROGRESS', 'COMPLETED', 'INCOMPLETE'] },
    }

    if (patrolId) {
      where.id = patrolId
    }

    if (familyId) {
      where.familyId = familyId
    } else if (accessibleFamilyIds !== undefined && accessibleFamilyIds.length > 0) {
      where.familyId = { in: accessibleFamilyIds }
    }

    if (agentId) {
      where.agentId = agentId
    }

    if (dateFrom || dateTo) {
      where.scheduledStart = {}
      if (dateFrom) where.scheduledStart.gte = new Date(dateFrom)
      if (dateTo) where.scheduledStart.lte = new Date(dateTo)
    }

    // ── Paginación ──────────────────────────────────────────────────────────────
    const total = await prisma.patrols.count({ where })
    const totalPages = Math.ceil(total / limit)
    const skip = (page - 1) * limit

    // ── Query principal ─────────────────────────────────────────────────────────
    const patrols = await prisma.patrols.findMany({
      where,
      skip,
      take: limit,
      orderBy: { scheduledStart: 'desc' },
      include: {
        route: {
          select: {
            name: true,
            routeCheckpoints: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                order: true,
                checkpointId: true,
                checkpoint: { select: { name: true } },
              },
            },
          },
        },
        agent: { select: { name: true } },
        checkIns: {
          where: { validationResult: 'VALID' },
          orderBy: { deviceTimestamp: 'asc' },
          select: {
            id: true,
            checkpointId: true,
            deviceTimestamp: true,
          },
        },
        incidents: {
          select: {
            id: true,
            severity: true,
          },
        },
      },
    })

    // ── Obtener gracePeriodMinutes por familia ───────────────────────────────────
    const familyIds = [...new Set(patrols.map(p => p.familyId))]
    const familyConfigs = await prisma.patrol_family_config.findMany({
      where: { familyId: { in: familyIds } },
      select: { familyId: true, gracePeriodMinutes: true },
    })
    const graceMap = new Map(familyConfigs.map(c => [c.familyId, c.gracePeriodMinutes]))

    // ── Procesar cada patrulla ──────────────────────────────────────────────────
    const data = patrols.map(patrol => {
      const routeCheckpoints = patrol.route.routeCheckpoints
      const checkIns = patrol.checkIns
      const gracePeriodMinutes = graceMap.get(patrol.familyId) ?? 5

      // Build a map: checkpointId -> first valid check-in
      const checkInByCheckpoint = new Map<string, { deviceTimestamp: Date }>()
      for (const ci of checkIns) {
        if (!checkInByCheckpoint.has(ci.checkpointId)) {
          checkInByCheckpoint.set(ci.checkpointId, { deviceTimestamp: ci.deviceTimestamp })
        }
      }

      // Checkpoint timeline
      let previousTimestamp: Date | null = null
      const checkpointTimeline = routeCheckpoints.map(rc => {
        const scan = checkInByCheckpoint.get(rc.checkpointId)
        let status: 'ON_TIME' | 'LATE' | 'MISSED' = 'MISSED'
        let scannedAt: string | null = null
        let timeFromPrevious: number | null = null

        if (scan) {
          scannedAt = scan.deviceTimestamp.toISOString()
          status = 'ON_TIME' // Default for scanned checkpoints

          if (previousTimestamp) {
            timeFromPrevious = Math.round(
              (scan.deviceTimestamp.getTime() - previousTimestamp.getTime()) / 60000
            )
          }

          // If scan order doesn't match expected, it's LATE
          if (rc.order > 1 && previousTimestamp && scan.deviceTimestamp < previousTimestamp) {
            status = 'LATE'
          }

          previousTimestamp = scan.deviceTimestamp
        }

        return {
          checkpointName: rc.checkpoint.name,
          order: rc.order,
          scannedAt,
          expectedOrder: rc.order,
          timeFromPrevious,
          status,
        }
      })

      // Start delay
      let startDelayMinutes: number | null = null
      let isOnTime: boolean | null = null
      if (patrol.startedAt) {
        const delayMs = patrol.startedAt.getTime() - patrol.scheduledStart.getTime()
        startDelayMinutes = Math.max(0, Math.round(delayMs / 60000))
        isOnTime = startDelayMinutes <= gracePeriodMinutes
      }

      // Duration
      let durationMinutes: number | null = null
      if (patrol.startedAt && patrol.completedAt) {
        durationMinutes = Math.round(
          (patrol.completedAt.getTime() - patrol.startedAt.getTime()) / 60000
        )
      }

      // Incident summary
      const incidents = patrol.incidents
      const incidentSummary = {
        total: incidents.length,
        bySeverity: {
          LOW: incidents.filter(i => i.severity === 'LOW').length,
          MEDIUM: incidents.filter(i => i.severity === 'MEDIUM').length,
          HIGH: incidents.filter(i => i.severity === 'HIGH').length,
          CRITICAL: incidents.filter(i => i.severity === 'CRITICAL').length,
        },
      }

      return {
        id: patrol.id,
        routeName: patrol.route.name,
        agentName: patrol.agent.name,
        scheduledStart: patrol.scheduledStart.toISOString(),
        startedAt: patrol.startedAt?.toISOString() ?? null,
        completedAt: patrol.completedAt?.toISOString() ?? null,
        startDelayMinutes,
        isOnTime,
        completionPercentage: patrol.completionPercentage,
        durationMinutes,
        checkpointTimeline,
        incidentSummary,
      }
    })

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    })
  } catch (error) {
    console.error('[patrol/reports/detail] GET:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
