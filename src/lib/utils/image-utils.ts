/**
 * Utilidad global de compresión de imágenes en el cliente.
 * Usa el Canvas API del navegador — sin dependencias externas.
 *
 * Reutilizable en todos los módulos (tickets, inventario, patrullas).
 *
 * @example
 * const compressed = await compressImageFile(file, { maxWidthPx: 1280, quality: 0.82 })
 * const base64 = await fileToBase64(compressed)
 */

export interface CompressOptions {
  /** Ancho máximo en píxeles. La imagen se redimensiona manteniendo proporción. Default: 1280 */
  maxWidthPx?: number
  /** Calidad JPEG/WebP (0.0–1.0). Default: 0.82 */
  quality?: number
}

/**
 * Comprime una imagen usando el Canvas API del navegador.
 *
 * - Preserva la proporción de aspecto.
 * - No amplía imágenes más pequeñas que maxWidthPx.
 * - Retorna el archivo original sin modificar si:
 *   - El MIME type no es una imagen
 *   - El resultado comprimido es más grande que el original
 *   - El entorno no soporta Canvas (SSR)
 */
export async function compressImageFile(file: File, options: CompressOptions = {}): Promise<File> {
  const { maxWidthPx = 1280, quality = 0.82 } = options

  // Solo comprimir imágenes
  if (!file.type.startsWith('image/')) return file

  // Canvas no disponible en SSR
  if (typeof window === 'undefined' || typeof document === 'undefined') return file

  try {
    // Crear bitmap desde el archivo
    const bitmap = await createImageBitmap(file)

    // Calcular dimensiones respetando proporción
    let { width, height } = bitmap
    if (width > maxWidthPx) {
      height = Math.round((height * maxWidthPx) / width)
      width = maxWidthPx
    }

    // Dibujar en canvas
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return file
    }
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    // Convertir a Blob
    const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, outputType, quality)
    )

    if (!blob) return file

    // Si el resultado es más grande, devolver el original
    if (blob.size >= file.size) return file

    return new File([blob], file.name, { type: outputType, lastModified: Date.now() })
  } catch {
    // Cualquier error → devolver original sin modificar
    return file
  }
}

/**
 * Convierte un File a string base64 (sin prefijo data:...).
 * Útil para enviar imágenes al servidor como JSON.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Remover prefijo "data:image/jpeg;base64,"
      const base64 = result.split(',')[1] ?? result
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Convierte un File a data URL completo (con prefijo data:...).
 * Útil para previsualizaciones en <img src=...>.
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
