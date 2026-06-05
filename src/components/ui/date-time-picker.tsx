'use client'

import * as React from 'react'
import { format, parse, isValid } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { TimePicker } from '@/components/ui/time-picker'

// ── DateTimePicker ────────────────────────────────────────────────────────────
// Acepta/devuelve un string en formato "YYYY-MM-DDTHH:mm" (datetime-local)

interface DateTimePickerProps {
  /** Valor en formato "YYYY-MM-DDTHH:mm" o "" */
  value?: string
  onChange?: (value: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  /** Fecha mínima seleccionable (Date object) */
  minDate?: Date
  id?: string
}

export function DateTimePicker({
  value = '',
  onChange,
  disabled = false,
  placeholder = 'Seleccionar fecha y hora',
  className,
  minDate,
  id,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false)

  // Parsear valor actual
  const selectedDate = React.useMemo(() => {
    if (!value) return undefined
    const d = new Date(value)
    return isValid(d) ? d : undefined
  }, [value])

  const timeStr = selectedDate
    ? `${String(selectedDate.getHours()).padStart(2, '0')}:${String(selectedDate.getMinutes()).padStart(2, '0')}`
    : ''

  const handleDaySelect = (day: Date | undefined) => {
    if (!day) return
    // Preservar la hora actual si ya hay una
    const h = selectedDate?.getHours() ?? 0
    const m = selectedDate?.getMinutes() ?? 0
    day.setHours(h, m, 0, 0)
    onChange?.(formatForInput(day))
    // No cerramos el popover para que el usuario pueda ajustar la hora
  }

  const handleTimeChange = (time: string) => {
    if (!time) return
    const base = selectedDate ? new Date(selectedDate) : new Date()
    const [h = 0, m = 0] = time.split(':').map(Number)
    base.setHours(h, m, 0, 0)
    onChange?.(formatForInput(base))
  }

  const displayLabel = selectedDate
    ? format(selectedDate, 'dd MMM yyyy, HH:mm', { locale: es })
    : placeholder

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant='outline'
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal h-10',
            !selectedDate && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className='mr-2 h-4 w-4 shrink-0' />
          <span className='truncate'>{displayLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-auto p-0' align='start'>
        <Calendar
          mode='single'
          selected={selectedDate}
          onSelect={handleDaySelect}
          initialFocus
          locale={es}
          disabled={minDate ? day => day < minDate : undefined}
        />
        <div className='border-t px-3 py-2 flex items-center gap-2'>
          <span className='text-xs text-muted-foreground whitespace-nowrap'>Hora:</span>
          <TimePicker value={timeStr} onChange={handleTimeChange} className='flex-1' />
          <Button size='sm' variant='ghost' onClick={() => setOpen(false)} className='text-xs'>
            OK
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ── DatePicker con hora opcional ──────────────────────────────────────────────
// Extiende el DatePicker existente con soporte opcional de hora

interface DatePickerWithTimeProps {
  /** Valor en formato "YYYY-MM-DD" */
  dateValue?: string
  /** Valor en formato "HH:mm" */
  timeValue?: string
  onDateChange?: (date: string) => void
  onTimeChange?: (time: string) => void
  disabled?: boolean
  showTime?: boolean
  className?: string
}

export function DatePickerWithTime({
  dateValue = '',
  timeValue = '',
  onDateChange,
  onTimeChange,
  disabled = false,
  showTime = true,
  className,
}: DatePickerWithTimeProps) {
  const [open, setOpen] = React.useState(false)

  const selectedDate = React.useMemo(() => {
    if (!dateValue) return undefined
    const d = parse(dateValue, 'yyyy-MM-dd', new Date())
    return isValid(d) ? d : undefined
  }, [dateValue])

  const handleDaySelect = (day: Date | undefined) => {
    if (!day) return
    onDateChange?.(format(day, 'yyyy-MM-dd'))
    if (!showTime) setOpen(false)
  }

  const displayLabel = selectedDate
    ? showTime && timeValue
      ? `${format(selectedDate, 'dd MMM yyyy', { locale: es })}, ${timeValue}`
      : format(selectedDate, 'dd MMM yyyy', { locale: es })
    : 'Seleccionar fecha'

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal h-10',
            !selectedDate && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className='mr-2 h-4 w-4 shrink-0' />
          <span className='truncate'>{displayLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-auto p-0' align='start'>
        <Calendar
          mode='single'
          selected={selectedDate}
          onSelect={handleDaySelect}
          initialFocus
          locale={es}
        />
        {showTime && (
          <div className='border-t px-3 py-2 flex items-center gap-2'>
            <span className='text-xs text-muted-foreground whitespace-nowrap'>Hora:</span>
            <TimePicker value={timeValue} onChange={v => onTimeChange?.(v)} className='flex-1' />
            <Button size='sm' variant='ghost' onClick={() => setOpen(false)} className='text-xs'>
              OK
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

// ── Helper interno ────────────────────────────────────────────────────────────
function formatForInput(d: Date): string {
  const yyyy = d.getFullYear()
  const MM = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const HH = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${MM}-${dd}T${HH}:${mm}`
}
