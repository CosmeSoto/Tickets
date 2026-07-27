/**
 * GET  /api/patrols/schedules?familyId=  — Lista schedules
 * POST /api/patrols/schedules             — Crea schedule y genera patrullas
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { PatrolSchedulerService } from '@/lib/services/patrol-scheduler.service'
import { NotificationService } from '@/lib/services/notification-service'
import { AuditServiceComplete } from '@/lib/services/audit-service-complete'
import { NotificationType } from '@prisma/client'
import { randomUUID } from 'crypto'
import { checkPatrolModuleAccess } from '@/lib/patrol/patrol-helpers'
import {
  assertScheduleAgent,
  assertScheduleFamilyAccess,
  assertScheduleRoute,
  assertNoAgentScheduleOverlap,
  ScheduleValidationError,
} from '@/lib/patrol/schedule-validation'
import { resolvePatrolVisibilityFilter } from '@/lib/patrol/patrol-access'
import { getAppTimezone } from '@/lib/utils/date-utils'

const createScheduleSchema = z.object({
  familyId: z.string().uuid(),
  routeId: z.string().uuid(),
  agentId: z.string().uuid(),
  scheduledStart: z.string().datetime(),
  scheduledEnd: z.string().datetime(),
  recurrence: z.enum(['NONE', 'DAILY', 'WEEKLY', 'CUSTOM']).default('NONE'),
  recurrenceDays: z.array(z.number().int().min(0).max(6)).default([]),
  // null = heredar del default de la familia; true/false = sobreescribir solo para este schedule
  overrideTimeValidation: z.boolean().nullable().optional(),
  /**
   * Repetición intra-turno: cada cuántos minutos se repite la ronda dentro del bloque
   * scheduledStart → scheduledEnd. 0 o null = sin repetición (una sola patrulla por ocurrencia).
   * Mínimo: 10 minutos. Máximo: duración total del bloque.
   */
  repeatIntervalMinutes: z.number().int().min(10).max(1440).nullable().optional(),
})

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const familyId = searchParams.get('familyId')
    const agentId = searchParams.get('agentId')
    const routeId = searchParams.get('routeId')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '25')))
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true
    const scope = await resolvePatrolVisibilityFilter(
      session.user.id,
      session.user.role,
      isSuperAdmin,
      familyId
    )
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status })
    }

    const where = {
      ...scope.familyWhere,
      ...(agentId ? { agentId } : {}),
      ...(routeId ? { routeId } : {}),
      ...(includeInactive ? {} : { isActive: true }),
    }

    const [schedules, total] = await Promise.all([
      prisma.patrol_schedules.findMany({
        where,
        select: {
          id: true,
          familyId: true,
          family: { select: { id: true, name: true } },
          routeId: true,
          agentId: true,
          scheduledStart: true,
          scheduledEnd: true,
          recurrence: true,
          recurrenceDays: true,
          isActive: true,
          overrideTimeValidation: true,
          createdAt: true,
          route: { select: { id: true, name: true } },
          agent: { select: { id: true, name: true, email: true } },
        },
        orderBy: { scheduledStart: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.patrol_schedules.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: schedules,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    })
  } catch (error) {
    console.error('[patrol/schedules] GET:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    if (!['ADMIN', 'TECHNICIAN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const denied = await checkPatrolModuleAccess(session.user.id, session.user.role)
    if (denied) return denied

    const body = await request.json()
    const data = createScheduleSchema.parse(body)

    const start = new Date(data.scheduledStart)
    const end = new Date(data.scheduledEnd)
    const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true

    if (end <= start) {
      return NextResponse.json(
        { error: 'La hora de fin debe ser posterior a la hora de inicio' },
        { status: 422 }
      )
    }

    try {
      await assertScheduleFamilyAccess({
        userId: session.user.id,
        role: session.user.role,
        isSuperAdmin,
        familyId: data.familyId,
      })
      await assertScheduleRoute({ routeId: data.routeId, familyId: data.familyId })
      await assertScheduleAgent({ agentId: data.agentId, familyId: data.familyId })
      await assertNoAgentScheduleOverlap({
        agentId: data.agentId,
        scheduledStart: start,
        scheduledEnd: end,
        recurrence: data.recurrence,
        recurrenceDays: data.recurrenceDays,
      })
    } catch (err) {
      if (err instanceof ScheduleValidationError) {
        return NextResponse.json(
          { error: err.message, ...(err.code ? { code: err.code } : {}) },
          { status: err.statusCode }
        )
      }
      throw err
    }

    const route = await prisma.patrol_routes.findUnique({
      where: { id: data.routeId },
      select: { name: true },
    })

    // Crear schedule
    const schedule = await prisma.patrol_schedules.create({
      data: {
        id: randomUUID(),
        familyId: data.familyId,
        routeId: data.routeId,
        agentId: data.agentId,
        scheduledStart: start,
        scheduledEnd: end,
        recurrence: data.recurrence,
        recurrenceDays: data.recurrenceDays,
        overrideTimeValidation: data.overrideTimeValidation ?? null,
      },
    })

    // Generar patrullas para el horizonte de 30 días
    const generatedCount = await PatrolSchedulerService.generatePatrols(
      schedule.id,
      30,
      data.repeatIntervalMinutes ?? null
    )

    // Notificar al agente
    await NotificationService.push({
      userId: data.agentId,
      type: NotificationType.PATROL_ASSIGNED,
      title: 'Nueva ronda asignada',
      message: `Se te ha asignado la ruta "${route?.name ?? 'Ronda'}" programada para ${start.toLocaleString('es-EC', { timeZone: getAppTimezone() })}.`,
      metadata: { scheduleId: schedule.id, routeId: data.routeId, familyId: data.familyId },
    })

    await AuditServiceComplete.log({
      action: 'PATROL_SCHEDULE_CREATED',
      entityType: 'patrol',
      entityId: schedule.id,
      userId: session.user.id,
      newValues: {
        routeId: data.routeId,
        agentId: data.agentId,
        recurrence: data.recurrence,
        recurrenceDays: data.recurrenceDays,
        overrideTimeValidation: data.overrideTimeValidation ?? null,
        generatedPatrols: generatedCount,
      },
      request,
    })

    return NextResponse.json(
      { success: true, data: { id: schedule.id }, generatedPatrols: generatedCount },
      { status: 201 }
    )
  } catch (error) {
    console.error('[patrol/schedules] POST:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
