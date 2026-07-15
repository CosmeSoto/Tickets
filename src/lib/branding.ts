/**
 * Branding dinámico del sistema (solo servidor — usa Prisma).
 */

import prisma from '@/lib/prisma'
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

export interface SystemBranding {
  systemName: string
  heroTitle: string
  companyName: string
  pageTitle: string
}

/**
 * Lee el nombre del sistema y el título principal desde BD.
 * Preferencia: systemName (settings) → companyName (landing) → default.
 */
export async function getSystemBranding(): Promise<SystemBranding> {
  try {
    const [systemNameSetting, landing] = await Promise.all([
      prisma.system_settings.findUnique({ where: { key: 'systemName' } }),
      prisma.landing_page_content.findFirst({
        where: { id: 'default' },
        select: { companyName: true, heroTitle: true },
      }),
    ])

    const systemName =
      systemNameSetting?.value?.trim() ||
      landing?.companyName?.trim() ||
      DEFAULT_SYSTEM_NAME

    const heroTitle = landing?.heroTitle?.trim() || DEFAULT_HERO_TITLE
    const companyName = landing?.companyName?.trim() || systemName

    // Título del tab: Nombre del sistema + Título principal (no metaTitle SEO)
    const pageTitle = `${systemName} - ${heroTitle}`

    return { systemName, heroTitle, companyName, pageTitle }
  } catch {
    return {
      systemName: DEFAULT_SYSTEM_NAME,
      heroTitle: DEFAULT_HERO_TITLE,
      companyName: DEFAULT_SYSTEM_NAME,
      pageTitle: DEFAULT_PAGE_TITLE,
    }
  }
}
