/**
 * Descarga un archivo desde una ruta API autenticada.
 * Evita que errores JSON se guarden como "template.json" con <a download>.
 */
export async function downloadFileFromApi(
  url: string,
  fallbackFilename: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(url, { credentials: 'same-origin' })

  const contentType = res.headers.get('Content-Type') ?? ''

  if (!res.ok) {
    try {
      const data = (await res.json()) as { error?: string }
      return { ok: false, error: data.error ?? `Error al descargar (${res.status})` }
    } catch {
      return { ok: false, error: `Error al descargar (${res.status})` }
    }
  }

  if (contentType.includes('application/json')) {
    try {
      const data = (await res.json()) as { error?: string }
      return {
        ok: false,
        error: data.error ?? 'El servidor no devolvió un archivo válido',
      }
    } catch {
      return { ok: false, error: 'El servidor no devolvió un archivo válido' }
    }
  }

  const blob = await res.blob()
  if (blob.size === 0) {
    return { ok: false, error: 'El archivo descargado está vacío' }
  }

  const disposition = res.headers.get('Content-Disposition') ?? ''
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  const asciiMatch = disposition.match(/filename="?([^";]+)"?/i)
  const filename = decodeURIComponent(utf8Match?.[1] ?? asciiMatch?.[1] ?? fallbackFilename)

  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)

  return { ok: true }
}
