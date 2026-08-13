import { filterUserIdsForTelegramNotification } from '@/lib/notifications/telegram-prefs'

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user_settings: {
      findMany: jest.fn(),
    },
  },
}))

import prisma from '@/lib/prisma'

const findMany = prisma.user_settings.findMany as jest.Mock

describe('telegram-prefs', () => {
  beforeEach(() => {
    findMany.mockReset()
  })

  it('omite usuarios con telegramNotifications desactivado', async () => {
    findMany.mockResolvedValue([
      {
        userId: 'u1',
        telegramNotifications: false,
        notifyTickets: true,
        notifyInventory: true,
        notifyPatrols: true,
        ticketCreated: true,
        ticketAssigned: true,
        statusChanged: true,
        newComments: true,
        ticketUpdated: true,
        ticketUpdates: true,
      },
      {
        userId: 'u2',
        telegramNotifications: true,
        notifyTickets: true,
        notifyInventory: true,
        notifyPatrols: true,
        ticketCreated: true,
        ticketAssigned: true,
        statusChanged: true,
        newComments: true,
        ticketUpdated: true,
        ticketUpdates: true,
      },
    ])

    const result = await filterUserIdsForTelegramNotification(['u1', 'u2'], {
      module: 'tickets',
      event: 'ticketCreated',
      priority: 'important',
    })

    expect(result).toEqual(['u2'])
  })

  it('respeta notifyPatrols para eventos de rondas', async () => {
    findMany.mockResolvedValue([
      {
        userId: 'u1',
        telegramNotifications: true,
        notifyTickets: true,
        notifyInventory: true,
        notifyPatrols: false,
        ticketCreated: true,
        ticketAssigned: true,
        statusChanged: true,
        newComments: true,
        ticketUpdated: true,
        ticketUpdates: true,
      },
    ])

    const result = await filterUserIdsForTelegramNotification(['u1'], {
      module: 'patrols',
      event: 'patrolAssigned',
      priority: 'important',
    })

    expect(result).toEqual([])
  })

  it('permite eventos critical aunque el módulo esté desactivado', async () => {
    findMany.mockResolvedValue([
      {
        userId: 'u1',
        telegramNotifications: true,
        notifyTickets: false,
        notifyInventory: false,
        notifyPatrols: false,
        ticketCreated: false,
        ticketAssigned: false,
        statusChanged: false,
        newComments: false,
        ticketUpdated: false,
        ticketUpdates: false,
      },
    ])

    const result = await filterUserIdsForTelegramNotification(['u1'], {
      module: 'backups',
      event: 'backupFailure',
      priority: 'critical',
    })

    expect(result).toEqual(['u1'])
  })
})
