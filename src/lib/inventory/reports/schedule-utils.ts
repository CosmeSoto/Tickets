import type { ReportScheduleFrequency } from '@prisma/client'

export interface ScheduleTimingInput {
  frequency: ReportScheduleFrequency
  scheduleTime: string
  dayOfWeek?: number | null
  dayOfMonth?: number | null
}

/** Calcula la próxima ejecución a partir de ahora (o `from`). */
export function computeNextRunAt(input: ScheduleTimingInput, from = new Date()): Date {
  const [hour, minute] = input.scheduleTime.split(':').map(n => parseInt(n, 10) || 0)

  const candidate = new Date(from)
  candidate.setSeconds(0, 0)
  candidate.setHours(hour, minute, 0, 0)

  if (input.frequency === 'DAILY') {
    if (candidate <= from) {
      candidate.setDate(candidate.getDate() + 1)
    }
    return candidate
  }

  if (input.frequency === 'WEEKLY') {
    const targetDay = input.dayOfWeek ?? 1
    const currentDay = candidate.getDay()
    let daysUntil = (targetDay - currentDay + 7) % 7
    if (daysUntil === 0 && candidate <= from) daysUntil = 7
    candidate.setDate(candidate.getDate() + daysUntil)
    return candidate
  }

  // MONTHLY
  const dom = Math.min(Math.max(input.dayOfMonth ?? 1, 1), 28)
  candidate.setDate(dom)
  if (candidate <= from) {
    candidate.setMonth(candidate.getMonth() + 1)
    candidate.setDate(dom)
  }
  return candidate
}

export function isDue(nextRunAt: Date | null | undefined, now = new Date()): boolean {
  if (!nextRunAt) return false
  return nextRunAt.getTime() <= now.getTime()
}

export function frequencyLabel(frequency: ReportScheduleFrequency): string {
  switch (frequency) {
    case 'DAILY':
      return 'Diario'
    case 'WEEKLY':
      return 'Semanal'
    case 'MONTHLY':
      return 'Mensual'
    default:
      return frequency
  }
}

export const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
]

export function exportFormatLabel(format: 'CSV' | 'PDF' | 'BOTH'): string {
  switch (format) {
    case 'CSV':
      return 'CSV'
    case 'PDF':
      return 'PDF'
    case 'BOTH':
      return 'CSV + PDF'
    default:
      return format
  }
}
