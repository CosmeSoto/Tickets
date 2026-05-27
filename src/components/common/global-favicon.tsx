'use client'

import { useEffect } from 'react'
import { useLandingData } from '@/hooks/use-landing-data'

/**
 * Componente que actualiza el favicon dinámicamente desde la configuración del sistema.
 * Usa el hook compartido useLandingData para evitar requests duplicados.
 * Manipula solo los atributos href de links existentes o crea nuevos de forma segura.
 */
export function GlobalFavicon() {
  const { data, loading } = useLandingData()

  useEffect(() => {
    if (loading || !data.faviconUrl) return

    const url = data.faviconUrl

    // Actualizar o crear link[rel="icon"]
    let iconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null
    if (iconLink) {
      iconLink.href = url
    } else {
      iconLink = document.createElement('link')
      iconLink.rel = 'icon'
      iconLink.href = url
      iconLink.type = 'image/x-icon'
      document.head.appendChild(iconLink)
    }

    // Actualizar o crear link[rel="apple-touch-icon"]
    let appleLink = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null
    if (appleLink) {
      appleLink.href = url
    } else {
      appleLink = document.createElement('link')
      appleLink.rel = 'apple-touch-icon'
      appleLink.href = url
      document.head.appendChild(appleLink)
    }
  }, [data.faviconUrl, loading])

  return null
}
