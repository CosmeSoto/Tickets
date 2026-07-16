/**
 * Branding dinámico del sistema (solo servidor — usa Prisma).
 */

import prisma from '@/lib/prisma'
import { getCached, setCache } from '@/lib/server'
import {
  DEFAULT_SYSTEM_NAME,
  DEFAULT_HERO_TITLE,
  DEFAULT_PAGE_TITLE,
} from '@/lib/branding-constants'

export {
  DEFAULT_SYSTEM_NAME,
  DEFAULT_HERO_TITLE,
  DEFAULT_PAGE_TITLE,
} from '@/lib/branding-constants'

const BRANDING_CACHE_KEY = 'system:branding'
const BRANDING_CACHE_TTL = 60 // 60 segundos

export interface SystemBranding {
  systemName: string
  heroTitle: string
  companyName: string
  pageTitle: string
  metaDescription: string
}

const DEFAULT_DESCRIPTION =
  'Sistema profesional de gestión multi-área: tickets, inventario, rondas y más'

/**
 * Lee el branding completo del sistema desde BD con caché de 60s.
 * Consolida en una sola query a landing_page_content (antes eran dos).
 * Preferencia: systemName (settings) → companyName (landing) → default.
 */
export async function getSystemBranding(): Promise<SystemBranding> {
  // 1. Intentar desde caché
  const cached = await getCached<SystemBranding>(BRANDING_CACHE_KEY)
  if (cached) return cached

  try {
    // 2. Una sola query a landing_page_content con todos los campos necesarios
    const [systemNameSetting, landing] = await Promise.all([
      prisma.system_settings.findUnique({ where: { key: 'systemName' } }),
      prisma.landing_page_content.findFirst({
        where: { id: 'default' },
        select: { companyName: true, heroTitle: true, metaDescription: true },
      }),
    ])

    const systemName =
      systemNameSetting?.value?.trim() || landing?.companyName?.trim() || DEFAULT_SYSTEM_NAME

    const heroTitle = landing?.heroTitle?.trim() || DEFAULT_HERO_TITLE
    const companyName = landing?.companyName?.trim() || systemName
    const pageTitle = `${systemName} - ${heroTitle}`
    const metaDescription = landing?.metaDescription?.trim() || DEFAULT_DESCRIPTION

    const result: SystemBranding = {
      systemName,
      heroTitle,
      companyName,
      pageTitle,
      metaDescription,
    }

    // 3. Guardar en caché para los siguientes requests
    await setCache(BRANDING_CACHE_KEY, result, BRANDING_CACHE_TTL)

    return result
  } catch {
    return {
      systemName: DEFAULT_SYSTEM_NAME,
      heroTitle: DEFAULT_HERO_TITLE,
      companyName: DEFAULT_SYSTEM_NAME,
      pageTitle: DEFAULT_PAGE_TITLE,
      metaDescription: DEFAULT_DESCRIPTION,
    }
  }
}

/**
 * Invalida el caché de branding. Llamar cuando se actualicen los datos en admin.
 */
export async function invalidateBrandingCache(): Promise<void> {
  const { deleteCache } = await import('@/lib/server')
  await deleteCache(BRANDING_CACHE_KEY)
}
