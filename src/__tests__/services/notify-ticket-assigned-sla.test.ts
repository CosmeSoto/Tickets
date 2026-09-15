/**
 * NotificationService.notifyTicketAssigned — incluye el SLA real.
 *
 * La notificación de asignación (in-app + metadata) solo llevaba la
 * prioridad y el nombre del cliente — nunca el `slaDeadline` real que el
 * sistema ya calcula, así que el técnico no tenía forma de saber cuánto
 * tiempo tenía para atender el ticket sin entrar a revisarlo manualmente.
 */

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    tickets: { findUnique: jest.fn() },
    notifications: { create: jest.fn() },
  },
}))

jest.mock('@/lib/notifications/queue-notification-telegram', () => ({
  queueTelegramNotification: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/notifications/delivery', () => ({
  evaluateDelivery: jest.fn().mockResolvedValue({ allowInApp: true, allowWebPush: false }),
}))

jest.mock('@/lib/services/web-push.service', () => ({
  WebPushService: { sendToUser: jest.fn(), isConfigured: jest.fn().mockReturnValue(false) },
}))

jest.mock('@/lib/notification-events', () => ({
  NotificationEvents: {
    emit: jest.fn(),
    isUserConnected: jest.fn().mockResolvedValue(false),
  },
}))

import prisma from '@/lib/prisma'
import { queueTelegramNotification } from '@/lib/notifications/queue-notification-telegram'
import { NotificationService } from '@/lib/services/notification-service'

describe('NotificationService.notifyTicketAssigned — incluye SLA y prioridad solicitada', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.notifications.create as jest.Mock).mockImplementation(({ data }: any) => data)
  })

  it('regresión: el mensaje y la metadata incluyen el tiempo restante de SLA', async () => {
    const slaDeadline = new Date(Date.now() + 90 * 60 * 1000) // 1h30 restante → warning
    ;(prisma.tickets.findUnique as jest.Mock).mockResolvedValue({
      id: 'ticket-1',
      title: 'Fuga de agua',
      priority: 'HIGH',
      requestedPriority: null,
      clientId: 'client-1',
      slaDeadline,
      resolvedAt: null,
      closedAt: null,
      users_tickets_clientIdTousers: { id: 'client-1', name: 'Cliente', email: 'c@test.com' },
      users_tickets_assigneeIdTousers: { id: 'tech-1', name: 'Técnico', email: 't@test.com' },
    })

    await NotificationService.notifyTicketAssigned('ticket-1', 'tech-1')

    expect(prisma.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'tech-1',
          message: expect.stringContaining('SLA: Vence en 1h 30min'),
          metadata: expect.objectContaining({ slaDeadline, priority: 'HIGH' }),
        }),
      })
    )
    expect(queueTelegramNotification).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining('SLA: Vence en 1h 30min') })
    )
  })

  it('cuando el cliente pidió más prioridad de la que quedó, el mensaje lo menciona', async () => {
    ;(prisma.tickets.findUnique as jest.Mock).mockResolvedValue({
      id: 'ticket-1',
      title: 'Cambio de nombre',
      priority: 'MEDIUM',
      requestedPriority: 'URGENT',
      clientId: 'client-1',
      slaDeadline: null,
      resolvedAt: null,
      closedAt: null,
      users_tickets_clientIdTousers: { id: 'client-1', name: 'Cliente', email: 'c@test.com' },
      users_tickets_assigneeIdTousers: { id: 'tech-1', name: 'Técnico', email: 't@test.com' },
    })

    await NotificationService.notifyTicketAssigned('ticket-1', 'tech-1')

    expect(prisma.notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          message: expect.stringContaining('cliente pidió Urgente'),
          metadata: expect.objectContaining({ requestedPriority: 'URGENT' }),
        }),
      })
    )
  })
})
