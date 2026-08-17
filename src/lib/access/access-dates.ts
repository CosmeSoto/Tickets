import { formatDateTimeShort } from '@/lib/utils/date-utils'

/** Fecha y hora de vigencia en zona del sistema (America/Guayaquil). */
export function formatAccessDateTime(value: Date | string): string {
  return formatDateTimeShort(value)
}
