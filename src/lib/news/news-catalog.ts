/**
 * Catálogos y helpers puros del módulo de Noticias — única fuente de verdad
 * para los enums de Prisma (antes repetidos como arrays de string-literals
 * en el POST de alta, sin validación equivalente en el PUT) y para la
 * generación de slug (antes copiada literalmente en POST y PUT).
 */

export const NEWS_TYPES = [
  'NEWS',
  'ANNOUNCEMENT',
  'EVENT',
  'BIRTHDAY',
  'HOLIDAY',
  'ALERT',
  'INTERNAL_AD',
  'RECOGNITION',
] as const
export type NewsTypeValue = (typeof NEWS_TYPES)[number]

export const NEWS_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const
export type NewsPriorityValue = (typeof NEWS_PRIORITIES)[number]

export const NEWS_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const
export type NewsStatusValue = (typeof NEWS_STATUSES)[number]

export const NEWS_TYPE_LABELS: Record<NewsTypeValue, string> = {
  NEWS: 'Noticia',
  ANNOUNCEMENT: 'Comunicado',
  EVENT: 'Evento',
  BIRTHDAY: 'Cumpleaños',
  HOLIDAY: 'Feriado',
  ALERT: 'Alerta',
  INTERNAL_AD: 'Anuncio interno',
  RECOGNITION: 'Reconocimiento',
}

export const NEWS_PRIORITY_LABELS: Record<NewsPriorityValue, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

/** Único generador de slug — determinístico salvo el sufijo `Date.now()` (evita colisiones). */
export function buildNewsSlug(title: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .trim()
    .substring(0, 200)
  return `${base}-${Date.now()}`
}
