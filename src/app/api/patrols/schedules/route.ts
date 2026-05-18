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
import { checkPatrolFamilyAccess } from '@/lib/patrol/patrol-access'

const createScheduleSchema = z.object({
  familyId: z.string().uuid(),
  routeId: z.string().uuid(),
  agentId: z.string().uuid(),
  scheduledStart: z.string().datetime(),
  scheduledEnd: z.string().datetime(),
  recurrence: z.enum(['NONE', 'DAILY', 'WEEKLY', 'CUSTOM']).default('NONE'),
  recurrenceDays: z.array(z.number().int().min(0).max(6)).default([]),
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

    const where = {
      ...(familyId ? { familyId } : {}),
      ...(agentId ? { agentId } : {}),
      ...(routeId ? { routeId } : {}),
      ...(includeInactive ? {} : { isActive: true }),
    }

    // Admin Normal: filtrar por familias de patrullas asignadas
    if (!familyId && session.user.role === 'ADMIN' && !(session.user as any).isSuperAdmin) {
      const { getPatrolAccessibleFamilyIds } = await import('@/lib/patrol/patrol-access')
      const accessibleFamilyIds = await getPatrolAccessibleFamilyIds(
        session.user.id,
        session.user.role,
        false
      )
      if (accessibleFamilyIds !== undefined && accessibleFamilyIds.length > 0) {
        ;(where as any).familyId = { in: accessibleFamilyIds }
      } else if (accessibleFamilyIds !== undefined && accessibleFamilyIds.length === 0) {
        ;(where as any).familyId = '__NONE__'
      }
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
    const isSuperAdmin = (session.user as any).isSuperAdmin === true

    const hasFamilyAccess = await checkPatrolFamilyAccess(
      session.user.id,
      data.familyId,
      session.user.role,
      isSuperAdmin
    )
    if (!hasFamilyAccess) {
      return NextResponse.json({ error: 'No tienes acceso a esta área' }, { status: 403 })
    }

    // Validar que scheduledEnd > scheduledStart
    if (end <= start) {
      return NextResponse.json(
        { error: 'La hora de fin debe ser posterior a la hora de inicio' },
        { status: 422 }
      )
    }

    // Validar que el agente tiene patrolsEnabled, no es ADMIN y pertenece al área de rondas
    const agent = await prisma.users.findUnique({
      where: { id: data.agentId },
      select: { id: true, name: true, role: true, patrolsEnabled: true },
    })
    if (!agent) return NextResponse.json({ error: 'Agente no encontrado' }, { status: 404 })
    if (agent.role === 'ADMIN') {
      return NextResponse.json(
        { error: 'Los administradores no pueden ser asignados como agentes de ronda' },
        { status: 422 }
      )
    }
    if (!['TECHNICIAN', 'CLIENT'].includes(agent.role)) {
      return NextResponse.json(
        { error: 'Solo técnicos o clientes pueden ser agentes de ronda' },
        { status: 422 }
      )
    }
    if (!agent.patrolsEnabled) {
      return NextResponse.json(
        { error: 'El usuario seleccionado no tiene el módulo de patrullas habilitado' },
        { status: 422 }
      )
    }
    const agentFamilyAssignment = await prisma.patrol_family_assignments.findUnique({
      where: { userId_familyId: { userId: data.agentId, familyId: data.familyId } },
      select: { isActive: true },
    })
    if (!agentFamilyAssignment?.isActive) {
      return NextResponse.json(
        { error: 'El agente no está asignado al área de rondas seleccionada' },
        { status: 422 }
      )
    }

    // Validar que la ruta existe y está activa
    const route = await prisma.patrol_routes.findUnique({
      where: { id: data.routeId },
      select: { id: true, name: true, familyId: true, isActive: true },
    })
    if (!route) return NextResponse.json({ error: 'Ruta no encontrada' }, { status: 404 })
    if (!route.isActive) {
      return NextResponse.json({ error: 'La ruta está desactivada' }, { status: 422 })
    }
    if (route.familyId !== data.familyId) {
      return NextResponse.json(
        { error: 'La ruta no pertenece al área seleccionada' },
        { status: 422 }
      )
    }

    // Verificar solapamiento de patrullas para el mismo agente en el mismo horario
    // Para recurrencias, solo verificamos la primera ocurrencia (el día de inicio)
    const overlap = await prisma.patrols.findFirst({
      where: {
        agentId: data.agentId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        scheduledStart: { lt: end },
        scheduledEnd: { gt: start },
      },
    })
    if (overlap) {
      return NextResponse.json(
        {
          error: 'El agente ya tiene una patrulla programada en ese horario',
          code: 'SCHEDULE_OVERLAP',
        },
        { status: 409 }
      )
    }

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
      },
    })

    // Generar patrullas para el horizonte de 30 días
    const generatedCount = await PatrolSchedulerService.generatePatrols(schedule.id)

    // Notificar al agente
    await NotificationService.push({
      userId: data.agentId,
      type: NotificationType.PATROL_ASSIGNED,
      title: 'Nueva ronda asignada',
      message: `Se te ha asignado la ruta "${route.name}" programada para ${start.toLocaleString('es-EC', { timeZone: 'America/Guayaquil' })}.`,
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
