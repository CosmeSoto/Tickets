/**
 * PatrolSchedulerService.autoCloseExpiredPatrols
 *
 * Regresión: esta función reimplementaba en línea el mismo cálculo de cierre
 * que ya vive en computePatrolCloseFromProgress (patrol-finalize.ts, usado por
 * "Finalizar" manual y "Force close"), y divergía en un caso puntual: cuando
 * la ruta no tiene NINGÚN checkpoint obligatorio, la fórmula en línea marcaba
 * la ronda como COMPLETED sin importar si el agente hizo algún check-in o no
 * (missedCheckpointIds siempre es [] cuando no hay requeridos, así que
 * "missedIds.length === 0 ⇒ COMPLETED" quedaba siempre en true). La lógica
 * canónica exige al menos 1 check-in para dar COMPLETED en ese caso.
 *
 * La corrección reusa computePatrolCloseFromProgress/applyPatrolClose en vez
 * de reimplementar la fórmula, eliminando la posibilidad de que vuelvan a
 * desalinearse.
 */

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    patrol_family_config: { findMany: jest.fn() },
    patrols: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    patrol_check_ins: { findMany: jest.fn() },
  },
}))

jest.mock('@/lib/patrol/patrol-helpers', () => ({
  getPatrolSupervisors: jest.fn().mockResolvedValue([]),
}))

jest.mock('@/lib/services/notification-service', () => ({
  NotificationService: { push: jest.fn() },
}))

jest.mock('@/lib/notifications/queue-notification-telegram', () => ({
  queueTelegramNotification: jest.fn().mockResolvedValue(undefined),
}))

import prisma from '@/lib/prisma'
import { PatrolSchedulerService } from '@/lib/services/patrol-scheduler.service'

const PATROL_ID = 'patrol-1'
const FAMILY_ID = 'family-1'

function makeExpiredPatrol() {
  return {
    id: PATROL_ID,
    agentId: 'agent-1',
    familyId: FAMILY_ID,
    scheduledEnd: new Date(Date.now() - 60 * 60 * 1000),
    route: { name: 'Ruta sin obligatorios' },
    agent: { name: 'Agente Test' },
  }
}

describe('PatrolSchedulerService.autoCloseExpiredPatrols — ruta sin checkpoints obligatorios', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.patrol_family_config.findMany as jest.Mock).mockResolvedValue([
      {
        familyId: FAMILY_ID,
        gracePeriodMinutes: 15,
        alertCompletionThreshold: 80,
        autoCompleteWhenAllRequired: true,
        requirePhotoOnEnd: false,
      },
    ])
    // Primera llamada: expiredPatrols. Segunda: completeCandidates (vacía, no aplica aquí).
    ;(prisma.patrols.findMany as jest.Mock)
      .mockResolvedValueOnce([makeExpiredPatrol()])
      .mockResolvedValueOnce([])
    ;(prisma.patrols.update as jest.Mock).mockResolvedValue({})
  })

  it('marca INCOMPLETE (no COMPLETED) si no hubo ningún check-in', async () => {
    // computePatrolCloseFromProgress: la ruta no tiene checkpoints requeridos y no hay check-ins
    ;(prisma.patrols.findUnique as jest.Mock).mockResolvedValue({
      route: { routeCheckpoints: [] },
    })
    ;(prisma.patrol_check_ins.findMany as jest.Mock).mockResolvedValue([])

    const closed = await PatrolSchedulerService.autoCloseExpiredPatrols()

    expect(closed).toBe(1)
    expect(prisma.patrols.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PATROL_ID },
        data: expect.objectContaining({ status: 'INCOMPLETE', completionPercentage: 0 }),
      })
    )
  })

  it('marca COMPLETED si hubo al menos un check-in, aunque ninguno fuera "obligatorio"', async () => {
    ;(prisma.patrols.findUnique as jest.Mock).mockResolvedValue({
      route: { routeCheckpoints: [] },
    })
    ;(prisma.patrol_check_ins.findMany as jest.Mock).mockResolvedValue([
      { checkpointId: 'cp-opcional' },
    ])

    const closed = await PatrolSchedulerService.autoCloseExpiredPatrols()

    expect(closed).toBe(1)
    expect(prisma.patrols.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PATROL_ID },
        data: expect.objectContaining({ status: 'COMPLETED', completionPercentage: 100 }),
      })
    )
  })
})
