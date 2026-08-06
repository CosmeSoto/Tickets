/**
 * Cierre de ronda por progreso (check-ins válidos vs checkpoints requeridos).
 * Usado por Finalizar manual, auto-complete al 100%, force-close admin y cron.
 */

import prisma from '@/lib/prisma'
import { calculateCompletionPercentage } from '@/lib/patrol/patrol-completion'

export type PatrolCloseStatus = 'COMPLETED' | 'INCOMPLETE'

export type PatrolProgressCloseResult = {
  status: PatrolCloseStatus
  completionPercentage: number
  missedCheckpointIds: string[]
  visitedRequired: number
  totalRequired: number
}

/**
 * Calcula estado final a partir de check-ins VALID y checkpoints requeridos de la ruta.
 */
export async function computePatrolCloseFromProgress(
  patrolId: string
): Promise<PatrolProgressCloseResult> {
  const patrol = await prisma.patrols.findUnique({
    where: { id: patrolId },
    select: {
      route: {
        select: {
          routeCheckpoints: {
            select: { checkpointId: true, isRequired: true },
          },
        },
      },
    },
  })

  if (!patrol) {
    throw new Error('Patrulla no encontrada')
  }

  const requiredCheckpointIds = patrol.route.routeCheckpoints
    .filter(rc => rc.isRequired)
    .map(rc => rc.checkpointId)

  const validCheckIns = await prisma.patrol_check_ins.findMany({
    where: { patrolId, validationResult: 'VALID' },
    select: { checkpointId: true },
  })
  const visitedIds = new Set(validCheckIns.map(ci => ci.checkpointId))
  const visitedRequired = requiredCheckpointIds.filter(cid => visitedIds.has(cid)).length
  const missedCheckpointIds = requiredCheckpointIds.filter(cid => !visitedIds.has(cid))
  const completionPercentage = calculateCompletionPercentage(
    visitedRequired,
    requiredCheckpointIds.length
  )
  const status: PatrolCloseStatus =
    requiredCheckpointIds.length === 0 || missedCheckpointIds.length === 0
      ? 'COMPLETED'
      : 'INCOMPLETE'

  // Sin checkpoints requeridos: si hay al menos un check-in válido, COMPLETED; si no, INCOMPLETE
  if (requiredCheckpointIds.length === 0) {
    return {
      status: validCheckIns.length > 0 ? 'COMPLETED' : 'INCOMPLETE',
      completionPercentage: validCheckIns.length > 0 ? 100 : 0,
      missedCheckpointIds: [],
      visitedRequired: 0,
      totalRequired: 0,
    }
  }

  return {
    status,
    completionPercentage,
    missedCheckpointIds,
    visitedRequired,
    totalRequired: requiredCheckpointIds.length,
  }
}

/** Persiste el cierre. No valida actor ni foto — el caller decide. */
export async function applyPatrolClose(
  patrolId: string,
  result: PatrolProgressCloseResult,
  extra?: { endPhotoId?: string | null }
): Promise<void> {
  await prisma.patrols.update({
    where: { id: patrolId },
    data: {
      status: result.status,
      completedAt: new Date(),
      completionPercentage: result.completionPercentage,
      missedCheckpointIds: result.missedCheckpointIds,
      ...(extra?.endPhotoId ? { endPhotoId: extra.endPhotoId } : {}),
    },
  })
}

/**
 * True si todos los checkpoints requeridos tienen check-in VALID.
 * Con 0 requeridos, false (no auto-completar vacío).
 */
export function allRequiredCheckpointsVisited(
  requiredCount: number,
  visitedRequired: number
): boolean {
  return requiredCount > 0 && visitedRequired >= requiredCount
}
