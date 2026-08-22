/**
 * Gmail/Outlook bloquean data:image y URLs de LAN (10.x). El QR de credenciales
 * debe ir como CID inline + adjunto descargable.
 */

import type { Attachment } from 'nodemailer/lib/mailer'

export type SerializedEmailAttachment = {
  filename: string
  contentBase64: string
  contentType: string
  cid?: string
  contentDisposition?: 'inline' | 'attachment'
}

const DATA_URI_IMG =
  /(<img\b[^>]*?\bsrc\s*=\s*)(["'])(data:image\/(png|jpe?g|gif|webp);base64,([A-Za-z0-9+/=\s]+))\2/gi

function sanitizeFilename(raw: string, fallback: string): string {
  const cleaned = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return cleaned || fallback
}

function extForMime(mime: string): string {
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg'
  if (mime.includes('gif')) return 'gif'
  if (mime.includes('webp')) return 'webp'
  return 'png'
}

function altFromTag(tagPrefix: string): string | null {
  const match = tagPrefix.match(/\balt\s*=\s*["']([^"']+)["']/i)
  return match?.[1]?.trim() || null
}

function pushImageAttachments(
  attachments: Attachment[],
  content: Buffer,
  mime: string,
  alt: string | null,
  index: number
): string {
  const cid = `img-${index}@tickets`
  const ext = extForMime(mime)
  const baseName = sanitizeFilename(alt || `imagen-${index}`, `imagen-${index}`)
  const inlineName = `${baseName}.${ext}`

  attachments.push({
    filename: inlineName,
    content,
    contentType: mime,
    cid,
    contentDisposition: 'inline',
  })
  attachments.push({
    filename: /qr|codigo/i.test(inlineName) ? inlineName : `codigo-qr-${index}.${ext}`,
    content,
    contentType: mime,
    contentDisposition: 'attachment',
  })
  return cid
}

/**
 * Reemplaza <img src="data:image/..."> por cid: y genera adjuntos inline + copia descargable.
 */
export function inlineDataImagesForEmail(html: string): {
  html: string
  attachments: Attachment[]
} {
  if (!html || !html.includes('data:image/')) {
    return { html, attachments: [] }
  }

  const attachments: Attachment[] = []
  let index = 0

  const rewritten = html.replace(
    DATA_URI_IMG,
    (full, prefix: string, quote: string, _src, mimeSubtype: string, b64: string) => {
      const mime = `image/${mimeSubtype === 'jpg' ? 'jpeg' : mimeSubtype}`
      const content = Buffer.from(b64.replace(/\s+/g, ''), 'base64')
      if (content.length < 32) return full

      index += 1
      const cid = pushImageAttachments(attachments, content, mime, altFromTag(prefix), index)
      return `${prefix}${quote}cid:${cid}${quote}`
    }
  )

  return { html: rewritten, attachments }
}

function allowedImageOrigins(): Set<string> {
  const origins = new Set<string>([
    'http://127.0.0.1:3000',
    'http://localhost:3000',
    'http://app:3000',
  ])
  const raw = process.env.NEXTAUTH_URL?.trim()
  if (raw) {
    try {
      origins.add(new URL(raw).origin)
    } catch {
      /* ignore */
    }
  }
  return origins
}

function rewriteFetchUrl(src: string): string {
  const nextAuth = process.env.NEXTAUTH_URL?.replace(/\/$/, '')
  if (nextAuth && src.startsWith(nextAuth)) {
    return `http://127.0.0.1:3000${src.slice(nextAuth.length)}`
  }
  return src
}

const HTTP_IMG = /(<img\b[^>]*?\bsrc\s*=\s*)(["'])(https?:\/\/[^"']+|\/[^"']+)\2/gi

/**
 * Descarga imágenes del propio sistema (LAN/NEXTAUTH_URL) y las incrusta como CID.
 * Gmail no puede cargar http://10.x ni rutas que piden login.
 */
export async function inlineAppImagesForEmail(html: string): Promise<{
  html: string
  attachments: Attachment[]
}> {
  const dataInlined = inlineDataImagesForEmail(html)
  html = dataInlined.html
  const attachments = [...dataInlined.attachments]
  const allowed = allowedImageOrigins()
  const matches = [...html.matchAll(HTTP_IMG)]
  if (matches.length === 0) return { html, attachments }

  let index = dataInlined.attachments.filter(a => a.contentDisposition === 'inline').length
  let rewritten = html

  for (const match of matches) {
    const prefix = match[1]
    const quote = match[2]
    let src = match[3]
    if (src.startsWith('cid:')) continue
    if (src.startsWith('/')) {
      src = `http://127.0.0.1:3000${src}`
    }
    let origin: string
    try {
      origin = new URL(src).origin
    } catch {
      continue
    }
    if (!allowed.has(origin) && !src.startsWith('http://127.0.0.1:3000')) continue

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 4000)
      const res = await fetch(rewriteFetchUrl(src), { signal: controller.signal })
      clearTimeout(timer)
      if (!res.ok) continue
      const mime = (res.headers.get('content-type') || 'image/png').split(';')[0].trim()
      if (!mime.startsWith('image/')) continue
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length < 32 || buf.length > 1_500_000) continue
      index += 1
      const cid = pushImageAttachments(attachments, buf, mime, altFromTag(prefix), index)
      rewritten = rewritten.replace(match[0], `${prefix}${quote}cid:${cid}${quote}`)
    } catch {
      /* dejar src original si no se pudo incrustar */
    }
  }

  return { html: rewritten, attachments }
}

export function serializeAttachments(attachments: Attachment[]): SerializedEmailAttachment[] {
  return attachments
    .map(att => {
      const buf = toBuffer(att.content)
      if (!buf) return null
      return {
        filename: att.filename || 'adjunto.bin',
        contentBase64: buf.toString('base64'),
        contentType: att.contentType || 'application/octet-stream',
        cid: typeof att.cid === 'string' ? att.cid : undefined,
        contentDisposition: att.contentDisposition === 'inline' ? 'inline' : 'attachment',
      } as SerializedEmailAttachment
    })
    .filter((a): a is SerializedEmailAttachment => a !== null)
}

export function deserializeAttachments(
  rows: SerializedEmailAttachment[] | undefined
): Attachment[] {
  if (!rows?.length) return []
  return rows.map(row => ({
    filename: row.filename,
    content: Buffer.from(row.contentBase64, 'base64'),
    contentType: row.contentType,
    cid: row.cid,
    contentDisposition: row.contentDisposition || (row.cid ? 'inline' : 'attachment'),
  }))
}

function toBuffer(content: Attachment['content']): Buffer | null {
  if (!content) return null
  if (Buffer.isBuffer(content)) return content
  if (typeof content === 'string') return Buffer.from(content)
  return null
}

export function parseQueuedAttachments(templateData: unknown): {
  rest: Record<string, unknown>
  attachments: Attachment[]
} {
  let parsed: Record<string, unknown> = {}
  if (typeof templateData === 'string' && templateData.trim()) {
    try {
      parsed = JSON.parse(templateData) as Record<string, unknown>
    } catch {
      parsed = {}
    }
  } else if (templateData && typeof templateData === 'object') {
    parsed = { ...(templateData as Record<string, unknown>) }
  }

  const serialized = parsed.__attachments as SerializedEmailAttachment[] | undefined
  const { __attachments: _attachments, ...rest } = parsed
  void _attachments
  return { rest, attachments: deserializeAttachments(serialized) }
}
