/**
 * NotificationService.markAsRead / markAsUnread
 *
 * Antes hacían `update({ where: { id } })` sin `userId` — dependían 100%
 * de que el caller ya hubiera validado la propiedad. Hoy el único caller
 * (`/api/notifications/[id]/read`) sí lo hace, pero es un IDOR latente: un
 * caller futuro que no repita el chequeo mutaría la notificación de
 * cualquier usuario. Ahora el filtro `{ id, userId }` vive en el propio
 * `updateMany` — un no-op (count 0 → null) si la notificación no es del
 * usuario, en vez de una escritura sin filtrar.
 */

jest.mock('@/lib/prisma', () => {
  const client = {
    notifications: { updateMany: jest.fn(), findUnique: jest.fn() },
  }
  return { __esModule: true, default: client, prisma: client }
})

import prisma from '@/lib/prisma'
import { NotificationService } from '@/lib/services/notification-service'

describe('NotificationService.markAsRead / markAsUnread — propiedad exigida en el propio update', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('regresión markAsRead: el where incluye userId, no solo id', async () => {
    ;(prisma.notifications.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(prisma.notifications.findUnique as jest.Mock).mockResolvedValue({ id: 'n1', isRead: true })

    await NotificationService.markAsRead('n1', 'user-1')

    expect(prisma.notifications.updateMany).toHaveBeenCalledWith({
      where: { id: 'n1', userId: 'user-1' },
      data: { isRead: true },
    })
  })

  it('regresión markAsRead: si la notificación no es del usuario (count 0), devuelve null sin exponer datos ajenos', async () => {
    ;(prisma.notifications.updateMany as jest.Mock).mockResolvedValue({ count: 0 })

    const result = await NotificationService.markAsRead('n1', 'attacker')

    expect(result).toBeNull()
    expect(prisma.notifications.findUnique).not.toHaveBeenCalled()
  })

  it('regresión markAsUnread: el where incluye userId, no solo id', async () => {
    ;(prisma.notifications.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(prisma.notifications.findUnique as jest.Mock).mockResolvedValue({ id: 'n1', isRead: false })

    await NotificationService.markAsUnread('n1', 'user-1')

    expect(prisma.notifications.updateMany).toHaveBeenCalledWith({
      where: { id: 'n1', userId: 'user-1' },
      data: { isRead: false },
    })
  })

  it('markAsUnread: si la notificación no es del usuario, devuelve null', async () => {
    ;(prisma.notifications.updateMany as jest.Mock).mockResolvedValue({ count: 0 })

    const result = await NotificationService.markAsUnread('n1', 'attacker')

    expect(result).toBeNull()
  })
})
