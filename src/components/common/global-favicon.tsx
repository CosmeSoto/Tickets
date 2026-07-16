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

    const upsert = (rel: string, type?: string) => {
      let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null
      if (link) {
        if (link.getAttribute('href') !== url) {
          link.setAttribute('href', url)
        }
        return
      }
      link = document.createElement('link')
      link.rel = rel
      link.href = url
      if (type) link.type = type
      document.head.appendChild(link)
    }

    upsert('icon', 'image/x-icon')
    upsert('apple-touch-icon')
  }, [data.faviconUrl, loading])

  return null
}
