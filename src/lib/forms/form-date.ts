/**
 * Fechas de formulario sin desfase UTC (evita restar un día en zonas UTC-).
 */

/** Convierte Date / ISO / YYYY-MM-DD a "YYYY-MM-DD" en calendario local. */
export function toLocalDateInputValue(value: unknown): string {
  if (value == null || value === '') return ''
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const trimmed = String(value).trim()
  if (!trimmed) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)
  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Extrae "HH:mm" en hora local desde Date / ISO. */
export function toLocalTimeInputValue(value: unknown, fallback = '09:00'): string {
  if (value == null || value === '') return fallback
  const d = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(d.getTime())) return fallback
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

/** Formato "YYYY-MM-DDTHH:mm" para DateTimePicker (calendario local). */
export function toLocalDateTimeInputValue(value: unknown, fallbackTime = '09:00'): string {
  const date = toLocalDateInputValue(value)
  if (!date) return ''
  const time = toLocalTimeInputValue(value, fallbackTime)
  return `${date}T${time}`
}

/**
 * Combina fecha local (YYYY-MM-DD) + hora (HH:mm) → Date en zona local.
 * Evita el desfase de `new Date('YYYY-MM-DD')` (medianoche UTC).
 */
export function combineLocalDateAndTime(dateYmd: string, timeHm = '09:00'): Date {
  const datePart = toLocalDateInputValue(dateYmd)
  if (!datePart) return new Date(NaN)
  const [ys, ms, ds] = datePart.split('-')
  const [hs, mins] = (timeHm || '09:00').split(':')
  const y = Number(ys)
  const m = Number(ms)
  const d = Number(ds)
  const h = Number(hs)
  const min = Number(mins)
  if (![y, m, d, h, min].every(n => Number.isFinite(n))) return new Date(NaN)
  return new Date(y, m - 1, d, h, min, 0, 0)
}

/**
 * ISO a partir de fecha local + hora (si falta la hora usa 09:00).
 */
export function localDateAndTimeToIso(dateYmd: string, timeHm?: string): string | null {
  if (!dateYmd?.trim()) return null
  const d = combineLocalDateAndTime(dateYmd, timeHm?.trim() || '09:00')
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

/** Partes fecha/hora locales para inputs (sin fallback de hora si no hay valor). */
export function toLocalDateAndTimeParts(value: unknown): { date: string; time: string } {
  if (value == null || value === '') return { date: '', time: '' }
  const date = toLocalDateInputValue(value)
  if (!date) return { date: '', time: '' }
  return { date, time: toLocalTimeInputValue(value, '') }
}

/**
 * Parsea valor de programación: ISO, "YYYY-MM-DDTHH:mm" o solo fecha.
 * Preferir siempre enviar ISO desde el cliente.
 */
export function parseScheduledDateTime(value: unknown): Date {
  if (value instanceof Date) return value
  if (value == null || value === '') return new Date(NaN)
  const s = String(value).trim()
  if (!s) return new Date(NaN)

  const localMatch = s.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}:\d{2})(?::\d{2})?)?$/)
  if (localMatch && !s.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(s)) {
    return combineLocalDateAndTime(localMatch[1], localMatch[2] || '09:00')
  }

  const d = new Date(s)
  return d
}

/** Formato legible fecha+hora en es-EC. */
export function formatLocalDateTime(value: unknown): string {
  if (value == null || value === '') return '—'
  const d = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
