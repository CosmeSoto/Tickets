/**
 * PUT/DELETE /api/knowledge/[id]
 *
 * Dos bugs reales:
 * 1. Al cambiar `categoryId`, `familyId` NO se recalculaba (solo se deriva
 *    en la creación) — un artículo movido a una categoría de otra familia
 *    quedaba con `familyId` obsoleto, rompiendo los filtros de listado/
 *    búsqueda por familia.
 * 2. PUT/DELETE solo validaban `isAuthor || isAdmin`, sin volver a
 *    comprobar `assertCanWriteKnowledgeFamily` — un autor/ADMIN al que se
 *    le retiró el acceso a la familia del artículo conservaba permiso
 *    indefinido para editarlo/borrarlo.
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
    assertCanWriteKnowledgeFamily: jest.fn(),
    buildArticleSourceContext: jest.fn(),
    filterArticleContentForClient: (c: string) => c,
    rewriteTicketAttachmentLinks: (c: string) => c,
    KnowledgeAccessError: MockKnowledgeAccessError,
  }
})

jest.mock('@/lib/prisma', () => {
  const client = {
    knowledge_articles: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    categories: { findUnique: jest.fn() },
    article_votes: { deleteMany: jest.fn() },
    audit_logs: { create: jest.fn().mockResolvedValue({}) },
  }
  return { __esModule: true, default: client, prisma: client }
})

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
import { assertCanWriteKnowledgeFamily } from '@/lib/knowledge/article-access'
import { PUT, DELETE } from '@/app/api/knowledge/[id]/route'

const ARTICLE_ID = 'art-1'

function params() {
  return { params: Promise.resolve({ id: ARTICLE_ID }) }
}

function putRequest(body: Record<string, unknown>) {
  return { json: async () => body } as any
}

function authorArticle(overrides: Record<string, unknown> = {}) {
  return {
    id: ARTICLE_ID,
    authorId: 'author-1',
    familyId: 'fam-old',
    title: 'Título original de más de diez caracteres',
    ...overrides,
  }
}

describe('PUT /api/knowledge/[id] — revalida acceso de escritura y recalcula familyId', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'author-1', role: 'TECHNICIAN', isSuperAdmin: false },
    })
    ;(prisma.knowledge_articles.findUnique as jest.Mock).mockResolvedValue(authorArticle())
  })

  it('regresión: el autor perdió acceso a la familia del artículo -> 403, no actualiza', async () => {
    ;(assertCanWriteKnowledgeFamily as jest.Mock).mockRejectedValue(
      new (jest.requireMock('@/lib/knowledge/article-access').KnowledgeAccessError)(
        'No puedes publicar artículos en esta área',
        403
      )
    )

    const res = await PUT(putRequest({ title: 'Nuevo título editado con más de diez' }), params())

    expect(res.status).toBe(403)
    expect(prisma.knowledge_articles.update).not.toHaveBeenCalled()
  })

  it('regresión: mover a una categoría de otra familia recalcula familyId y valida acceso al destino', async () => {
    ;(assertCanWriteKnowledgeFamily as jest.Mock).mockResolvedValue(undefined)
    ;(prisma.categories.findUnique as jest.Mock).mockResolvedValue({
      id: 'cat-2',
      familyId: 'fam-new',
      departments: null,
    })
    ;(prisma.knowledge_articles.update as jest.Mock).mockResolvedValue({ id: ARTICLE_ID })

    const res = await PUT(
      putRequest({ categoryId: '11111111-1111-1111-1111-111111111111' }),
      params()
    )

    expect(res.status).toBe(200)
    // Se valida escritura tanto en la familia actual como en la destino
    expect(assertCanWriteKnowledgeFamily).toHaveBeenCalledWith(expect.anything(), 'fam-old')
    expect(assertCanWriteKnowledgeFamily).toHaveBeenCalledWith(expect.anything(), 'fam-new')
    expect(prisma.knowledge_articles.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ familyId: 'fam-new' }) })
    )
  })

  it('regresión: mover a una familia sin acceso de escritura es rechazado', async () => {
    ;(assertCanWriteKnowledgeFamily as jest.Mock)
      .mockResolvedValueOnce(undefined) // familia actual: ok
      .mockRejectedValueOnce(
        new (jest.requireMock('@/lib/knowledge/article-access').KnowledgeAccessError)(
          'No puedes publicar artículos en esta área',
          403
        )
      )
    ;(prisma.categories.findUnique as jest.Mock).mockResolvedValue({
      id: 'cat-2',
      familyId: 'fam-forbidden',
      departments: null,
    })

    const res = await PUT(
      putRequest({ categoryId: '11111111-1111-1111-1111-111111111111' }),
      params()
    )

    expect(res.status).toBe(403)
    expect(prisma.knowledge_articles.update).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/knowledge/[id] — revalida acceso de escritura', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'author-1', role: 'TECHNICIAN', isSuperAdmin: false },
    })
    ;(prisma.knowledge_articles.findUnique as jest.Mock).mockResolvedValue(authorArticle())
  })

  it('regresión: el autor perdió acceso a la familia -> 403, no elimina', async () => {
    ;(assertCanWriteKnowledgeFamily as jest.Mock).mockRejectedValue(
      new (jest.requireMock('@/lib/knowledge/article-access').KnowledgeAccessError)('no', 403)
    )

    const res = await DELETE({} as any, params())

    expect(res.status).toBe(403)
    expect(prisma.knowledge_articles.delete).not.toHaveBeenCalled()
  })

  it('con acceso vigente, elimina normalmente', async () => {
    ;(assertCanWriteKnowledgeFamily as jest.Mock).mockResolvedValue(undefined)
    ;(prisma.knowledge_articles.delete as jest.Mock).mockResolvedValue({})

    const res = await DELETE({} as any, params())

    expect(res.status).toBe(200)
    expect(prisma.knowledge_articles.delete).toHaveBeenCalledWith({ where: { id: ARTICLE_ID } })
  })
})
