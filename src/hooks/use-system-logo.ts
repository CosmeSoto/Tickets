'use client'

import { useState, useEffect } from 'react'

interface SystemLogos {
  lightUrl: string | null
  darkUrl: string | null
  companyName: string
  loading: boolean
}

export function useSystemLogo(): SystemLogos {
  const [logos, setLogos] = useState<SystemLogos>({
    lightUrl: null,
    darkUrl: null,
    companyName: 'Sistema de Tickets',
    loading: true,
  })

  useEffect(() => {
    console.log('🔍 useSystemLogo: Fetching logos...')
    fetch('/api/public/landing-page')
      .then(res => res.json())
      .then(data => {
        console.log('✅ useSystemLogo: Data received:', {
          lightUrl: data.content?.companyLogoLightUrl,
          darkUrl: data.content?.companyLogoDarkUrl,
          companyName: data.content?.companyName,
        })
        setLogos({
          lightUrl: data.content?.companyLogoLightUrl || null,
          darkUrl: data.content?.companyLogoDarkUrl || null,
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
