import { queueTelegramNotification } from '@/lib/notifications/queue-notification-telegram'
import { processTelegramQueue } from '@/lib/services/telegram-queue.service'

jest.mock('@/lib/services/telegram-config', () => ({
  isTelegramEnabled: jest.fn().mockResolvedValue(true),
  isTelegramNotificationsEnabled: jest.fn().mockResolvedValue(true),
  getTelegramConfig: jest.fn().mockResolvedValue({ enabled: true, notificationsEnabled: true }),
}))

jest.mock('@/lib/notifications/telegram-prefs', () => ({
  filterUserIdsForTelegramNotification: jest.fn(async (ids: string[]) => ids),
}))

jest.mock('@/lib/services/telegram-queue.service', () => ({
  enqueueTelegramAlert: jest.fn().mockResolvedValue('q-id'),
  processTelegramQueue: jest.fn().mockResolvedValue({ sent: 1, failed: 0 }),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    users: {
      findMany: jest.fn(),
    },
    telegram_queue: {
      count: jest.fn().mockResolvedValue(0),
    },
  },
}))

import prisma from '@/lib/prisma'

const findMany = prisma.users.findMany as jest.Mock
const processQueue = processTelegramQueue as jest.Mock

describe('queueTelegramNotification', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('dispara processTelegramQueue en background para alertas critical', async () => {
    findMany.mockResolvedValue([{ id: 'u1', telegramChatId: '12345' }])

    await queueTelegramNotification({
      recipientUserId: 'u1',
      title: 'Backup fallido',
      body: 'Detalle',
      module: 'system',
      event: 'backupFailure',
      priority: 'critical',
    })

    expect(processQueue).toHaveBeenCalled()
  })

  it('no dispara processTelegramQueue para alertas important', async () => {
    findMany.mockResolvedValue([{ id: 'u1', telegramChatId: '12345' }])

    await queueTelegramNotification({
      recipientUserId: 'u1',
      title: 'Ticket asignado',
      body: 'Detalle',
      module: 'tickets',
      event: 'ticketAssigned',
    })

    expect(processQueue).not.toHaveBeenCalled()
  })
})
