/**
 * Detección de tipo de archivo por CONTENIDO (magic bytes), no por lo que
 * declara el cliente. El pipeline de subida de adjuntos (`FileService`,
 * `src/lib/services/file-service.ts`) validaba el tipo comparando
 * `file.type` — el `Content-Type` que manda el propio cliente en el
 * multipart, trivialmente falsificable — contra una lista configurable, y
 * la extensión final para el archivo en disco se tomaba literalmente de
 * `file.name.split('.').pop()` cuando el archivo no era una imagen
 * comprimible. Un adjunto `evil.html` declarado como `application/pdf`
 * pasaba la validación y se guardaba como `<uuid>.html`.
 *
 * Este módulo es la única fuente de verdad para "qué es realmente este
 * archivo" y "qué extensión le corresponde en disco" — la extensión NUNCA
 * sale del nombre que manda el cliente.
 */

export type SafeUploadMime =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/gif'
  | 'application/pdf'
  | 'text/plain'
  | 'application/msword'
  | 'application/vnd.ms-excel'
  | 'application/vnd.ms-powerpoint'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  | 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

/** Extensión en disco derivada siempre del mime detectado — nunca del nombre del cliente. */
export const EXT_BY_MIME: Record<SafeUploadMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'application/msword': 'doc',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
}

/**
 * Solo estos tipos se muestran `inline` (imagen/PDF en el visor embebido).
 * Todo lo demás se fuerza a descarga (`Content-Disposition: attachment`),
 * y si el `mimeType` guardado en BD no está en esta lista tampoco se
 * confía en él para el `Content-Type` de la respuesta.
 */
export const INLINE_SAFE_MIMES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
])

type SignatureFamily = 'jpeg' | 'png' | 'gif' | 'webp' | 'pdf' | 'zip' | 'ole' | 'text' | null

/** Detecta la familia de archivo por sus primeros bytes (magic numbers). */
function detectUploadSignature(buf: Buffer): SignatureFamily {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg'
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return 'png'
  }
  if (buf.length >= 6 && buf.toString('ascii', 0, 3) === 'GIF' && buf[3] === 0x38) return 'gif'
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp'
  }
  if (buf.length >= 5 && buf.toString('ascii', 0, 5) === '%PDF-') return 'pdf'
  // ZIP local-file-header: contenedor de OOXML (docx/xlsx) — necesita el tipo
  // declarado para desambiguar cuál de los dos es.
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    return 'zip'
  }
  // OLE Compound File: contenedor de Office legado (doc/xls).
  if (
    buf.length >= 8 &&
    buf[0] === 0xd0 &&
    buf[1] === 0xcf &&
    buf[2] === 0x11 &&
    buf[3] === 0xe0 &&
    buf[4] === 0xa1 &&
    buf[5] === 0xb1 &&
    buf[6] === 0x1a &&
    buf[7] === 0xe1
  ) {
    return 'ole'
  }
  // Texto plano: sin bytes NUL en los primeros 1KB (heurística estándar
  // para distinguir binario de texto sin depender de una firma fija).
  const sample = buf.subarray(0, Math.min(buf.length, 1024))
  if (sample.length > 0 && !sample.includes(0)) return 'text'
  return null
}

const OOXML_MIMES: ReadonlySet<string> = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
])
const OLE_MIMES: ReadonlySet<string> = new Set([
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
])

/**
 * Cruza la firma real del contenido con el tipo que declaró el cliente y
 * devuelve el mime CANÓNICO si coinciden, o `null` si el contenido no es lo
 * que dice ser (p. ej. un `.html`/`.svg`/`.js` disfrazado de PDF o de
 * imagen). `zip`/`ole` son contenedores ambiguos: solo se aceptan si el tipo
 * declarado corresponde a una de las variantes válidas de ese contenedor.
 */
export function resolveSafeUploadMime(buf: Buffer, declaredType: string): SafeUploadMime | null {
  const signature = detectUploadSignature(buf)
  switch (signature) {
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    case 'pdf':
      return 'application/pdf'
    case 'zip':
      return OOXML_MIMES.has(declaredType) ? (declaredType as SafeUploadMime) : null
    case 'ole':
      return OLE_MIMES.has(declaredType) ? (declaredType as SafeUploadMime) : null
    case 'text':
      return declaredType === 'text/plain' ? 'text/plain' : null
    default:
      return null
  }
}

/**
 * Nombre saneado para `Content-Disposition` / mostrar en UI: sin separadores
 * de ruta, caracteres de control, comillas ni CRLF (evita corromper la
 * cabecera o inyectar contenido). Se acorta a 150 caracteres.
 */
export function sanitizeOriginalFilename(name: string): string {
  const cleaned = name
    .replace(/[/\\]/g, '_')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/["]/g, "'")
    .trim()
  return (cleaned || 'archivo').slice(0, 150)
}

/** `Content-Disposition` seguro — ASCII saneado + `filename*` RFC 5987 para el nombre real (con acentos, etc.). */
export function buildContentDisposition(originalName: string, inline: boolean): string {
  const safe = sanitizeOriginalFilename(originalName)
  const asciiFallback = safe.replace(/[^\x20-\x7e]/g, '_')
  const encoded = encodeURIComponent(safe)
  const disposition = inline ? 'inline' : 'attachment'
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`
}
