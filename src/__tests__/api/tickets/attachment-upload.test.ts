/**
 * FileService.uploadFile / uploadBase64Attachment (adjuntos de tickets)
 *
 * Mismo bug ya corregido en Noticias/Documentos esta sesión: la única
 * validación de tipo comparaba `file.type`/`params.mimeType` — declarado por
 * quien sube el archivo, trivialmente falsificable — contra una lista
 * configurable, sin magic bytes. La extensión final en disco salía de
 * `file.name`/`params.originalName` para cualquier archivo que no fuera
 * imagen comprimible. `uploadBase64Attachment` es el que usa la creación de
 * ticket con evidencia de patrulla (`ticketData.photoBase64`/`photoMimeType`
 * llegan directo del body del cliente) — mismo vector, sin multipart de por medio.
 */

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    tickets: { findUnique: jest.fn() },
    attachments: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
    ticket_history: { create: jest.fn() },
    // Sin fila -> CloudStorageService.getActiveProvider() resuelve a 'local'.
    system_settings: { findUnique: jest.fn().mockResolvedValue(null) },
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

const TICKET_ID = 'ticket-1'
const UPLOADER_ID = 'tech-1'

const PDF_MAGIC = Buffer.from('%PDF-1.4\n%rest of a real pdf...')
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
const HTML_PAYLOAD = Buffer.from('<html><script>alert(document.cookie)</script></html>')

function makeFile(buf: Buffer, name: string, type: string): File {
  const file = new File([new Uint8Array(buf)], name, { type })
  ;(file as any).arrayBuffer = async () =>
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  return file
}

describe('FileService.uploadFile (adjuntos de tickets)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.tickets.findUnique as jest.Mock).mockResolvedValue({ id: TICKET_ID })
    ;(prisma.attachments.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.attachments.create as jest.Mock).mockImplementation(({ data }) => data)
  })

  it('rechaza un HTML disfrazado de PDF (Content-Type falsificado) — no escribe ni registra nada', async () => {
    const file = makeFile(HTML_PAYLOAD, 'evil.html', 'application/pdf')

    await expect(
      FileService.uploadFile({ file, ticketId: TICKET_ID, uploadedBy: UPLOADER_ID })
    ).rejects.toThrow(/no coincide con su tipo/)

    expect(writeFile).not.toHaveBeenCalled()
    expect(prisma.attachments.create).not.toHaveBeenCalled()
  })

  it('un PDF real con nombre .php termina guardado con extensión .pdf, nunca .php', async () => {
    const file = makeFile(PDF_MAGIC, 'x.php', 'application/pdf')

    const attachment = await FileService.uploadFile({
      file,
      ticketId: TICKET_ID,
      uploadedBy: UPLOADER_ID,
    })

    expect(attachment.filename).toMatch(/\.pdf$/)
    expect(attachment.filename).not.toContain('php')
  })

  it('una imagen PNG real con nombre .html termina guardada como .webp/.jpg, nunca .html', async () => {
    const file = makeFile(PNG_MAGIC, 'evil.html', 'image/png')

    const attachment = await FileService.uploadFile({
      file,
      ticketId: TICKET_ID,
      uploadedBy: UPLOADER_ID,
    })

    expect(attachment.filename).toMatch(/\.(webp|jpg)$/)
  })
})

describe('FileService.uploadBase64Attachment (evidencia de patrulla en creación de ticket)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.tickets.findUnique as jest.Mock).mockResolvedValue({ id: TICKET_ID })
    ;(prisma.attachments.create as jest.Mock).mockImplementation(({ data }) => data)
  })

  it('rechaza un script disfrazado de imagen (mimeType declarado falsificado)', async () => {
    await expect(
      FileService.uploadBase64Attachment({
        ticketId: TICKET_ID,
        uploadedBy: UPLOADER_ID,
        base64: `data:image/png;base64,${HTML_PAYLOAD.toString('base64')}`,
        mimeType: 'image/png',
        originalName: 'evidencia.png',
      })
    ).rejects.toThrow(/no coincide con su tipo/)

    expect(writeFile).not.toHaveBeenCalled()
  })

  it('una foto real (JPEG/PNG) pasa y guarda con la extensión del contenido detectado', async () => {
    const attachment = await FileService.uploadBase64Attachment({
      ticketId: TICKET_ID,
      uploadedBy: UPLOADER_ID,
      base64: `data:image/png;base64,${PNG_MAGIC.toString('base64')}`,
      mimeType: 'image/png',
      originalName: 'evidencia.exe',
    })

    expect(attachment.filename).toMatch(/\.(webp|jpg|png)$/)
    expect(attachment.filename).not.toContain('exe')
  })
})
