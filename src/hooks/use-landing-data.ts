'use client'

import { useState, useEffect } from 'react'
import { setCachedBranding, clearCachedBranding } from '@/lib/branding-cache'

export { getCachedBranding } from '@/lib/branding-cache'

interface LandingData {
  companyName: string | null
  heroTitle: string | null
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
const listeners = new Set<(data: LandingData) => void>()

function emptyLandingData(): LandingData {
  return {
    companyName: null,
    heroTitle: null,
    companyLogoLightUrl: null,
    companyLogoDarkUrl: null,
    faviconUrl: null,
    metaTitle: null,
  }
}

function normalizeLogoUrl(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.startsWith('/uploads/')) return url.replace('/uploads/', '/api/uploads/')
  return url
}

function notifyListeners(data: LandingData) {
  listeners.forEach(listener => listener(data))
}

async function fetchLandingData(force = false): Promise<LandingData> {
  if (!force && cachedData) return cachedData

  if (!force && fetchPromise) return fetchPromise

  fetchPromise = fetch(
    force ? `/api/public/landing-page?_=${Date.now()}` : '/api/public/landing-page'
  )
    .then(res => res.json())
    .then(data => {
      const content = data.content || {}
      const result: LandingData = {
        companyName: content.companyName || null,
        heroTitle: content.heroTitle || null,
        companyLogoLightUrl: normalizeLogoUrl(content.companyLogoLightUrl),
        companyLogoDarkUrl: normalizeLogoUrl(content.companyLogoDarkUrl),
        faviconUrl: content.faviconUrl || null,
        metaTitle: content.metaTitle || null,
      }
      cachedData = result
      fetchPromise = null
      setCachedBranding({
        systemName: result.companyName,
        heroTitle: result.heroTitle,
      })
      notifyListeners(result)
      return result
    })
    .catch(() => {
      fetchPromise = null
      const fallback = emptyLandingData()
      return fallback
    })

  return fetchPromise
}

/**
 * Hook que provee datos de la landing page con caché en memoria.
 * Múltiples componentes pueden usarlo sin generar requests duplicados.
 * Se actualiza al guardar Configuración General o Página Pública.
 */
export function useLandingData(): LandingDataState {
  const [state, setState] = useState<LandingDataState>({
    data: cachedData || emptyLandingData(),
    loading: !cachedData,
  })

  useEffect(() => {
    const onUpdate = (data: LandingData) => {
      setState({ data, loading: false })
    }
    listeners.add(onUpdate)

    if (cachedData) {
      setState({ data: cachedData, loading: false })
    } else {
      fetchLandingData().then(data => {
        setState({ data, loading: false })
      })
    }

    const onExternalUpdate = () => {
      invalidateLandingCache()
      fetchLandingData(true).then(data => {
        setState({ data, loading: false })
      })
    }
    window.addEventListener('settings-updated', onExternalUpdate)
    window.addEventListener('landing-updated', onExternalUpdate)

    return () => {
      listeners.delete(onUpdate)
      window.removeEventListener('settings-updated', onExternalUpdate)
      window.removeEventListener('landing-updated', onExternalUpdate)
    }
  }, [])

  return state
}

/**
 * Invalida el caché para forzar un refetch (llamar después de actualizar la landing).
 */
export function invalidateLandingCache() {
  cachedData = null
  fetchPromise = null
  clearCachedBranding()
}
