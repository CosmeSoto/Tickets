'use client'

import { useEffect } from 'react'
import { useLandingData } from '@/hooks/use-landing-data'
import { DEFAULT_PAGE_TITLE } from '@/lib/branding-constants'

interface DynamicPageTitleProps {
  defaultTitle?: string
}

/**
 * Actualiza el título del tab del navegador dinámicamente desde BD.
 *
 * Prioridad (alineada con Configuración):
 *   1. companyName + heroTitle  (Nombre del sistema + Título principal)
 *   2. metaTitle  (campo SEO explícito, si falta alguno de los anteriores)
 *   3. defaultTitle (fallback estático para cuando la BD no responde)
 */
export function DynamicPageTitle({
  defaultTitle = DEFAULT_PAGE_TITLE,
}: DynamicPageTitleProps) {
  const { data, loading } = useLandingData()

  useEffect(() => {
    if (loading) return

    let title = defaultTitle

    if (data.companyName && data.heroTitle) {
      title = `${data.companyName} - ${data.heroTitle}`
    } else if (data.metaTitle) {
      title = data.metaTitle
    } else if (data.companyName) {
      title = data.companyName
    } else if (data.heroTitle) {
      title = data.heroTitle
    }

    document.title = title
  }, [data.metaTitle, data.companyName, data.heroTitle, loading, defaultTitle])

  return null
}
