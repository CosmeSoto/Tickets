'use client'

import { useEffect } from 'react'
import { useLandingData } from '@/hooks/use-landing-data'

/**
 * Actualiza el favicon desde la configuración del sistema.
 * Solo modifica href de links existentes o crea uno si no hay;
 * nunca elimina nodos del <head> (rompe el head manager de Next.js).
 */
export function GlobalFavicon() {
  const { data, loading } = useLandingData()

  useEffect(() => {
    if (loading || !data.faviconUrl) return

    const url = data.faviconUrl

    // El `type` debe coincidir con el archivo real subido (png/webp/jpg/svg) —
    // si se declara 'image/x-icon' para un PNG, algunos navegadores ignoran el link.
    const MIME_BY_EXT: Record<string, string> = {
      ico: 'image/x-icon',
      png: 'image/png',
      webp: 'image/webp',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      svg: 'image/svg+xml',
    }
    const ext = url.split('.').pop()?.toLowerCase().split('?')[0] ?? ''
    const mimeType = MIME_BY_EXT[ext] ?? 'image/x-icon'

    const upsert = (rel: string, type?: string) => {
      let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null
      if (link) {
        if (link.getAttribute('href') !== url) {
          link.setAttribute('href', url)
        }
        if (type) link.type = type
        return
      }
      link = document.createElement('link')
      link.rel = rel
      link.href = url
      if (type) link.type = type
      document.head.appendChild(link)
    }

    upsert('icon', mimeType)
    upsert('apple-touch-icon')
  }, [data.faviconUrl, loading])

  return null
}
