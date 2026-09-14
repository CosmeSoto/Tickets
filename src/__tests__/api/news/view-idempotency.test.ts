/**
 * POST /api/news/[id]/view
 *
 * Bug de concurrencia: `findUnique` → `if (!existing) create` sobre
 * `news_views` (`@@unique([newsId, userId])`) dejaba una ventana entre leer
 * y escribir. Dos POST casi simultáneos (remontaje del componente al abrir
 * la noticia, doble click) podían pasar ambos el `findUnique` antes de que
 * cualquiera de los dos hiciera el `create`, y el segundo `create` chocaba
 * con un P2002 sin manejar → 500.
 */

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { news_views: { createMany: jest.fn().mockResolvedValue({ count: 1 }) } },
  prisma: { news_views: { createMany: jest.fn().mockResolvedValue({ count: 1 }) } },
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
import { POST } from '@/app/api/news/[id]/view/route'

const NEWS_ID = 'news-1'
const USER_ID = 'user-1'

function callRoute() {
  return POST({} as any, { params: Promise.resolve({ id: NEWS_ID }) })
}

describe('POST /api/news/[id]/view', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: USER_ID } })
  })

  it('usa createMany con skipDuplicates (nunca findUnique+create)', async () => {
    const res = await callRoute()

    expect(res.status).toBe(200)
    expect(prisma.news_views.createMany).toHaveBeenCalledWith({
      data: [{ newsId: NEWS_ID, userId: USER_ID }],
      skipDuplicates: true,
    })
  })

  it('dos llamadas seguidas (doble click) responden 200 las dos, sin lanzar', async () => {
    await expect(callRoute()).resolves.toMatchObject({ status: 200 })
    await expect(callRoute()).resolves.toMatchObject({ status: 200 })
    expect(prisma.news_views.createMany).toHaveBeenCalledTimes(2)
  })
})
