import { processTelegramQueue } from '@/lib/services/telegram-queue.service'

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    telegram_queue: {
      findMany: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/services/telegram.service', () => ({
  sendTelegramAlert: jest.fn(),
}))

import prisma from '@/lib/prisma'
import { sendTelegramAlert } from '@/lib/services/telegram.service'

const findMany = prisma.telegram_queue.findMany as jest.Mock
const update = prisma.telegram_queue.update as jest.Mock
const findUnique = prisma.telegram_queue.findUnique as jest.Mock
const sendAlert = sendTelegramAlert as jest.Mock

describe('processTelegramQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('envía filas pendientes y marca sent', async () => {
    findMany.mockResolvedValue([
      {
        id: 'q1',
        chatId: '123',
        title: 'Test',
        body: 'Body',
        priority: 'important',
        module: 'tickets',
        link: '/tickets/1',
        attempts: 0,
        maxAttempts: 3,
      },
    ])
    update.mockResolvedValue({})
    sendAlert.mockResolvedValue(true)

    const result = await processTelegramQueue()

    expect(result).toEqual({ sent: 1, failed: 0 })
    expect(sendAlert).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: '123', title: 'Test' })
    )
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'q1' },
        data: expect.objectContaining({ status: 'sent' }),
      })
    )
  })

  it('reencola con backoff si falla y quedan intentos', async () => {
    findMany.mockResolvedValue([
      {
        id: 'q2',
        chatId: '456',
        title: 'Fail',
        body: 'Body',
        priority: 'critical',
        module: 'system',
        link: null,
        attempts: 0,
        maxAttempts: 3,
      },
    ])
    update.mockResolvedValue({})
    sendAlert.mockResolvedValue(false)
    findUnique.mockResolvedValue({ attempts: 1, maxAttempts: 3 })

    const result = await processTelegramQueue()

    expect(result).toEqual({ sent: 0, failed: 0 })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'q2' },
        data: expect.objectContaining({ status: 'pending' }),
      })
    )
  })
})
