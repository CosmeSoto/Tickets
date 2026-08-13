import type { EmailBranding } from './email-branding'
import { DEFAULT_EMAIL_PRIMARY } from './email-branding'
import { DEFAULT_SYSTEM_NAME } from '@/lib/branding-constants'

export const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

export const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#10B981',
  MEDIUM: '#F59E0B',
  HIGH: '#EF4444',
  URGENT: '#DC2626',
}

export function brandingFromTemplateData(data: Record<string, unknown>): EmailBranding {
  const baseUrl = String(data.baseUrl || '')
  const systemName = String(data.systemName || DEFAULT_SYSTEM_NAME)
  return {
    systemName,
    heroTitle: String(data.heroTitle || ''),
    companyName: String(data.companyName || systemName),
    logoUrl: (data.logoUrl as string | null | undefined) ?? null,
    primaryColor: String(data.primaryColor || DEFAULT_EMAIL_PRIMARY),
    baseUrl,
    privacyUrl: String(data.privacyUrl || `${baseUrl}/help/privacy`),
    termsUrl: String(data.termsUrl || `${baseUrl}/help/terms`),
    loginUrl: String(data.loginUrl || `${baseUrl}/login`),
  }
}

export function truncateForEmail(text: string, max = 280): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, max - 1)}…`
}

export function resolveAbsoluteUrl(baseUrl: string, path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const base = baseUrl.replace(/\/$/, '')
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export function ticketNumberFrom(data: Record<string, unknown>): string {
  if (data.ticketNumber) return String(data.ticketNumber)
  if (data.ticketCode) return String(data.ticketCode)
  if (data.ticketId && typeof data.ticketId === 'string') {
    return data.ticketId.substring(0, 8)
  }
  return '—'
}

export function ticketTitleFrom(data: Record<string, unknown>): string {
  return String(data.ticketTitle || data.title || 'Sin título')
}
