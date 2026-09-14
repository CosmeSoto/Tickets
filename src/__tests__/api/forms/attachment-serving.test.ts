/**
 * serveFormAttachment — cuerpo compartido de las rutas de adjuntos de
 * Documentos, paralelo a `serveNewsAttachment` (Noticias).
 *
 * Regresión 1: un adjunto de OTRO documento (`attachmentId` ajeno) nunca debe
 * leerse — el where de `findFirst` lleva `formId` además de `id`.
 *
 * Regresión 2 (la importante): el `Content-Type` de la respuesta usaba
 * `attachment.mimeType` tal cual viniera de BD — antes del fix de magic-bytes
 * en `FileService.uploadFormFile` ese valor era el declarado por el cliente.
 * Un adjunto legado con `mimeType: 'text/html'` se servía como HTML
 * ejecutable. El fix solo confía en `INLINE_SAFE_MIMES`; cualquier otra cosa
 * se fuerza a `application/octet-stream` + descarga.
 */

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    form_attachments: { findFirst: jest.fn() },
  },
}))

jest.mock('@/lib/forms/form-visibility', () => ({
  assertCanViewForm: jest.fn().mockResolvedValue(null),
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
import { assertCanViewForm } from '@/lib/forms/form-visibility'
import { serveFormAttachment } from '@/lib/forms/serve-form-attachment'

const FORM_ID = 'form-1'
const ATTACHMENT_ID = 'att-1'
const USER_ID = 'user-1'

function baseAttachment(overrides: Record<string, unknown> = {}) {
  return {
    id: ATTACHMENT_ID,
    formId: FORM_ID,
    path: '/uploads/forms/form-1/x.pdf',
    originalName: 'informe.pdf',
    mimeType: 'application/pdf',
    ...overrides,
  }
}

describe('serveFormAttachment', () => {
  beforeEach(() => jest.clearAllMocks())

  it('busca el adjunto con formId en el where (no findUnique + comparación manual)', async () => {
    ;(prisma.form_attachments.findFirst as jest.Mock).mockResolvedValue(baseAttachment())

    await serveFormAttachment(FORM_ID, ATTACHMENT_ID, USER_ID, false)

    expect(prisma.form_attachments.findFirst).toHaveBeenCalledWith({
      where: { id: ATTACHMENT_ID, formId: FORM_ID },
    })
  })

  it('404 si el adjunto pertenece a otro documento', async () => {
    ;(prisma.form_attachments.findFirst as jest.Mock).mockResolvedValue(null)

    const res: any = await serveFormAttachment(FORM_ID, ATTACHMENT_ID, USER_ID, false)

    expect(res.status).toBe(404)
  })

  it('sirve un mime legado peligroso como octet-stream + descarga forzada (regresión de XSS)', async () => {
    ;(prisma.form_attachments.findFirst as jest.Mock).mockResolvedValue(
      baseAttachment({ mimeType: 'text/html', originalName: 'legado.html' })
    )

    const res: any = await serveFormAttachment(FORM_ID, ATTACHMENT_ID, USER_ID, false)

    expect(res.headers['Content-Type']).toBe('application/octet-stream')
    expect(res.headers['Content-Disposition']).toMatch(/^attachment;/)
    expect(res.headers['X-Content-Type-Options']).toBe('nosniff')
  })

  it('un PDF legítimo se sirve inline con su mime real', async () => {
    ;(prisma.form_attachments.findFirst as jest.Mock).mockResolvedValue(baseAttachment())

    const res: any = await serveFormAttachment(FORM_ID, ATTACHMENT_ID, USER_ID, false)

    expect(res.headers['Content-Type']).toBe('application/pdf')
    expect(res.headers['Content-Disposition']).toMatch(/^inline;/)
  })

  it('con download=true fuerza descarga aunque el mime sea inline-safe', async () => {
    ;(prisma.form_attachments.findFirst as jest.Mock).mockResolvedValue(baseAttachment())

    const res: any = await serveFormAttachment(FORM_ID, ATTACHMENT_ID, USER_ID, true)

    expect(res.headers['Content-Disposition']).toMatch(/^attachment;/)
  })

  it('sanea el originalName en Content-Disposition (comillas/CRLF)', async () => {
    ;(prisma.form_attachments.findFirst as jest.Mock).mockResolvedValue(
      baseAttachment({ originalName: 'a" \r\nb.pdf' })
    )

    const res: any = await serveFormAttachment(FORM_ID, ATTACHMENT_ID, USER_ID, false)

    expect(res.headers['Content-Disposition']).not.toMatch(/[\r\n]/)
  })

  it('respeta el guard de visibilidad: 403 si assertCanViewForm lo niega', async () => {
    ;(assertCanViewForm as jest.Mock).mockResolvedValue({ status: 403 })

    const res: any = await serveFormAttachment(FORM_ID, ATTACHMENT_ID, USER_ID, false)

    expect(res.status).toBe(403)
    expect(prisma.form_attachments.findFirst).not.toHaveBeenCalled()
  })
})
