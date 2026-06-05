'use client'

import * as React from 'react'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TimePickerProps {
  value?: string // HH:mm
  onChange?: (value: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  id?: string
}

/**
 * TimePicker — selector de hora en formato 24h (HH:mm).
 * Reemplaza <Input type="time"> con una UI consistente en todos los browsers.
 *
 * Muestra dos spinners numéricos (horas 0-23, minutos 0-59) con el icono de reloj.
 */
export function TimePicker({
  value = '',
  onChange,
  disabled = false,
  placeholder = '--:--',
  className,
  id,
}: TimePickerProps) {
  const [hours, setHours] = React.useState(() => {
    if (!value) return ''
    return value.split(':')[0] ?? ''
  })
  const [minutes, setMinutes] = React.useState(() => {
    if (!value) return ''
    return value.split(':')[1] ?? ''
  })

  // Sync interno cuando el valor externo cambia
  React.useEffect(() => {
    if (!value) {
      setHours('')
      setMinutes('')
      return
    }
    const [h = '', m = ''] = value.split(':')
    setHours(h)
    setMinutes(m)
  }, [value])

  const emit = (h: string, m: string) => {
    if (!h && !m) {
      onChange?.('')
      return
    }
    const hh = h.padStart(2, '0')
    const mm = m.padStart(2, '0')
    onChange?.(`${hh}:${mm}`)
  }

  const handleHours = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, '').slice(0, 2)
    // Clamp 0-23
    if (raw !== '' && parseInt(raw, 10) > 23) raw = '23'
    setHours(raw)
    emit(raw, minutes)
  }

  const handleMinutes = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, '').slice(0, 2)
    // Clamp 0-59
    if (raw !== '' && parseInt(raw, 10) > 59) raw = '59'
    setMinutes(raw)
    emit(hours, raw)
  }

  // Auto-avanzar al campo minutos al escribir 2 dígitos de hora
  const hoursRef = React.useRef<HTMLInputElement>(null)
  const minutesRef = React.useRef<HTMLInputElement>(null)

  const onHoursKeyUp = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (hours.length === 2) minutesRef.current?.focus()
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-md border border-input bg-background px-2 h-10 text-sm',
        'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0',
        disabled && 'opacity-50 pointer-events-none',
        className
      )}
    >
      <Clock className='h-3.5 w-3.5 text-muted-foreground shrink-0' />
      <input
        ref={hoursRef}
        id={id}
        type='text'
        inputMode='numeric'
        value={hours}
        onChange={handleHours}
        onKeyUp={onHoursKeyUp}
        onFocus={e => e.target.select()}
        placeholder='HH'
        maxLength={2}
        disabled={disabled}
        aria-label='Horas'
        className='w-7 text-center bg-transparent outline-none tabular-nums'
      />
      <span className='text-muted-foreground select-none'>:</span>
      <input
        ref={minutesRef}
        type='text'
        inputMode='numeric'
        value={minutes}
        onChange={handleMinutes}
        onFocus={e => e.target.select()}
        placeholder='MM'
        maxLength={2}
        disabled={disabled}
        aria-label='Minutos'
        className='w-7 text-center bg-transparent outline-none tabular-nums'
      />
    </div>
  )
}
