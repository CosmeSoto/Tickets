import prisma from '@/lib/prisma'
import { getSystemBranding } from '@/lib/branding'
import { DEFAULT_SYSTEM_NAME } from '@/lib/branding-constants'

/** Color primario por defecto (coincide con --primary en globals.css: hsl(43 89% 52%)) */
export const DEFAULT_EMAIL_PRIMARY = '#EAB308'

export interface EmailBranding {
  systemName: string
  heroTitle: string
  companyName: string
  logoUrl: string | null
  primaryColor: string
  baseUrl: string
  privacyUrl: string
  termsUrl: string
  loginUrl: string
}

function normalizeLogoPath(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/uploads/')) return url.replace('/uploads/', '/api/uploads/')
  return url
}

function toAbsoluteUrl(baseUrl: string, path: string | null): string | null {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const base = baseUrl.replace(/\/$/, '')
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalized}`
}

/**
 * Branding para correos transaccionales: nombre del sistema, logo y color primario.
 */
export async function getEmailBranding(): Promise<EmailBranding> {
  const baseUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')
  const branding = await getSystemBranding()

  let logoPath: string | null = null
  let primaryColor = DEFAULT_EMAIL_PRIMARY

  try {
    const [landing, primarySetting] = await Promise.all([
      prisma.landing_page_content.findFirst({ where: { id: 'default' } }),
      prisma.site_config.findUnique({ where: { key: 'site.primary_color' } }),
    ])

    logoPath = normalizeLogoPath(
      landing?.companyLogoLightUrl || landing?.companyLogoDarkUrl || null
    )

    if (primarySetting?.value?.trim()) {
      primaryColor = primarySetting.value.trim()
    }
  } catch {
    /* valores por defecto */
  }

  return {
    systemName: branding.systemName || DEFAULT_SYSTEM_NAME,
    heroTitle: branding.heroTitle,
    companyName: branding.companyName || branding.systemName || DEFAULT_SYSTEM_NAME,
    logoUrl: toAbsoluteUrl(baseUrl, logoPath),
    primaryColor,
    baseUrl,
    privacyUrl: `${baseUrl}/help/privacy`,
    termsUrl: `${baseUrl}/help/terms`,
    loginUrl: `${baseUrl}/login`,
  }
}
