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
