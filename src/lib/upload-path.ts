import { join } from 'path'

/**
 * Directorio base para uploads.
 * Usa UPLOAD_DIR si está definido (útil en producción/Docker),
 * de lo contrario usa public/uploads relativo al cwd.
 */
export function getUploadDir(...segments: string[]): string {
  const base = process.env.UPLOAD_DIR || join(process.cwd(), 'public', 'uploads')
  return segments.length > 0 ? join(base, ...segments) : base
}
