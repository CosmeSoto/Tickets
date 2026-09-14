import { unlink } from 'fs/promises'
import path from 'path'
import { getUploadDir } from '@/lib/upload-path'

/**
 * Borra un archivo de foto de un `access_subject`, validando que el path
 * resuelto quede dentro del directorio de subida (`getUploadDir()`) — nunca
 * borra fuera de ese árbol aunque `photoPath` viniera corrupto o manipulado.
 * Silencioso si el archivo ya no existe (el registro de todos modos se
 * actualiza/elimina).
 */
export async function removeStoredAccessPhoto(photoPath: string | null | undefined) {
  if (!photoPath) return
  const resolved = path.resolve(photoPath)
  const root = path.resolve(getUploadDir())
  const prefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`
  if (resolved !== root && !resolved.startsWith(prefix)) return
  try {
    await unlink(resolved)
  } catch {
    // El archivo puede no existir; no es un error para quien llama.
  }
}
