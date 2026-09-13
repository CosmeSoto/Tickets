/**
 * Horario laboral por defecto usado para sugerir y validar fechas de mantenimiento.
 * Coincide con el horario laboral por defecto de las políticas de SLA
 * (ver `createSLAPolicySchema` y `SLAService`): 09:00–18:00, lunes a viernes.
 */

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const

export interface BusinessHours {
  /** "HH:mm" */
  start: string
  /** "HH:mm" */
  end: string
  /** Días laborales, ej. ['MON', 'TUE', ...] */
  days: string[]
}

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  start: '09:00',
  end: '18:00',
  days: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
}

export function isBusinessDay(date: Date, hours: BusinessHours = DEFAULT_BUSINESS_HOURS): boolean {
  return hours.days.includes(DAY_NAMES[date.getDay()])
}

export function isWithinBusinessHours(
  date: Date,
  hours: BusinessHours = DEFAULT_BUSINESS_HOURS
): boolean {
  if (!isBusinessDay(date, hours)) return false
  const [startH, startM] = hours.start.split(':').map(Number)
  const [endH, endM] = hours.end.split(':').map(Number)
  const minutes = date.getHours() * 60 + date.getMinutes()
  return minutes >= startH * 60 + startM && minutes < endH * 60 + endM
}

/**
 * Sugiere una fecha/hora dentro del horario laboral a partir de `from`:
 * - Si `from` ya cae en horario laboral, se devuelve tal cual.
 * - Si es un día laboral pero antes/después del horario, ajusta al inicio del horario
 *   (mismo día si aún no empieza, o el próximo día laboral si ya terminó).
 * - Si no es día laboral, avanza al próximo día laboral, al inicio del horario.
 */
export function suggestBusinessDateTime(
  from: Date = new Date(),
  hours: BusinessHours = DEFAULT_BUSINESS_HOURS
): Date {
  const result = new Date(from)
  const [startH, startM] = hours.start.split(':').map(Number)
  const [endH, endM] = hours.end.split(':').map(Number)

  // Avanza día por día (máx. 8 iteraciones, cubre cualquier combinación de días laborales) hasta
  // caer en un día laboral con hora dentro de rango.
  for (let i = 0; i < 8; i++) {
    if (isBusinessDay(result, hours)) {
      const minutes = result.getHours() * 60 + result.getMinutes()
      if (minutes < startH * 60 + startM) {
        result.setHours(startH, startM, 0, 0)
        return result
      }
      if (minutes < endH * 60 + endM) {
        return result
      }
    }
    result.setDate(result.getDate() + 1)
    result.setHours(startH, startM, 0, 0)
  }
  return result
}

const WEEKDAY_LABELS: Record<string, string> = {
  MON: 'L',
  TUE: 'M',
  WED: 'X',
  THU: 'J',
  FRI: 'V',
  SAT: 'S',
  SUN: 'D',
}

/** Etiqueta legible del horario laboral, ej. "09:00–18:00, L-V". */
export function formatBusinessHoursLabel(hours: BusinessHours = DEFAULT_BUSINESS_HOURS): string {
  const isDefaultWeekdays =
    hours.days.length === 5 && DEFAULT_BUSINESS_HOURS.days.every(d => hours.days.includes(d))
  const days = isDefaultWeekdays ? 'L-V' : hours.days.map(d => WEEKDAY_LABELS[d] ?? d).join(', ')
  return `${hours.start}–${hours.end}, ${days}`
}
