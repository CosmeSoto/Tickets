'use client'

import { useState, useEffect } from 'react'

interface SystemLogos {
  lightUrl: string | null
  darkUrl: string | null
  companyName: string
  loading: boolean
}

/**
 * Normaliza URLs de logos: convierte /uploads/... → /api/uploads/...
 * para que funcionen con el file server dinámico
 */
function normalizeLogoUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.startsWith('/uploads/')) return url.replace('/uploads/', '/api/uploads/')
  return url
}

export function useSystemLogo(): SystemLogos {
  const [logos, setLogos] = useState<SystemLogos>({
    lightUrl: null,
    darkUrl: null,
    companyName: 'Sistema de Tickets',
    loading: true,
  })

  useEffect(() => {
    fetch('/api/public/landing-page')
      .then(res => res.json())
      .then(data => {
        setLogos({
          lightUrl: normalizeLogoUrl(data.content?.companyLogoLightUrl),
          darkUrl: normalizeLogoUrl(data.content?.companyLogoDarkUrl),
          companyName: data.content?.companyName || 'Sistema de Tickets',
          loading: false,
        })
      })
      .catch(err => {
        console.error('❌ useSystemLogo: Error loading logos:', err)
        setLogos(prev => ({ ...prev, loading: false }))
      })
  }, [])

  return logos
}
