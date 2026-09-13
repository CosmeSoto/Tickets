import { AlertTriangle } from 'lucide-react'
import { isWithinBusinessHours, formatBusinessHoursLabel } from '@/lib/utils/business-hours'
import { parseScheduledDateTime } from '@/lib/forms/form-date'

interface BusinessHoursHintProps {
  /** Valor de fecha/hora en formato "YYYY-MM-DDTHH:mm" o ISO */
  value?: string
}

/**
 * Aviso que recomienda programar dentro del horario laboral (mismo horario
 * usado por defecto en las políticas de SLA) cuando la fecha/hora elegida cae fuera de él.
 */
export function BusinessHoursHint({ value }: BusinessHoursHintProps) {
  if (!value) return null
  const date = parseScheduledDateTime(value)
  if (Number.isNaN(date.getTime()) || isWithinBusinessHours(date)) return null

  return (
    <p className='flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-500 mt-1.5'>
      <AlertTriangle className='h-3.5 w-3.5 shrink-0 mt-0.5' />
      Fuera del horario laboral ({formatBusinessHoursLabel()}). Se recomienda programar dentro de
      ese horario para cumplir el SLA.
    </p>
  )
}
