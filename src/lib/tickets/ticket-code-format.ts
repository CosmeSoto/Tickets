import { formatYmdCompact } from '@/lib/utils/date-utils'

export type ParsedTicketCode = {
  prefix: string
  year: number
  dateStamp: string | null
  sequence: number
  legacy: boolean
}

/** Formato actual: {PREFIJO}-{YYYYMMDD}-{SECUENCIA}  ej. ADM-20260818-0001 */
const NEW_CODE_REGEX = /^([A-Z0-9]+)-(\d{8})-(\d{4,})$/
/** Formato anterior: {PREFIJO}-{YYYY}-{SECUENCIA}  ej. ADM-2026-0001 */
const LEGACY_CODE_REGEX = /^([A-Z0-9]+)-(\d{4})-(\d{4,})$/

export function parseTicketCode(code: string): ParsedTicketCode | null {
  const trimmed = code.trim().toUpperCase()
  const current = trimmed.match(NEW_CODE_REGEX)
  if (current) {
    const dateStamp = current[2]
    const year = parseInt(dateStamp.slice(0, 4), 10)
    return {
      prefix: current[1],
      year,
      dateStamp,
      sequence: parseInt(current[3], 10),
      legacy: false,
    }
  }

  const legacy = trimmed.match(LEGACY_CODE_REGEX)
  if (legacy) {
    return {
      prefix: legacy[1],
      year: parseInt(legacy[2], 10),
      dateStamp: null,
      sequence: parseInt(legacy[3], 10),
      legacy: true,
    }
  }

  return null
}

export function formatTicketCode(prefix: string, dateStamp: string, sequence: number): string {
  return `${prefix}-${dateStamp}-${String(sequence).padStart(4, '0')}`
}

export function exampleTicketCode(prefix = 'TI', date: Date = new Date()): string {
  return formatTicketCode(prefix, formatYmdCompact(date), 1)
}
