/**
 * FileService.uploadNewsFile — seguridad del pipeline de adjuntos de noticias
 *
 * Bug real: la extensión final en disco se tomaba de
 * `file.name.split('.').pop()` cuando el archivo no era una imagen
 * comprimible, y la única validación de tipo (`SecurityConfigService.
 * validateFileType`) comparaba `file.type` — el Content-Type que manda el
 * propio cliente en el multipart, trivialmente falsificable — contra una
 * lista configurable. Un `evil.html` declarado `application/pdf` pasaba la
 * validación y se guardaba como `<uuid>.html` en `public/uploads/news/...`,
 * servido más tarde sin ningún control de tipo real.
 *
 * El fix (resolveSafeUploadMime, src/lib/files/upload-file-type.ts) cruza el
 * contenido real (magic bytes) con el tipo declarado; la extensión en disco
 * sale siempre de ese mime detectado, nunca del nombre que manda el cliente.
 */

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    news: { findUnique: jest.fn() },
    news_attachments: { create: jest.fn() },
  },
}))

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
}))

jest.mock('fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn(),
}))

jest.mock('@/lib/upload-path', () => ({
  getUploadDir: (...segments: string[]) => ['/uploads', ...segments].join('/'),
}))

jest.mock('@/lib/services/security-config-service', () => ({
  SecurityConfigService: {
    validateFileSize: jest.fn().mockResolvedValue({ valid: true }),
    validateFileType: jest.fn().mockResolvedValue({ valid: true }),
  },
}))

import prisma from '@/lib/prisma'
import { writeFile } from 'fs/promises'
import { FileService } from '@/lib/services/file-service'

const NEWS_ID = 'news-1'
const UPLOADER_ID = 'admin-1'

const PDF_MAGIC = Buffer.from('%PDF-1.4\n%rest of a real pdf...')
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
const HTML_PAYLOAD = Buffer.from('<html><script>alert(document.cookie)</script></html>')

function makeFile(buf: Buffer, name: string, type: string): File {
  const file = new File([new Uint8Array(buf)], name, { type })
  ;(file as any).arrayBuffer = async () =>
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  return file
}

describe('FileService.uploadNewsFile', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.news.findUnique as jest.Mock).mockResolvedValue({ id: NEWS_ID })
    ;(prisma.news_attachments.create as jest.Mock).mockImplementation(({ data }) => data)
  })

  it('rechaza un HTML disfrazado de PDF (Content-Type falsificado) — no escribe ni registra nada', async () => {
    const file = makeFile(HTML_PAYLOAD, 'evil.html', 'application/pdf')

    await expect(
      FileService.uploadNewsFile({ file, newsId: NEWS_ID, uploadedBy: UPLOADER_ID })
    ).rejects.toThrow(/no coincide con su tipo/)

    expect(writeFile).not.toHaveBeenCalled()
    expect(prisma.news_attachments.create).not.toHaveBeenCalled()
  })

  it('rechaza un script disfrazado de imagen (Content-Type falsificado)', async () => {
    const file = makeFile(Buffer.from('<script>evil()</script>'), 'evil.svg', 'image/png')

    await expect(
      FileService.uploadNewsFile({ file, newsId: NEWS_ID, uploadedBy: UPLOADER_ID })
    ).rejects.toThrow(/no coincide con su tipo/)
    expect(writeFile).not.toHaveBeenCalled()
  })

  it('un PDF real con nombre .php termina guardado con extensión .pdf, nunca .php', async () => {
    const file = makeFile(PDF_MAGIC, 'x.php', 'application/pdf')

    const attachment = await FileService.uploadNewsFile({
      file,
      newsId: NEWS_ID,
      uploadedBy: UPLOADER_ID,
    })

    expect(attachment.filename).toMatch(/\.pdf$/)
    expect(attachment.filename).not.toContain('php')
    expect(attachment.mimeType).toBe('application/pdf')
  })

  it('una imagen PNG real con nombre .html termina guardada como .webp (recomprimida), nunca .html', async () => {
    const file = makeFile(PNG_MAGIC, 'evil.html', 'image/png')

    const attachment = await FileService.uploadNewsFile({
      file,
      newsId: NEWS_ID,
      uploadedBy: UPLOADER_ID,
    })

    expect(attachment.filename).toMatch(/\.(webp|jpg)$/)
    expect(attachment.filename).not.toContain('html')
  })

  it('sanea el originalName (comillas y saltos de línea) antes de guardarlo', async () => {
    const file = makeFile(PDF_MAGIC, 'informe" \r\nmalicioso.pdf', 'application/pdf')

    const attachment = await FileService.uploadNewsFile({
      file,
      newsId: NEWS_ID,
      uploadedBy: UPLOADER_ID,
    })

    expect(attachment.originalName).not.toMatch(/["\r\n]/)
  })
})
