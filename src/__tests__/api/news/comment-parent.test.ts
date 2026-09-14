/**
 * POST /api/news/[id]/comment
 *
 * Bug real: cuando se mandaba `parentId`, solo se verificaba que el
 * comentario padre existiera (`findUnique({id: parentId})`) — nunca que
 * perteneciera a ESTA noticia. Un usuario podía colgar una respuesta en el
 * hilo de OTRA noticia (con `allowComments:false`, o a la que no tenía
 * acceso), y esa respuesta aparecía ahí vía el `include` de `replies` de
 * `GET /api/news/[id]`.
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
    news_comments: { findFirst: jest.fn(), create: jest.fn() },
  },
  prisma: {
    news: { findUnique: jest.fn() },
    news_comments: { findFirst: jest.fn(), create: jest.fn() },
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
import { POST } from '@/app/api/news/[id]/comment/route'

const NEWS_ID = 'news-1'
const USER_ID = 'user-1'

function makeRequest(body: Record<string, unknown>) {
  return { json: async () => body } as any
}

function callRoute(body: Record<string, unknown>) {
  return POST(makeRequest(body), { params: Promise.resolve({ id: NEWS_ID }) })
}

describe('POST /api/news/[id]/comment — parentId atado a la noticia', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: USER_ID } })
    ;(prisma.news.findUnique as jest.Mock).mockResolvedValue({ allowComments: true })
  })

  it('rechaza un parentId de OTRA noticia con 404, sin crear el comentario', async () => {
    ;(prisma.news_comments.findFirst as jest.Mock).mockResolvedValue(null) // no matchea newsId

    const res = await callRoute({ content: 'hola', parentId: 'comment-de-otra-noticia' })

    expect(res.status).toBe(404)
    expect(prisma.news_comments.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'comment-de-otra-noticia', newsId: NEWS_ID, isHidden: false },
      })
    )
    expect(prisma.news_comments.create).not.toHaveBeenCalled()
  })

  it('rechaza responder a un comentario que ya es una respuesta (un solo nivel)', async () => {
    ;(prisma.news_comments.findFirst as jest.Mock).mockResolvedValue({
      id: 'reply-1',
      parentId: 'root-1',
    })

    const res = await callRoute({ content: 'hola', parentId: 'reply-1' })

    expect(res.status).toBe(400)
    expect(prisma.news_comments.create).not.toHaveBeenCalled()
  })

  it('crea la respuesta cuando el padre pertenece a esta noticia y es de primer nivel', async () => {
    ;(prisma.news_comments.findFirst as jest.Mock).mockResolvedValue({
      id: 'root-1',
      parentId: null,
    })
    ;(prisma.news_comments.create as jest.Mock).mockResolvedValue({ id: 'reply-2' })

    const res = await callRoute({ content: 'hola', parentId: 'root-1' })

    expect(res.status).toBe(200)
    expect(prisma.news_comments.create).toHaveBeenCalledTimes(1)
  })

  it('comentario de primer nivel (sin parentId) no consulta news_comments.findFirst', async () => {
    ;(prisma.news_comments.create as jest.Mock).mockResolvedValue({ id: 'root-2' })

    const res = await callRoute({ content: 'hola' })

    expect(res.status).toBe(200)
    expect(prisma.news_comments.findFirst).not.toHaveBeenCalled()
  })
})
