/**
 * GET /api/patrols/agenda
 * Instancias de patrulla para agenda/calendario (from/to en ISO).
 * Devuelve eventos ligeros listos para pintar por día.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import type { PatrolStatus } from '@prisma/client'
import { checkPatrolModuleAccess } from '@/lib/patrol/patrol-helpers'
import { checkPatrolFamilyAccess, getPatrolAccessibleFamilyIds } from '@/lib/patrol/patrol-access'
import { DEFAULT_TIMEZONE } from '@/lib/constants'

const MAX_RANGE_DAYS = 62
const MAX_EVENTS = 500

function dayKey(d: Date, timeZone = DEFAULT_TIMEZONE): string {
  return d.toLocaleDateString('en-CA', { timeZone })
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    if (!['ADMIN', 'TECHNICIAN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const denied = await checkPatrolModuleAccess(session.user.id, session.user.role)
    if (denied) return denied

    const { searchParams } = new URL(request.url)
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    const familyIdParam = searchParams.get('familyId')
    const agentIdParam = searchParams.get('agentId')
    const statusParam = searchParams.get('status')

    if (!fromParam || !toParam) {
      return NextResponse.json(
        { error: 'Parámetros from y to (ISO) son requeridos' },
        { status: 400 }
      )
    }

    const from = new Date(fromParam)
    const to = new Date(toParam)
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      return NextResponse.json({ error: 'Rango de fechas inválido' }, { status: 400 })
    }

    const rangeMs = to.getTime() - from.getTime()
    if (rangeMs > MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) {
      return NextResponse.json(
        { error: `El rango máximo es de ${MAX_RANGE_DAYS} días` },
        { status: 400 }
      )
    }

    const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true
    const accessibleFamilyIds = await getPatrolAccessibleFamilyIds(
      session.user.id,
      session.user.role,
      isSuperAdmin
    )

    const where: Record<string, unknown> = {
      scheduledStart: { gte: from, lte: to },
    }

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
      where.familyId = familyIdParam
    } else if (accessibleFamilyIds !== undefined) {
      where.familyId = accessibleFamilyIds.length === 0 ? '__NONE__' : { in: accessibleFamilyIds }
    }

    if (agentIdParam) where.agentId = agentIdParam

    if (statusParam && statusParam !== 'all') {
      const parts = [
        ...new Set(statusParam.split(',').map(s => s.trim().toUpperCase())),
      ] as PatrolStatus[]
      const ok = parts.filter(p =>
        ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'MISSED', 'INCOMPLETE'].includes(p)
      )
      if (ok.length === 1) where.status = ok[0]
      else if (ok.length > 1) where.status = { in: ok }
    }

    const rows = await prisma.patrols.findMany({
      where,
      take: MAX_EVENTS,
      orderBy: { scheduledStart: 'asc' },
      select: {
        id: true,
        status: true,
        scheduledStart: true,
        scheduledEnd: true,
        startedAt: true,
        completedAt: true,
        completionPercentage: true,
        agent: { select: { id: true, name: true } },
        route: { select: { id: true, name: true } },
        family: { select: { id: true, name: true, color: true } },
        scheduleId: true,
      },
    })

    const events = rows.map(p => ({
      id: p.id,
      status: p.status,
      scheduledStart: p.scheduledStart.toISOString(),
      scheduledEnd: p.scheduledEnd.toISOString(),
      startedAt: p.startedAt?.toISOString() ?? null,
      completedAt: p.completedAt?.toISOString() ?? null,
      completionPercentage: p.completionPercentage,
      dayKey: dayKey(p.scheduledStart),
      agent: p.agent,
      route: p.route,
      family: p.family,
      scheduleId: p.scheduleId,
    }))

    // Resumen por día (conteos por estado) para el grid del mes
    const byDay: Record<
      string,
      { total: number; byStatus: Partial<Record<PatrolStatus, number>> }
    > = {}
    for (const e of events) {
      if (!byDay[e.dayKey]) byDay[e.dayKey] = { total: 0, byStatus: {} }
      byDay[e.dayKey].total++
      byDay[e.dayKey].byStatus[e.status as PatrolStatus] =
        (byDay[e.dayKey].byStatus[e.status as PatrolStatus] ?? 0) + 1
    }

    return NextResponse.json({
      success: true,
      data: {
        from: from.toISOString(),
        to: to.toISOString(),
        timezone: DEFAULT_TIMEZONE,
        truncated: rows.length >= MAX_EVENTS,
        events,
        byDay,
      },
    })
  } catch (error) {
    console.error('[patrol/agenda] GET:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
