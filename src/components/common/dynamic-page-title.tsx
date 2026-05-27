'use client'

import { useEffect } from 'react'
import { useLandingData } from '@/hooks/use-landing-data'

interface DynamicPageTitleProps {
  defaultTitle?: string
}

/**
 * Componente que actualiza el título de la página dinámicamente.
 * Usa el hook compartido useLandingData para evitar requests duplicados.
 */
export function DynamicPageTitle({
  defaultTitle = 'Sistema de Tickets - Soporte Técnico',
}: DynamicPageTitleProps) {
  const { data, loading } = useLandingData()

  useEffect(() => {
    if (loading) return
    document.title = data.metaTitle || defaultTitle
  }, [data.metaTitle, loading, defaultTitle])

  return null
}
