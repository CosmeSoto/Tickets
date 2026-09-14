/**
 * serveNewsAttachment — cuerpo compartido de las dos rutas /file de adjuntos
 * de noticias.
 *
 * Regresión 1: antes se usaba `findUnique({id: attachmentId})` + comparación
 * manual de `newsId` — un adjunto de OTRA noticia nunca debía leerse, pero
 * el patrón es frágil. El fix usa `findFirst({id, newsId})` en el where.
 *
 * Regresión 2 (la importante): el `Content-Type` de la respuesta usaba
 * `attachment.mimeType` tal cual viniera de BD. Un adjunto legado (subido
 * antes del fix de magic-bytes en FileService, o insertado directo en BD)
 * con `mimeType: 'text/html'` se servía como HTML ejecutable. El fix solo
 * confía en `INLINE_SAFE_MIMES`; cualquier otra cosa se fuerza a
 * `application/octet-stream` + descarga.
 */

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    news_attachments: { findFirst: jest.fn() },
  },
}))

jest.mock('@/lib/news/news-access', () => ({
  assertCanViewNews: jest.fn().mockResolvedValue(null),
}))

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
}))

jest.mock('fs/promises', () => ({
  readFile: jest.fn().mockResolvedValue(Buffer.from('contenido')),
}))

jest.mock('next/server', () => ({
  NextResponse: class {
    body: unknown
    status: number
    headers: Record<string, string>
    constructor(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      this.body = body
      this.status = init?.status ?? 200
      this.headers = init?.headers ?? {}
    }
  },
}))

import prisma from '@/lib/prisma'
import { assertCanViewNews } from '@/lib/news/news-access'
import { serveNewsAttachment } from '@/lib/news/serve-news-attachment'

const NEWS_ID = 'news-1'
const ATTACHMENT_ID = 'att-1'
const USER_ID = 'user-1'

function baseAttachment(overrides: Record<string, unknown> = {}) {
  return {
    id: ATTACHMENT_ID,
    newsId: NEWS_ID,
    path: '/uploads/news/news-1/x.pdf',
    originalName: 'informe.pdf',
    mimeType: 'application/pdf',
    ...overrides,
  }
}

describe('serveNewsAttachment', () => {
  beforeEach(() => jest.clearAllMocks())

  it('busca el adjunto con newsId en el where (no findUnique + comparación manual)', async () => {
    ;(prisma.news_attachments.findFirst as jest.Mock).mockResolvedValue(baseAttachment())

    await serveNewsAttachment(NEWS_ID, ATTACHMENT_ID, USER_ID)

    expect(prisma.news_attachments.findFirst).toHaveBeenCalledWith({
      where: { id: ATTACHMENT_ID, newsId: NEWS_ID },
    })
  })

  it('404 si el adjunto pertenece a otra noticia', async () => {
    ;(prisma.news_attachments.findFirst as jest.Mock).mockResolvedValue(null)

    const res = await serveNewsAttachment(NEWS_ID, ATTACHMENT_ID, USER_ID)

    expect((res as any).status).toBe(404)
  })

  it('sirve un mime legado peligroso como octet-stream + descarga forzada (regresión de XSS)', async () => {
    ;(prisma.news_attachments.findFirst as jest.Mock).mockResolvedValue(
      baseAttachment({ mimeType: 'text/html', originalName: 'legado.html' })
    )

    const res: any = await serveNewsAttachment(NEWS_ID, ATTACHMENT_ID, USER_ID)

    expect(res.headers['Content-Type']).toBe('application/octet-stream')
    expect(res.headers['Content-Disposition']).toMatch(/^attachment;/)
    expect(res.headers['X-Content-Type-Options']).toBe('nosniff')
  })

  it('un PDF legítimo se sirve inline con su mime real', async () => {
    ;(prisma.news_attachments.findFirst as jest.Mock).mockResolvedValue(baseAttachment())

    const res: any = await serveNewsAttachment(NEWS_ID, ATTACHMENT_ID, USER_ID)

    expect(res.headers['Content-Type']).toBe('application/pdf')
    expect(res.headers['Content-Disposition']).toMatch(/^inline;/)
  })

  it('sanea el originalName en Content-Disposition (comillas/CRLF)', async () => {
    ;(prisma.news_attachments.findFirst as jest.Mock).mockResolvedValue(
      baseAttachment({ originalName: 'a" \r\nb.pdf' })
    )

    const res: any = await serveNewsAttachment(NEWS_ID, ATTACHMENT_ID, USER_ID)

    expect(res.headers['Content-Disposition']).not.toMatch(/[\r\n]/)
  })

  it('respeta el guard de visibilidad: 403 si assertCanViewNews lo niega', async () => {
    ;(assertCanViewNews as jest.Mock).mockResolvedValue({ status: 403 })

    const res: any = await serveNewsAttachment(NEWS_ID, ATTACHMENT_ID, USER_ID)

    expect(res.status).toBe(403)
    expect(prisma.news_attachments.findFirst).not.toHaveBeenCalled()
  })
})
