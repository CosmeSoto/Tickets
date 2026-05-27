'use client'

import { useState, useEffect } from 'react'

interface LandingData {
  companyName: string | null
  companyLogoLightUrl: string | null
  companyLogoDarkUrl: string | null
  faviconUrl: string | null
  metaTitle: string | null
}

interface LandingDataState {
  data: LandingData
  loading: boolean
}

/**
 * Caché en memoria para evitar múltiples fetches al mismo endpoint.
 * Todos los componentes que necesitan datos de landing-page usan este hook.
 */
let cachedData: LandingData | null = null
let fetchPromise: Promise<LandingData> | null = null

function normalizeLogoUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.startsWith('/uploads/')) return url.replace('/uploads/', '/api/uploads/')
  return url
}

async function fetchLandingData(): Promise<LandingData> {
  if (cachedData) return cachedData

  if (!fetchPromise) {
    fetchPromise = fetch('/api/public/landing-page')
      .then(res => res.json())
      .then(data => {
        const content = data.content || {}
        const result: LandingData = {
          companyName: content.companyName || null,
          companyLogoLightUrl: normalizeLogoUrl(content.companyLogoLightUrl),
          companyLogoDarkUrl: normalizeLogoUrl(content.companyLogoDarkUrl),
          faviconUrl: content.faviconUrl || null,
          metaTitle: content.metaTitle || null,
        }
        cachedData = result
        fetchPromise = null
        return result
      })
      .catch(() => {
        fetchPromise = null
        return {
          companyName: null,
          companyLogoLightUrl: null,
          companyLogoDarkUrl: null,
          faviconUrl: null,
          metaTitle: null,
        }
      })
  }

  return fetchPromise
}

/**
 * Hook que provee datos de la landing page con caché en memoria.
 * Múltiples componentes pueden usarlo sin generar requests duplicados.
 */
export function useLandingData(): LandingDataState {
  const [state, setState] = useState<LandingDataState>({
    data: cachedData || {
      companyName: null,
      companyLogoLightUrl: null,
      companyLogoDarkUrl: null,
      faviconUrl: null,
      metaTitle: null,
    },
    loading: !cachedData,
  })

  useEffect(() => {
    if (cachedData) {
      setState({ data: cachedData, loading: false })
      return
    }

    fetchLandingData().then(data => {
      setState({ data, loading: false })
    })
  }, [])

  return state
}

/**
 * Invalida el caché para forzar un refetch (llamar después de actualizar la landing).
 */
export function invalidateLandingCache() {
  cachedData = null
  fetchPromise = null
}
