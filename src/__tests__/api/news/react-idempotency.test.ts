/**
 * POST /api/news/[id]/react
 *
 * Bug de concurrencia: `findUnique` → `delete`/`update`/`create` sobre
 * `news_reactions` (`@@unique([newsId, userId])`) sin atomicidad. Un doble
 * tap rápido (la UI no deshabilitaba el botón durante el toggle) podía
 * disparar dos `create` sobre el mismo par `[newsId, userId]` (P2002 sin
 * manejar → 500) o un `update`/`delete` sobre una fila que la otra llamada
 * ya había borrado (P2025).
 */

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    news: { findUnique: jest.fn() },
    news_reactions: {
      deleteMany: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
  },
  prisma: {
    news: { findUnique: jest.fn() },
    news_reactions: {
      deleteMany: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}))

jest.mock('@/lib/news/news-access', () => ({
  assertCanViewNews: jest.fn().mockResolvedValue(null),
}))

jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { POST } from '@/app/api/news/[id]/react/route'

const NEWS_ID = 'news-1'
const USER_ID = 'user-1'

function makeRequest(reaction: string) {
  return { json: async () => ({ reaction }) } as any
}

function callRoute(reaction: string) {
  return POST(makeRequest(reaction), { params: Promise.resolve({ id: NEWS_ID }) })
}

describe('POST /api/news/[id]/react', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: USER_ID } })
    ;(prisma.news.findUnique as jest.Mock).mockResolvedValue({ allowReactions: true })
  })

  it('reacción repetida: deleteMany decide el toggle-off, upsert nunca se llama', async () => {
    ;(prisma.news_reactions.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })

    const res = await callRoute('👍')

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.reaction).toBeNull()
    expect(prisma.news_reactions.upsert).not.toHaveBeenCalled()
  })

  it('reacción nueva: deleteMany no borra nada, upsert crea/actualiza sobre el unique compuesto', async () => {
    ;(prisma.news_reactions.deleteMany as jest.Mock).mockResolvedValue({ count: 0 })
    ;(prisma.news_reactions.upsert as jest.Mock).mockResolvedValue({})

    const res = await callRoute('❤️')

    expect(res.status).toBe(200)
    expect(prisma.news_reactions.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { newsId_userId: { newsId: NEWS_ID, userId: USER_ID } },
      })
    )
  })

  it('dos upsert concurrentes (P2002): responde 200 con updateMany de rescate, no 500', async () => {
    ;(prisma.news_reactions.deleteMany as jest.Mock).mockResolvedValue({ count: 0 })
    ;(prisma.news_reactions.upsert as jest.Mock).mockRejectedValue({
      code: 'P2002',
      meta: { target: ['news_reactions_newsId_userId_key'] },
    })
    ;(prisma.news_reactions.updateMany as jest.Mock).mockResolvedValue({ count: 1 })

    const res = await callRoute('🎉')

    expect(res.status).toBe(200)
    expect(prisma.news_reactions.updateMany).toHaveBeenCalledWith({
      where: { newsId: NEWS_ID, userId: USER_ID },
      data: { reaction: '🎉' },
    })
  })

  it('rechaza sin tocar la BD si allowReactions está desactivado', async () => {
    ;(prisma.news.findUnique as jest.Mock).mockResolvedValue({ allowReactions: false })

    const res = await callRoute('👍')

    expect(res.status).toBe(403)
    expect(prisma.news_reactions.deleteMany).not.toHaveBeenCalled()
  })
})
