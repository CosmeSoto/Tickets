/**
 * GET /api/patrols — Patrullas paginadas.
 * - AGENT (CLIENT/TECHNICIAN con patrolsEnabled): solo sus patrullas (agentId).
 * - ADMIN / TECHNICIAN supervisor: todas las patrullas de sus familias accesibles.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import type { PatrolStatus } from '@prisma/client'
import { calculateCompletionPercentage } from '@/lib/patrol/patrol-completion'
import { getPatrolAccessibleFamilyIds } from '@/lib/patrol/patrol-access'

const ALL_STATUSES: readonly PatrolStatus[] = [
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'MISSED',
  'INCOMPLETE',
]

function buildStatusWhere(raw: string | null): { status?: PatrolStatus | { in: PatrolStatus[] } } {
  if (!raw || raw === 'all') return {}
  const parts = [...new Set(raw.split(',').map(s => s.trim().toUpperCase()))]
  const ok = parts.filter((p): p is PatrolStatus => (ALL_STATUSES as readonly string[]).includes(p))
  if (ok.length === 0) return {}
  if (ok.length === 1) return { status: ok[0]! }
  return { status: { in: ok } }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const role = session.user.role
    const userId = session.user.id
    const isSuperAdmin = (session.user as any).isSuperAdmin === true
    const patrolsEnabled = (session.user as any).patrolsEnabled

    // Super Admin siempre. Resto (incluido ADMIN de familia): requieren patrolsEnabled.
    if (!isSuperAdmin) {
      const enabled =
        patrolsEnabled === true
          ? true
          : patrolsEnabled === false
            ? false
            : ((
                await prisma.users.findUnique({
                  where: { id: userId },
                  select: { patrolsEnabled: true },
                })
              )?.patrolsEnabled ?? false)

      if (!enabled) {
        return NextResponse.json({ error: 'Módulo de patrullas no habilitado' }, { status: 403 })
      }
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20))
    const statusParam = searchParams.get('status')
    const statusWhere = buildStatusWhere(statusParam)
    const scheduleId = searchParams.get('scheduleId')
    const fromDate = searchParams.get('from')
    const toDate = searchParams.get('to')

    const isActiveFilter =
      statusParam === 'PENDING,IN_PROGRESS' || statusParam === 'IN_PROGRESS,PENDING'
    // Agenda / rangos futuros: orden cronológico ascendente
    const orderBy =
      isActiveFilter || scheduleId || fromDate
        ? { scheduledStart: 'asc' as const }
        : { scheduledStart: 'desc' as const }

    // Construir filtro según rol:
    // - ADMIN: ve todas las patrullas de sus familias (sin filtro de agentId)
    // - TECHNICIAN/CLIENT agente: solo sus propias patrullas
    const where: Record<string, any> = { ...statusWhere }

    if (scheduleId) {
      where.scheduleId = scheduleId
    }
    if (fromDate || toDate) {
      where.scheduledStart = {
        ...(fromDate ? { gte: new Date(fromDate) } : {}),
        ...(toDate ? { lte: new Date(toDate) } : {}),
      }
    }

    if (role === 'ADMIN') {
      const familyIds = await getPatrolAccessibleFamilyIds(userId, role, isSuperAdmin)
      if (familyIds !== undefined && familyIds.length > 0) {
        where.familyId = { in: familyIds }
      }
      // Super admin: sin filtro de familia → ve todo
    } else {
      // Agente (TECHNICIAN/CLIENT): solo sus patrullas asignadas
      where.agentId = userId
    }

    const [total, rows] = await Promise.all([
      prisma.patrols.count({ where }),
      prisma.patrols.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
        select: {
          id: true,
          status: true,
          scheduledStart: true,
          scheduledEnd: true,
          startedAt: true,
          completionPercentage: true,
          route: {
            select: {
              id: true,
              name: true,
              estimatedDurationMinutes: true,
            },
          },
          family: { select: { id: true, name: true, color: true } },
        },
      }),
    ])

    const totalPages = Math.max(1, Math.ceil(total / limit))

    // Solo cargar progreso en tiempo real para patrullas IN_PROGRESS (evita N+1 innecesario)
    const inProgressIds = rows.filter(p => p.status === 'IN_PROGRESS').map(p => p.id)
    const progressMap = new Map<
      string,
      { visitedRequired: number; totalRequired: number; completionPercentage: number }
    >()

    if (inProgressIds.length > 0) {
      const inProgressPatrols = await prisma.patrols.findMany({
        where: { id: { in: inProgressIds } },
        select: {
          id: true,
          route: {
            select: {
              routeCheckpoints: { select: { isRequired: true, checkpointId: true } },
            },
          },
          checkIns: {
            where: { validationResult: 'VALID' },
            select: { checkpointId: true },
          },
        },
      })

      for (const p of inProgressPatrols) {
        const required = p.route.routeCheckpoints.filter(rc => rc.isRequired)
        const visited = new Set(p.checkIns.map(c => c.checkpointId))
        const visitedRequired = required.filter(rc => visited.has(rc.checkpointId)).length
        progressMap.set(p.id, {
          visitedRequired,
          totalRequired: required.length,
          completionPercentage: calculateCompletionPercentage(visitedRequired, required.length),
        })
      }
    }

    const data = rows.map(p => ({
      id: p.id,
      status: p.status,
      scheduledStart: p.scheduledStart.toISOString(),
      scheduledEnd: p.scheduledEnd.toISOString(),
      startedAt: p.startedAt?.toISOString() ?? null,
      completionPercentage: p.completionPercentage,
      route: {
        id: p.route.id,
        name: p.route.name,
        estimatedDurationMinutes: p.route.estimatedDurationMinutes,
      },
      family: p.family,
      ...(progressMap.has(p.id) ? { progress: progressMap.get(p.id) } : {}),
    }))

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    })
  } catch (error) {
    console.error('[patrols] GET list:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
