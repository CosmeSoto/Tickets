/**
 * PUT /api/admin/news/[id]
 *
 * Dos bugs de validación/consistencia (a diferencia del POST de alta, que
 * sí validaba enums y título):
 * - `type`/`priority`/`status` inválidos llegaban tal cual a Prisma y
 *   salían como un 500 genérico en vez de un 400 claro.
 * - `startDate`/`endDate` se calculaban como `data.startDate ? new
 *   Date(...) : null` — cualquier PUT parcial que no mandara esas claves
 *   las borraba silenciosamente (`undefined` es falsy, igual que un
 *   borrado explícito).
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
    news: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      updateMany: jest.fn(),
    },
    news_roles: { deleteMany: jest.fn(), createMany: jest.fn() },
    news_users: { deleteMany: jest.fn(), createMany: jest.fn() },
    news_departments: { deleteMany: jest.fn(), createMany: jest.fn() },
    news_families: { deleteMany: jest.fn(), createMany: jest.fn() },
    $transaction: jest.fn(),
  },
  prisma: {
    users: { findUnique: jest.fn() },
    news: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      updateMany: jest.fn(),
    },
    news_roles: { deleteMany: jest.fn(), createMany: jest.fn() },
    news_users: { deleteMany: jest.fn(), createMany: jest.fn() },
    news_departments: { deleteMany: jest.fn(), createMany: jest.fn() },
    news_families: { deleteMany: jest.fn(), createMany: jest.fn() },
    $transaction: jest.fn(),
  },
}))

jest.mock('@/lib/news/news-manage-access', () => ({
  assertCanManageNews: jest.fn().mockResolvedValue(null),
  assertCanModifyNews: jest.fn().mockResolvedValue(null),
}))

jest.mock('@/lib/content/visibility-scope', () => ({
  getContentVisibilityScope: jest.fn().mockResolvedValue({}),
  sanitizeVisibilityPayload: jest.fn(),
}))

jest.mock('@/lib/content/visibility-audit', () => ({
  buildVisibilityAuditSummary: jest.fn(() => ({})),
}))

jest.mock('@/lib/news/news-access', () => ({
  buildNewsVisibilityConditions: jest.fn(() => []),
  getNewsViewer: jest.fn(),
}))

jest.mock('@/lib/services/audit-service-complete', () => ({
  AuditActionsComplete: { NEWS_PUBLISHED: 'news_published', NEWS_UPDATED: 'news_updated' },
  AuditServiceComplete: { log: jest.fn() },
}))

jest.mock('@/lib/news/notify-news-published', () => ({
  notifyNewsPublished: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('next/server', () => {
  class NextResponse {
    static json(data: unknown, init?: { status?: number }) {
      return { status: init?.status ?? 200, json: async () => data }
    }
  }
  return { NextResponse }
})

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { PUT } from '@/app/api/admin/news/[id]/route'

const NEWS_ID = 'news-1'
const ADMIN_ID = 'admin-1'

function makeRequest(body: Record<string, unknown>) {
  return { json: async () => body } as any
}

function callPut(body: Record<string, unknown>) {
  return PUT(makeRequest(body), { params: Promise.resolve({ id: NEWS_ID }) })
}

function baseNews(overrides: Record<string, unknown> = {}) {
  return {
    id: NEWS_ID,
    title: 'Original',
    slug: 'original',
    status: 'DRAFT',
    priority: 'MEDIUM',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-02-01'),
    ...overrides,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: ADMIN_ID, role: 'ADMIN' } })
  ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({ isSuperAdmin: true })
  ;(prisma.news.findUnique as jest.Mock).mockResolvedValue(baseNews())
  ;(prisma.$transaction as jest.Mock).mockImplementation((cb: any) => cb(prisma))
  ;(prisma.news.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
  ;(prisma.news.findUniqueOrThrow as jest.Mock).mockResolvedValue(baseNews())
})

describe('PUT /api/admin/news/[id] — validación', () => {
  it('título vacío: 400 sin tocar la base de datos', async () => {
    const res = await callPut({ title: '   ' })

    expect(res.status).toBe(400)
    expect(prisma.news.updateMany).not.toHaveBeenCalled()
  })

  it('type inválido: 400, no 500 de Prisma', async () => {
    const res = await callPut({ type: 'NO_EXISTE' })

    expect(res.status).toBe(400)
    expect(prisma.news.updateMany).not.toHaveBeenCalled()
  })

  it('status inválido: 400', async () => {
    const res = await callPut({ status: 'NO_EXISTE' })

    expect(res.status).toBe(400)
  })

  it('type/status/priority válidos: pasa la validación', async () => {
    const res = await callPut({ type: 'ALERT', priority: 'URGENT' })

    expect(res.status).toBe(200)
  })
})

describe('PUT /api/admin/news/[id] — merge parcial de fechas', () => {
  it('PUT sin startDate/endDate en el body: esas claves no se tocan', async () => {
    await callPut({ title: 'Solo cambio el título' })

    const [[callArgs]] = (prisma.news.updateMany as jest.Mock).mock.calls
    expect('startDate' in callArgs.data).toBe(false)
    expect('endDate' in callArgs.data).toBe(false)
  })

  it('PUT con startDate:null explícito: la clave sí se incluye', async () => {
    await callPut({ startDate: null })

    const [[callArgs]] = (prisma.news.updateMany as jest.Mock).mock.calls
    expect(callArgs.data.startDate).toBeNull()
  })

  it('PUT con startDate con valor: se convierte a Date', async () => {
    await callPut({ startDate: '2026-03-01T00:00:00.000Z' })

    const [[callArgs]] = (prisma.news.updateMany as jest.Mock).mock.calls
    expect(callArgs.data.startDate).toBeInstanceOf(Date)
  })
})
