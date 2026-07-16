'use client'

import { useEffect } from 'react'

interface DynamicFaviconProps {
  faviconUrl?: string
}

/**
 * Actualiza el favicon sin destruir nodos del <head>.
 * No usar link.remove() — Next.js gestiona el head en navegaciones
 * client-side y removeChild sobre nodos ajenos provoca el crash
 * "Cannot read properties of null (reading 'removeChild')".
 */
export function DynamicFavicon({ faviconUrl }: DynamicFaviconProps) {
  useEffect(() => {
    if (!faviconUrl) return

    const upsert = (rel: string, type?: string) => {
      let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null
      if (link) {
        if (link.href !== faviconUrl) link.href = faviconUrl
        return
      }
      link = document.createElement('link')
      link.rel = rel
      link.href = faviconUrl
      if (type) link.type = type
      document.head.appendChild(link)
    }

    upsert('icon', 'image/x-icon')
    upsert('apple-touch-icon')
  }, [faviconUrl])

  return null
}
