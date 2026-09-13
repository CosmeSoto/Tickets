/**
 * POST /api/patrols/[id]/check-in/sync
 *
 * Regresión 1: a diferencia del check-in en vivo, este endpoint no validaba
 * que la ronda siguiera IN_PROGRESS antes de aceptar check-ins offline. Un lote
 * encolado antes de que la ronda se cerrara (cancelada, auto-cerrada por el
 * cron al vencer el horario, o ya finalizada) podía crear check-ins nuevos y
 * pisar completionPercentage sobre una ronda ya cerrada, dejando el status y
 * missedCheckpointIds desalineados con el % mostrado.
 *
 * Regresión 2: no había protección de idempotencia — un reintento de red tras
 * perder la respuesta (la petición sí se procesó en el servidor) podía crear
 * un segundo check-in VALID para el mismo checkpoint.
 */

import { getServerSession } from 'next-auth'

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    patrols: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    patrol_family_config: { findUnique: jest.fn() },
    patrol_check_ins: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}))

jest.mock('@/lib/patrol/patrol-helpers', () => ({
  getPatrolSupervisors: jest.fn().mockResolvedValue([]),
}))

jest.mock('@/lib/services/audit-service-complete', () => ({
  AuditServiceComplete: { log: jest.fn() },
}))

jest.mock('@/lib/services/notification-service', () => ({
  NotificationService: { push: jest.fn() },
}))

jest.mock('@/lib/services/patrol-qr.service', () => ({
  PatrolQRService: {
    validateStaticToken: jest.fn(),
    validateToken: jest.fn(),
    hashTokenForStorage: jest.fn(() => 'hash'),
  },
}))

jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
  NextRequest: class {},
}))

import prisma from '@/lib/prisma'
import { PatrolQRService } from '@/lib/services/patrol-qr.service'
import { POST } from '@/app/api/patrols/[id]/check-in/sync/route'

const PATROL_ID = 'patrol-1'
const AGENT_ID = 'agent-1'

function makeRequest(checkIns: unknown[]) {
  return { json: async () => ({ checkIns }) } as any
}

function baseCheckIn(overrides: Record<string, unknown> = {}) {
  return {
    checkpointId: '11111111-1111-4111-8111-111111111111',
    qrToken: 'token-abc',
    deviceTimestamp: '2026-01-01T10:00:00.000Z',
    localQueueId: 'q1',
    ...overrides,
  }
}

function makePatrol(status: string) {
  return {
    id: PATROL_ID,
    agentId: AGENT_ID,
    familyId: 'family-1',
    status,
    scheduledStart: new Date('2026-01-01T09:00:00.000Z'),
    scheduledEnd: new Date('2026-01-01T13:00:00.000Z'),
    route: {
      routeCheckpoints: [
        {
          order: 1,
          isRequired: true,
          checkpointId: '11111111-1111-4111-8111-111111111111',
          checkpoint: {
            id: 'cp-1',
            latitude: null,
            longitude: null,
            geofenceRadiusMeters: null,
            qrType: 'STATIC',
            qrSecret: 'secret',
            qrStaticToken: 'token-abc',
            isSensitive: false,
          },
        },
      ],
    },
  }
}

describe('POST check-in/sync', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: AGENT_ID, role: 'TECHNICIAN' },
    })
    ;(prisma.patrol_family_config.findUnique as jest.Mock).mockResolvedValue({
      qrWindowMinutes: 5,
      geofenceRadiusMeters: 50,
      offlineSyncToleranceMinutes: 30,
      autoCompleteWhenAllRequired: true,
      requirePhotoOnEnd: false,
    })
    ;(prisma.patrol_check_ins.create as jest.Mock).mockResolvedValue({ id: 'ci-new' })
    ;(prisma.patrols.update as jest.Mock).mockResolvedValue({})
    ;(PatrolQRService.validateStaticToken as jest.Mock).mockReturnValue(true)
  })

  it('rechaza el lote completo (409) si la ronda ya no está IN_PROGRESS', async () => {
    ;(prisma.patrols.findUnique as jest.Mock).mockResolvedValue(makePatrol('INCOMPLETE'))

    const res = await POST(makeRequest([baseCheckIn()]), {
      params: Promise.resolve({ id: PATROL_ID }),
    })

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('PATROL_NOT_ACTIVE')
    // No debió crear ningún check-in
    expect(prisma.patrol_check_ins.create).not.toHaveBeenCalled()
  })

  it('acepta el lote si la ronda sigue IN_PROGRESS', async () => {
    ;(prisma.patrols.findUnique as jest.Mock).mockResolvedValue(makePatrol('IN_PROGRESS'))
    ;(prisma.patrol_check_ins.findMany as jest.Mock).mockResolvedValue([])

    const res = await POST(makeRequest([baseCheckIn()]), {
      params: Promise.resolve({ id: PATROL_ID }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results).toEqual([{ localQueueId: 'q1', status: 'ACCEPTED', checkInId: 'ci-new' }])
    expect(prisma.patrol_check_ins.create).toHaveBeenCalledTimes(1)
  })

  it('no duplica el check-in si el checkpoint ya tiene uno VALID (reintento tras respuesta perdida)', async () => {
    ;(prisma.patrols.findUnique as jest.Mock).mockResolvedValue(makePatrol('IN_PROGRESS'))
    // Ya existe un check-in VALID para cp-1 (de un intento previo que sí se
    // procesó pero cuya respuesta el cliente nunca recibió)
    ;(prisma.patrol_check_ins.findMany as jest.Mock).mockResolvedValue([
      { id: 'ci-existing', checkpointId: '11111111-1111-4111-8111-111111111111' },
    ])

    const res = await POST(makeRequest([baseCheckIn()]), {
      params: Promise.resolve({ id: PATROL_ID }),
    })

    expect(res.status).toBe(200)
    expect(prisma.patrol_check_ins.create).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body.results[0]).toEqual({
      localQueueId: 'q1',
      status: 'ACCEPTED',
      checkInId: 'ci-existing',
    })
  })
})
