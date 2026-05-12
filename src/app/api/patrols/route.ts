/**
 * GET /api/patrols — Patrullas del guardia autenticado (paginado).
 * Usado por /patrol (Mis Rondas).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import type { PatrolStatus } from '@prisma/client'
import { calculateCompletionPercentage } from '@/lib/patrol/patrol-completion'

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

    const me = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { patrolsEnabled: true },
    })
    if (!me?.patrolsEnabled) {
      return NextResponse.json({ error: 'Módulo de patrullas no habilitado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20))
    const statusWhere = buildStatusWhere(searchParams.get('status'))

    const where = { guardId: session.user.id, ...statusWhere }

    const [total, rows] = await Promise.all([
      prisma.patrols.count({ where }),
      prisma.patrols.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { scheduledStart: 'desc' },
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
              routeCheckpoints: { select: { isRequired: true, checkpointId: true } },
            },
          },
          family: { select: { id: true, name: true, color: true } },
          checkIns: {
            where: { validationResult: 'VALID' },
            select: { checkpointId: true },
          },
        },
      }),
    ])

    const totalPages = Math.max(1, Math.ceil(total / limit))

    const data = rows.map(p => {
      const required = p.route.routeCheckpoints.filter(rc => rc.isRequired)
      const visited = new Set(p.checkIns.map(c => c.checkpointId))
      const visitedRequired = required.filter(rc => visited.has(rc.checkpointId)).length
      const completionPercentage = calculateCompletionPercentage(visitedRequired, required.length)
      const progress =
        p.status === 'IN_PROGRESS'
          ? {
              visitedRequired,
              totalRequired: required.length,
              completionPercentage,
            }
          : undefined

      return {
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
        ...(progress ? { progress } : {}),
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
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    })
  } catch (error) {
    console.error('[patrols] GET list:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
