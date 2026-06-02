/**
 * Validaciones compartidas para crear/editar programaciones de rondas.
 */

import prisma from '@/lib/prisma'
import { checkPatrolFamilyAccess } from '@/lib/patrol/patrol-access'
import { PatrolSchedulerService } from '@/lib/services/patrol-scheduler.service'

export interface ScheduleSlot {
  agentId: string
  scheduledStart: Date
  scheduledEnd: Date
  recurrence: 'NONE' | 'DAILY' | 'WEEKLY' | 'CUSTOM'
  recurrenceDays: number[]
}

export async function assertScheduleAgent(params: {
  agentId: string
  familyId: string
}): Promise<void> {
  const agent = await prisma.users.findUnique({
    where: { id: params.agentId },
    select: { id: true, role: true, patrolsEnabled: true, isActive: true },
  })

  if (!agent || !agent.isActive) {
    throw new ScheduleValidationError('Agente no encontrado', 404)
  }
  if (agent.role === 'ADMIN') {
    throw new ScheduleValidationError(
      'Los administradores no pueden ser asignados como agentes de ronda',
      422
    )
  }
  if (!['TECHNICIAN', 'CLIENT'].includes(agent.role)) {
    throw new ScheduleValidationError(
      'El agente debe ser técnico o cliente con rondas habilitadas',
      422
    )
  }
  if (!agent.patrolsEnabled) {
    throw new ScheduleValidationError(
      'El usuario seleccionado no tiene el módulo de patrullas habilitado',
      422
    )
  }

  const assignment = await prisma.patrol_family_assignments.findFirst({
    where: {
      userId: params.agentId,
      familyId: params.familyId,
      isActive: true,
    },
  })

  // Fallback: asignación nativa por departamento
  // (mismo criterio que GET /api/users?patrolFamilyId= para evitar asimetría)
  if (!assignment) {
    const nativeMatch = await prisma.users.findFirst({
      where: {
        id: params.agentId,
        departments: { familyId: params.familyId },
      },
      select: { id: true },
    })

    if (!nativeMatch) {
      throw new ScheduleValidationError(
        'El agente no está asignado a esta familia en el módulo de rondas',
        422
      )
    }
  }
}

export async function assertScheduleRoute(params: {
  routeId: string
  familyId: string
}): Promise<void> {
  const route = await prisma.patrol_routes.findUnique({
    where: { id: params.routeId },
    select: { id: true, familyId: true, isActive: true },
  })

  if (!route) {
    throw new ScheduleValidationError('Ruta no encontrada', 404)
  }
  if (!route.isActive) {
    throw new ScheduleValidationError('La ruta está desactivada', 422)
  }
  if (route.familyId !== params.familyId) {
    throw new ScheduleValidationError('La ruta no pertenece a la familia seleccionada', 422)
  }
}

export async function assertScheduleFamilyAccess(params: {
  userId: string
  role: string
  isSuperAdmin: boolean
  familyId: string
}): Promise<void> {
  const allowed = await checkPatrolFamilyAccess(
    params.userId,
    params.familyId,
    params.role,
    params.isSuperAdmin
  )
  if (!allowed) {
    throw new ScheduleValidationError('No tienes acceso a esta área para programar rondas', 403)
  }
}

export async function assertNoAgentScheduleOverlap(
  slot: ScheduleSlot,
  options?: { excludeScheduleId?: string }
): Promise<void> {
  const scheduleLike = {
    scheduledStart: slot.scheduledStart,
    scheduledEnd: slot.scheduledEnd,
    recurrence: slot.recurrence,
    recurrenceDays: slot.recurrenceDays,
  }

  const occurrences = PatrolSchedulerService.calculateOccurrencesForOverlap(scheduleLike, 30)

  if (occurrences.length === 0) {
    return
  }

  const windows = occurrences.map(({ start, end }) => ({
    start,
    end,
  }))

  const overlap = await prisma.patrols.findFirst({
    where: {
      agentId: slot.agentId,
      status: { in: ['PENDING', 'IN_PROGRESS'] },
      ...(options?.excludeScheduleId ? { scheduleId: { not: options.excludeScheduleId } } : {}),
      OR: windows.map(w => ({
        scheduledStart: { lt: w.end },
        scheduledEnd: { gt: w.start },
      })),
    },
    select: { id: true, scheduledStart: true },
  })

  if (overlap) {
    throw new ScheduleValidationError(
      'El agente ya tiene una patrulla programada que se solapa con este horario',
      409,
      'SCHEDULE_OVERLAP'
    )
  }
}

export class ScheduleValidationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 422,
    public readonly code?: string
  ) {
    super(message)
    this.name = 'ScheduleValidationError'
  }
}
