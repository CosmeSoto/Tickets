/**
 * PUT /api/admin/news/[id]
 *
 * Bug de concurrencia: `existingNews.status` se leía antes del `update` y
 * se comparaba después para decidir si notificar la publicación (push +
 * email + Telegram a todos los destinatarios). El `update` en sí era
 * incondicional. Dos PUT concurrentes con `status: 'PUBLISHED'` sobre la
 * misma noticia DRAFT veían ambos `existingNews.status !== 'PUBLISHED'` →
 * `notifyNewsPublished` se disparaba DOS VECES.
 *
 * Bug adicional (fail-open): las 8 escrituras de las tablas de visibilidad
 * ocurrían después del `update` ya confirmado, sin `$transaction` — un
 * fallo a mitad dejaba la noticia con las 4 tablas parcialmente vacías, que
 * `buildNewsVisibilityConditions` interpreta como "sin restricciones =
 * visible para todos".
 *
 * El fix mueve el claim (`updateMany` con `status: existingNews.status`
 * como token optimista) y las 8 escrituras de visibilidad a una sola
 * `$transaction`.
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
      count: jest.fn(),
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
      count: jest.fn(),
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
  sanitizeVisibilityPayload: jest.fn().mockResolvedValue({
    roles: [],
    userIds: [],
    departmentIds: [],
    familyIds: [],
  }),
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
  // Clase real (no un objeto plano): la ruta hace `sanitized instanceof
  // NextResponse` para distinguir un payload saneado de un error devuelto
  // por `sanitizeVisibilityPayload` — con un objeto plano, `instanceof`
  // lanza ("right-hand side... is not callable") en vez de evaluar a false.
  class NextResponse {
    static json(data: unknown, init?: { status?: number }) {
      return { status: init?.status ?? 200, json: async () => data }
    }
  }
  return { NextResponse }
})

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { AuditServiceComplete } from '@/lib/services/audit-service-complete'
import { notifyNewsPublished } from '@/lib/news/notify-news-published'
import { sanitizeVisibilityPayload } from '@/lib/content/visibility-scope'
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
    ...overrides,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: ADMIN_ID, role: 'ADMIN' } })
  ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({ isSuperAdmin: true })
  // Emula $transaction ejecutando el callback contra el mismo `prisma` mockeado
  // (equivale a que `tx` tenga los mismos delegates que fuera de la transacción).
  ;(prisma.$transaction as jest.Mock).mockImplementation((cb: any) => cb(prisma))
})

describe('PUT /api/admin/news/[id] — claim atómico y notificación única', () => {
  it('claim perdido (count 0): responde 409, sin auditar ni notificar', async () => {
    ;(prisma.news.findUnique as jest.Mock).mockResolvedValue(baseNews({ status: 'DRAFT' }))
    ;(prisma.news.updateMany as jest.Mock).mockResolvedValue({ count: 0 })

    const res = await callPut({ status: 'PUBLISHED' })

    expect(res.status).toBe(409)
    expect(notifyNewsPublished).not.toHaveBeenCalled()
    expect(AuditServiceComplete.log).not.toHaveBeenCalled()
    expect(prisma.news.findUniqueOrThrow).not.toHaveBeenCalled()
  })

  it('transición real DRAFT→PUBLISHED: reclama con el status de partida y notifica exactamente una vez', async () => {
    ;(prisma.news.findUnique as jest.Mock).mockResolvedValue(baseNews({ status: 'DRAFT' }))
    ;(prisma.news.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(prisma.news.findUniqueOrThrow as jest.Mock).mockResolvedValue(
      baseNews({ status: 'PUBLISHED' })
    )

    const res = await callPut({ status: 'PUBLISHED' })

    expect(res.status).toBe(200)
    expect(prisma.news.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: NEWS_ID, status: 'DRAFT' } })
    )
    expect(notifyNewsPublished).toHaveBeenCalledTimes(1)
  })

  it('editar una noticia ya PUBLISHED no vuelve a notificar', async () => {
    ;(prisma.news.findUnique as jest.Mock).mockResolvedValue(baseNews({ status: 'PUBLISHED' }))
    ;(prisma.news.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(prisma.news.findUniqueOrThrow as jest.Mock).mockResolvedValue(
      baseNews({ status: 'PUBLISHED' })
    )

    const res = await callPut({ status: 'PUBLISHED', title: 'Editado' })

    expect(res.status).toBe(200)
    expect(notifyNewsPublished).not.toHaveBeenCalled()
  })

  it('un fallo a mitad de la reescritura de visibilidad revierte todo el PUT (transacción)', async () => {
    ;(prisma.news.findUnique as jest.Mock).mockResolvedValue(baseNews({ status: 'DRAFT' }))
    ;(prisma.news.updateMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(prisma.news_families.createMany as jest.Mock).mockRejectedValue(
      new Error('fallo de familias')
    )
    ;(sanitizeVisibilityPayload as jest.Mock).mockResolvedValue({
      roles: [],
      userIds: [],
      departmentIds: [],
      familyIds: ['family-a'],
    })

    // El error de la transacción lo captura el try/catch del handler y se
    // traduce a 500 — lo importante es que NUNCA llega a auditar/notificar
    // una publicación cuya visibilidad quedó a medio escribir.
    const res = await callPut({ status: 'PUBLISHED', familyIds: ['family-a'] })

    expect(res.status).toBe(500)
    expect(notifyNewsPublished).not.toHaveBeenCalled()
    expect(AuditServiceComplete.log).not.toHaveBeenCalled()
    // La garantía real de C7: las escrituras de visibilidad pasan por
    // $transaction (antes eran llamadas sueltas a `prisma.news_x` después
    // de un `update` ya confirmado, sin ninguna transacción).
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
  })
})
