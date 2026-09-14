/**
 * GET /api/admin/news
 *
 * El `catch` convertía CUALQUIER excepción (Prisma roto, permisos, lo que
 * sea) en `{news:[]}` con status 200 — el panel admin lo veía igual que
 * "no hay noticias que mostrar". Esto escondía en silencio, entre otras
 * cosas, las condiciones de carrera P2002 que ya se corrigieron en este
 * módulo (react/view). El frontend (`admin/news/page.tsx`) ya comprueba
 * `response.ok` y muestra un estado de error — el 200 falso era lo único
 * que se lo impedía.
 *
 * El caso legítimo — sin sesión, o sin acceso al módulo — se mantiene en
 * 401/200 con lista vacía; no es un error, es "no hay nada que ver".
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
    users: { findUnique: jest.fn() },
    news: { findMany: jest.fn() },
  },
  prisma: {
    users: { findUnique: jest.fn() },
    news: { findMany: jest.fn() },
  },
}))

jest.mock('@/lib/news/news-manage-access', () => ({
  assertCanManageNews: jest.fn().mockResolvedValue(null),
}))

jest.mock('@/lib/news/news-access', () => ({
  buildNewsVisibilityConditions: jest.fn(() => []),
  getNewsViewer: jest.fn().mockResolvedValue({ isSuperAdmin: true }),
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
import { GET } from '@/app/api/admin/news/route'

describe('GET /api/admin/news', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } })
    ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({ isSuperAdmin: true })
  })

  it('un error real de Prisma responde 500, no 200 con lista vacía', async () => {
    ;(prisma.news.findMany as jest.Mock).mockRejectedValue(new Error('conexión perdida'))

    const res = await GET({ url: 'https://app.test/api/admin/news' } as any)

    expect(res.status).toBe(500)
  })

  it('sin resultados reales (no un error): sigue en 200 con lista vacía', async () => {
    ;(prisma.news.findMany as jest.Mock).mockResolvedValue([])

    const res = await GET({ url: 'https://app.test/api/admin/news' } as any)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.news).toEqual([])
  })

  it('sin sesión: 401 (no se llega a consultar la BD)', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)

    const res = await GET({ url: 'https://app.test/api/admin/news' } as any)

    expect(res.status).toBe(401)
    expect(prisma.news.findMany).not.toHaveBeenCalled()
  })
})
