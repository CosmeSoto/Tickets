/**
 * Validación server-side de tickets con source=PATROL (incidencias de ronda).
 */

import prisma from '@/lib/prisma'

export class PatrolIncidentValidationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 422
  ) {
    super(message)
    this.name = 'PatrolIncidentValidationError'
  }
}

export async function assertValidPatrolIncident(params: {
  userId: string
  checkInId: string
  familyId: string
  patrolId?: string
}): Promise<{ patrolId: string; familyId: string }> {
  const { userId, checkInId, familyId, patrolId } = params

  const checkIn = await prisma.patrol_check_ins.findUnique({
    where: { id: checkInId },
    select: {
      id: true,
      agentId: true,
      patrolId: true,
      patrol: {
        select: {
          id: true,
          familyId: true,
          agentId: true,
          status: true,
        },
      },
    },
  })

  if (!checkIn) {
    throw new PatrolIncidentValidationError('Check-in de patrulla no encontrado', 404)
  }

  if (checkIn.agentId !== userId) {
    throw new PatrolIncidentValidationError(
      'Solo el agente de la ronda puede reportar incidencias en este check-in',
      403
    )
  }

  if (checkIn.patrol.familyId !== familyId) {
    throw new PatrolIncidentValidationError(
      'La familia del incidente no coincide con la ronda',
      422
    )
  }

  if (patrolId && checkIn.patrolId !== patrolId) {
    throw new PatrolIncidentValidationError('El check-in no pertenece a esta patrulla', 422)
  }

  if (checkIn.patrol.status !== 'IN_PROGRESS') {
    throw new PatrolIncidentValidationError(
      'Solo se pueden reportar incidencias durante una ronda en progreso',
      422
    )
  }

  return { patrolId: checkIn.patrolId, familyId: checkIn.patrol.familyId }
}
