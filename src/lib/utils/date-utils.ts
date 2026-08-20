/**
 * Utilidades centrales de fecha y zona horaria.
 *
 * La zona horaria del sistema se lee de la variable de entorno TZ.
 * Para cambiarla basta con actualizar TZ en .env.local o .env.production.
 *
 * Ejemplo en .env:
 *   TZ=America/Guayaquil
 */

import { DEFAULT_TIMEZONE } from '@/lib/constants'

/** Zona horaria del sistema leída desde TZ, con fallback a DEFAULT_TIMEZONE */
export function getAppTimezone(): string {
  return process.env.TZ ?? DEFAULT_TIMEZONE
}

/** Locale principal del sistema */
const APP_LOCALE = 'es-EC'

/**
 * Formatea una fecha con hora usando la zona horaria del sistema.
 * Resultado ejemplo: "27 de julio de 2026 a las 08:56 p. m."
 */
export function formatDateTime(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  return new Date(date).toLocaleString(APP_LOCALE, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: getAppTimezone(),
    ...options,
  })
}

/**
 * Formatea solo la fecha (sin hora) usando la zona horaria del sistema.
 * Resultado ejemplo: "27 de julio de 2026"
 */
export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  return new Date(date).toLocaleDateString(APP_LOCALE, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: getAppTimezone(),
    ...options,
  })
}

/**
 * Formatea fecha corta (sin hora) para tablas y etiquetas compactas.
 * Resultado ejemplo: "27 jul. 2026"
 */
export function formatDateShort(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  return new Date(date).toLocaleDateString(APP_LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: getAppTimezone(),
    ...options,
  })
}

/**
 * Formatea fecha con hora corta (mes abreviado) para PDFs compactos.
 * Resultado ejemplo: "27 jul. 2026, 08:56 p. m."
 */
export function formatDateTimeShort(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions
): string {
  return new Date(date).toLocaleString(APP_LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: getAppTimezone(),
    ...options,
  })
}

/**
 * Fecha compacta YYYYMMDD en la zona horaria del sistema.
 * Resultado ejemplo: "20260818"
 */
export function formatYmdCompact(date: Date | string = new Date()): string {
  return new Date(date)
    .toLocaleDateString('en-CA', { timeZone: getAppTimezone() })
    .replace(/-/g, '')
}

/**
 * Timestamp inteligente para listas de actividad/historial.
 *
 * < 1 min   → "Ahora mismo"
 * 1–59 min  → "hace X minutos"
 * 1–23 h    → "hace X horas"   (complementar con formatExactDateTime en tooltip)
 * ≥ 24 h    → fecha legible directa, ej. "19 ago, 21:32"
 *             (con año si es de un año distinto al actual)
 */
export function formatTimeAgo(date: Date | string): string {
  const d = new Date(date)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(minutes / 60)

  if (minutes < 1) return 'Ahora mismo'
  if (minutes < 60) return `hace ${minutes} minuto${minutes > 1 ? 's' : ''}`
  if (hours < 24) return `hace ${hours} hora${hours > 1 ? 's' : ''}`

  const isCurrentYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleString(APP_LOCALE, {
    day: '2-digit',
    month: 'short',
    ...(isCurrentYear ? {} : { year: 'numeric' }),
    hour: '2-digit',
    minute: '2-digit',
    timeZone: getAppTimezone(),
  })
}

/**
 * Fecha y hora exacta para tooltips sobre textos relativos.
 * Siempre incluye día, mes abreviado, año y hora:minutos.
 * Resultado ejemplo: "mié, 19 ago 2026, 21:32"
 */
export function formatExactDateTime(date: Date | string): string {
  return new Date(date).toLocaleString(APP_LOCALE, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: getAppTimezone(),
  })
}

/**
 * Formato ultra-compacto para espacios reducidos (badges, chips, campanas).
 * Resultado ejemplo: "5min" | "3h" | "2d"
 */
export function formatTimeAgoCompact(date: Date | string): string {
  const diff = Date.now() - new Date(date).getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (minutes < 60) return `${minutes}min`
  if (hours < 24) return `${hours}h`
  return `${days}d`
}

/**
 * Formato orientado a "último acceso / último login".
 * Resultado ejemplo: "Hoy" | "Ayer" | "5 días" | "3 meses" | "2 años"
 */
export function formatLastSeen(date: Date | string): string {
  const days = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))

  if (days === 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  if (days < 30) return `${days} días`
  if (days < 365) return `${Math.floor(days / 30)} meses`
  return `${Math.floor(days / 365)} años`
}
