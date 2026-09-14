/**
 * getNewsNotificationRecipientIds (src/lib/news/news-access.ts)
 *
 * Bug real: solo comprobaba `news.status !== 'PUBLISHED'`, ignorando por
 * completo `startDate`/`endDate`. Publicar una noticia con `startDate`
 * futura (programada) notificaba por email/push/Telegram a TODA la
 * organización inmediatamente, aunque el feed (`userCanAccessNews`, que sí
 * mira la ventana de vigencia) todavía no se la mostrara a nadie.
 */

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { news: { findUnique: jest.fn() }, users: { findMany: jest.fn() } },
  prisma: { news: { findUnique: jest.fn() }, users: { findMany: jest.fn() } },
}))

import { prisma } from '@/lib/prisma'
import { getNewsNotificationRecipientIds } from '@/lib/news/news-access'

function baseNews(overrides: Record<string, unknown> = {}) {
  return {
    status: 'PUBLISHED',
    startDate: null,
    endDate: null,
    news_roles: [],
    news_users: [],
    news_departments: [],
    news_families: [],
    ...overrides,
  }
}

describe('getNewsNotificationRecipientIds', () => {
  beforeEach(() => jest.clearAllMocks())

  it('startDate en el futuro: no notifica a nadie todavía', async () => {
    ;(prisma.news.findUnique as jest.Mock).mockResolvedValue(
      baseNews({ startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) })
    )

    const recipients = await getNewsNotificationRecipientIds('news-1')

    expect(recipients).toEqual([])
    expect(prisma.users.findMany).not.toHaveBeenCalled()
  })

  it('endDate ya pasada: no notifica', async () => {
    ;(prisma.news.findUnique as jest.Mock).mockResolvedValue(
      baseNews({ endDate: new Date(Date.now() - 24 * 60 * 60 * 1000) })
    )

    const recipients = await getNewsNotificationRecipientIds('news-1')

    expect(recipients).toEqual([])
  })

  it('PUBLISHED y dentro de la ventana de vigencia: sí notifica', async () => {
    ;(prisma.news.findUnique as jest.Mock).mockResolvedValue(baseNews())
    ;(prisma.users.findMany as jest.Mock).mockResolvedValue([
      { id: 'u1', role: 'TECHNICIAN', canManageNews: false, email: 'a@b.com' },
    ])

    const recipients = await getNewsNotificationRecipientIds('news-1')

    expect(recipients).toHaveLength(1)
  })

  it('DRAFT: sigue sin notificar (regla existente, no debe romperse)', async () => {
    ;(prisma.news.findUnique as jest.Mock).mockResolvedValue(baseNews({ status: 'DRAFT' }))

    const recipients = await getNewsNotificationRecipientIds('news-1')

    expect(recipients).toEqual([])
  })
})
