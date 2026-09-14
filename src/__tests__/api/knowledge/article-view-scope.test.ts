/**
 * POST /api/knowledge-articles/[id]/view
 *
 * No validaba scope de familia antes de incrementar `views` (cualquier
 * usuario autenticado podía inflar el contador de cualquier artículo por
 * id, incluso uno fuera de su alcance) y no deduplicaba — reintroducía el
 * problema de inflación de vistas ya corregido del lado de
 * GET /api/knowledge/[id]. Ahora comparte el mismo dedup en memoria.
 */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))

jest.mock('@/lib/knowledge/article-access', () => {
  class MockKnowledgeAccessError extends Error {
    statusCode: number
    constructor(message: string, statusCode = 403) {
      super(message)
      this.statusCode = statusCode
    }
  }
  return {
    assertCanAccessKnowledgeArticle: jest.fn(),
    KnowledgeAccessError: MockKnowledgeAccessError,
  }
})

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    knowledge_articles: { findUnique: jest.fn(), update: jest.fn() },
  },
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
import prisma from '@/lib/prisma'
import { assertCanAccessKnowledgeArticle } from '@/lib/knowledge/article-access'
import { shouldCountArticleView } from '@/lib/knowledge/view-dedup'
import { POST } from '@/app/api/knowledge-articles/[id]/view/route'

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

function articleFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'art-1',
    authorId: 'someone-else',
    familyId: 'fam-1',
    isPublished: true,
    ...overrides,
  }
}

describe('POST /api/knowledge-articles/[id]/view', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'user-1', role: 'CLIENT', isSuperAdmin: false },
    })
    ;(prisma.knowledge_articles.findUnique as jest.Mock).mockResolvedValue(articleFixture())
  })

  it('regresión: sin acceso de lectura a la familia del artículo, 403 sin incrementar', async () => {
    ;(assertCanAccessKnowledgeArticle as jest.Mock).mockRejectedValue(
      new (jest.requireMock('@/lib/knowledge/article-access').KnowledgeAccessError)(
        'No tienes acceso a artículos de esta área de soporte',
        403
      )
    )

    const res = await POST({} as any, params('art-1'))

    expect(res.status).toBe(403)
    expect(prisma.knowledge_articles.update).not.toHaveBeenCalled()
  })

  it('con acceso, incrementa la vista', async () => {
    ;(assertCanAccessKnowledgeArticle as jest.Mock).mockResolvedValue(undefined)
    ;(prisma.knowledge_articles.update as jest.Mock).mockResolvedValue({})

    const res = await POST({} as any, params(`dedup-fresh-${Date.now()}`))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.counted).toBe(true)
    expect(prisma.knowledge_articles.update).toHaveBeenCalled()
  })

  it('regresión: una segunda llamada del mismo usuario+artículo dentro de la ventana NO vuelve a incrementar', async () => {
    ;(assertCanAccessKnowledgeArticle as jest.Mock).mockResolvedValue(undefined)
    ;(prisma.knowledge_articles.update as jest.Mock).mockResolvedValue({})

    const articleId = `dedup-repeat-${Date.now()}`
    ;(prisma.knowledge_articles.findUnique as jest.Mock).mockResolvedValue(
      articleFixture({ id: articleId })
    )

    await POST({} as any, params(articleId))
    ;(prisma.knowledge_articles.update as jest.Mock).mockClear()

    const res = await POST({} as any, params(articleId))
    const body = await res.json()

    expect(body.counted).toBe(false)
    expect(prisma.knowledge_articles.update).not.toHaveBeenCalled()
  })

  it('artículo inexistente -> 404', async () => {
    ;(prisma.knowledge_articles.findUnique as jest.Mock).mockResolvedValue(null)

    const res = await POST({} as any, params('missing'))

    expect(res.status).toBe(404)
  })
})

describe('shouldCountArticleView — sanity del dedup compartido', () => {
  it('la primera llamada cuenta, una repetida inmediata no', () => {
    const id = `sanity-${Date.now()}-${Math.random()}`
    expect(shouldCountArticleView('u1', id)).toBe(true)
    expect(shouldCountArticleView('u1', id)).toBe(false)
  })
})
