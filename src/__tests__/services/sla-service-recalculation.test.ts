/**
 * SLAService.assignSLA — idempotencia al recalcular.
 *
 * `assignSLA` se llamaba solo una vez, al crear el ticket. Al permitir que
 * `PUT /api/tickets/[id]` la vuelva a invocar cuando cambia la prioridad
 * (para que el `slaDeadline` no quede desactualizado), se descubrió que el
 * método escribía `ticket_sla_metrics` con un `create` plano — como
 * `ticketId` es `@unique` en esa tabla, la segunda llamada reventaría con un
 * conflicto de unicidad (capturado en un try/catch silencioso, así que el
 * recálculo simplemente nunca se aplicaba). Ahora usa `upsert`.
 */

jest.mock('@/lib/prisma', () => {
  const mockPrisma = {
    tickets: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    sla_policies: {
      findFirst: jest.fn(),
    },
    ticket_sla_metrics: {
      // Deliberadamente SIN `create`: si el código volviera a llamar
      // `.create()` en vez de `.upsert()`, esto revienta con
      // "is not a function" en vez de fallar en silencio.
      upsert: jest.fn().mockResolvedValue({}),
    },
    ticket_family_config: {
      findUnique: jest.fn(),
    },
  }
  return { __esModule: true, default: mockPrisma, prisma: mockPrisma }
})

jest.mock('@/lib/services/webhook-service', () => ({
  WebhookService: { trigger: jest.fn() },
}))
jest.mock('@/lib/services/notification-service', () => ({
  NotificationService: { push: jest.fn(), createNotification: jest.fn() },
}))

import prisma from '@/lib/prisma'
import { SLAService } from '@/lib/services/sla-service'

describe('SLAService.assignSLA — recalculo seguro tras cambio de prioridad', () => {
  const baseTicket = {
    id: 'ticket-1',
    categoryId: 'cat-1',
    priority: 'HIGH',
    familyId: 'fam-1',
    createdAt: new Date('2026-01-01T00:00:00Z'),
  }

  const basePolicy = {
    id: 'policy-1',
    responseTimeHours: 4,
    resolutionTimeHours: 24,
    businessHoursOnly: false,
    businessHoursStart: '09:00:00',
    businessHoursEnd: '18:00:00',
    businessDays: 'MON,TUE,WED,THU,FRI',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.tickets.findUnique as jest.Mock).mockResolvedValue(baseTicket)
    ;(prisma.sla_policies.findFirst as jest.Mock).mockResolvedValueOnce(basePolicy)
  })

  it('primera llamada: usa upsert (no create) para crear las métricas SLA', async () => {
    await SLAService.assignSLA('ticket-1')

    expect(prisma.ticket_sla_metrics.upsert).toHaveBeenCalledTimes(1)
    expect(prisma.ticket_sla_metrics.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ticketId: 'ticket-1' },
        create: expect.objectContaining({ ticketId: 'ticket-1', slaPolicyId: 'policy-1' }),
        update: expect.objectContaining({ slaPolicyId: 'policy-1' }),
      })
    )
    expect(prisma.tickets.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ticket-1' } })
    )
  })

  it('regresión: llamar assignSLA una segunda vez (recalculo tras cambio de prioridad) no revienta y vuelve a actualizar', async () => {
    ;(prisma.sla_policies.findFirst as jest.Mock).mockResolvedValueOnce({
      ...basePolicy,
      id: 'policy-2',
      resolutionTimeHours: 4, // la nueva prioridad (más urgente) trae otra política
    })

    await SLAService.assignSLA('ticket-1')
    await SLAService.assignSLA('ticket-1')

    expect(prisma.ticket_sla_metrics.upsert).toHaveBeenCalledTimes(2)
    // La segunda llamada debe reflejar la nueva política, no la primera
    expect(prisma.ticket_sla_metrics.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        update: expect.objectContaining({ slaPolicyId: 'policy-2' }),
      })
    )
  })
})
