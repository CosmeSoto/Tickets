'use client'

import { useLandingData } from '@/hooks/use-landing-data'
import { DEFAULT_SYSTEM_NAME } from '@/lib/branding-constants'

interface SystemLogos {
  lightUrl: string | null
  darkUrl: string | null
  companyName: string
  loading: boolean
}

/**
 * Hook que provee las URLs de logos del sistema.
 * Usa el hook compartido useLandingData para evitar requests duplicados.
 */
export function useSystemLogo(): SystemLogos {
  const { data, loading } = useLandingData()

  return {
    lightUrl: data.companyLogoLightUrl,
    darkUrl: data.companyLogoDarkUrl,
    companyName: data.companyName || DEFAULT_SYSTEM_NAME,
    loading,
  }
}
