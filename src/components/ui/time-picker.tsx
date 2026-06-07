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
 * Muestra dos campos numéricos (horas 0-23, minutos 0-59) con el icono de reloj.
 * Optimizado para teclados virtuales (móvil): no emite cambios al padre hasta
 * que el usuario confirma (blur o avanza al siguiente campo), evitando resets
 * de foco causados por re-renders.
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

  // Ref para evitar que el sync externo sobreescriba mientras el usuario edita
  const isEditingRef = React.useRef(false)

  // Sync interno cuando el valor externo cambia — solo si NO está editando
  React.useEffect(() => {
    if (isEditingRef.current) return
    if (!value) {
      setHours('')
      setMinutes('')
      return
    }
    const [h = '', m = ''] = value.split(':')
    setHours(h)
    setMinutes(m)
  }, [value])

  const emit = React.useCallback(
    (h: string, m: string) => {
      if (!h && !m) {
        onChange?.('')
        return
      }
      const hh = h.padStart(2, '0')
      const mm = m.padStart(2, '0')
      onChange?.(`${hh}:${mm}`)
    },
    [onChange]
  )

  const hoursRef = React.useRef<HTMLInputElement>(null)
  const minutesRef = React.useRef<HTMLInputElement>(null)

  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, '').slice(0, 2)
    if (raw !== '' && parseInt(raw, 10) > 23) raw = '23'
    setHours(raw)

    // Auto-avanzar al campo minutos al completar 2 dígitos
    if (raw.length === 2) {
      // Emitir el valor parcial antes de mover foco
      emit(raw, minutes)
      // Delay mínimo para que el state se aplique antes del focus change
      setTimeout(() => minutesRef.current?.focus(), 0)
    }
  }

  const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, '').slice(0, 2)
    if (raw !== '' && parseInt(raw, 10) > 59) raw = '59'
    setMinutes(raw)

    // Emitir al completar 2 dígitos (UX: el usuario terminó de escribir)
    if (raw.length === 2) {
      emit(hours, raw)
    }
  }

  const handleFocus = () => {
    isEditingRef.current = true
  }

  const handleHoursBlur = () => {
    // Si solo escribió 1 dígito, emitir al salir
    emit(hours, minutes)
    // Solo marcar como no-editing si el foco no va al otro campo
    setTimeout(() => {
      if (
        document.activeElement !== hoursRef.current &&
        document.activeElement !== minutesRef.current
      ) {
        isEditingRef.current = false
      }
    }, 0)
  }

  const handleMinutesBlur = () => {
    emit(hours, minutes)
    setTimeout(() => {
      if (
        document.activeElement !== hoursRef.current &&
        document.activeElement !== minutesRef.current
      ) {
        isEditingRef.current = false
      }
    }, 0)
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
        onChange={handleHoursChange}
        onFocus={e => {
          handleFocus()
          e.target.select()
        }}
        onBlur={handleHoursBlur}
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
        onChange={handleMinutesChange}
        onFocus={e => {
          handleFocus()
          e.target.select()
        }}
        onBlur={handleMinutesBlur}
        placeholder='MM'
        maxLength={2}
        disabled={disabled}
        aria-label='Minutos'
        className='w-7 text-center bg-transparent outline-none tabular-nums'
      />
    </div>
  )
}
