'use client'

/**
 * DateInput — reemplazo unificado de <Input type="date"> en todo el sistema.
 *
 * Compatible con:
 *   1. {...register('field')} + value={watch('field')}  (recomendado con RHF)
 *   2. {...field}  (Controller / FormField)
 *   3. value + onChange manual (estado local)
 *
 * Acepta value/defaultValue como "YYYY-MM-DD", ISO datetime o Date.
 * El onChange siempre emite ChangeEvent con target.value en "YYYY-MM-DD".
 */

import * as React from 'react'
import { format, parse, isValid } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarIcon, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type NativeChangeEvent = React.ChangeEvent<HTMLInputElement>

export interface DateInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'onChange' | 'value' | 'defaultValue'
> {
  /** "YYYY-MM-DD", ISO datetime, Date, null o "" */
  value?: string | Date | null
  defaultValue?: string | Date | null
  onChange?: (e: NativeChangeEvent) => void
  placeholder?: string
  clearable?: boolean
  min?: string
  max?: string
}

/** Normaliza cualquier entrada de fecha a "YYYY-MM-DD" o "". */
export function toDateInputValue(value: unknown): string {
  if (value == null || value === '') return ''
  if (value instanceof Date) {
    return isValid(value) ? format(value, 'yyyy-MM-dd') : ''
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return ''
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)
    const parsed = parse(trimmed, 'yyyy-MM-dd', new Date())
    if (isValid(parsed)) return format(parsed, 'yyyy-MM-dd')
    const asDate = new Date(trimmed)
    return isValid(asDate) ? format(asDate, 'yyyy-MM-dd') : ''
  }
  return ''
}

function parseYmd(value?: string): Date | undefined {
  if (!value) return undefined
  const d = parse(value, 'yyyy-MM-dd', new Date())
  return isValid(d) ? d : undefined
}

function makeSyntheticEvent(name: string | undefined, value: string): NativeChangeEvent {
  const input = document.createElement('input')
  input.name = name ?? ''
  input.value = value
  return {
    target: input,
    currentTarget: input,
    nativeEvent: new Event('change'),
    bubbles: true,
    cancelable: false,
    defaultPrevented: false,
    eventPhase: 0,
    isTrusted: false,
    preventDefault: () => {},
    isDefaultPrevented: () => false,
    stopPropagation: () => {},
    isPropagationStopped: () => false,
    persist: () => {},
    timeStamp: Date.now(),
    type: 'change',
  } as unknown as NativeChangeEvent
}

export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  (
    {
      value: valueProp,
      defaultValue,
      onChange,
      onBlur,
      placeholder = 'Seleccionar fecha',
      clearable = false,
      disabled = false,
      min,
      max,
      name,
      id,
      className,
      ...rest
    },
    ref
  ) => {
    const isControlled = valueProp !== undefined
    const [open, setOpen] = React.useState(false)
    const [internal, setInternal] = React.useState(() => toDateInputValue(defaultValue))

    const value = isControlled ? toDateInputValue(valueProp) : internal

    const selectedDate = React.useMemo(() => parseYmd(value), [value])
    const minDate = React.useMemo(() => parseYmd(min), [min])
    const maxDate = React.useMemo(() => parseYmd(max), [max])

    const commit = (strValue: string) => {
      if (!isControlled) setInternal(strValue)
      onChange?.(makeSyntheticEvent(name, strValue))
    }

    const handleSelect = (day: Date | undefined) => {
      commit(day ? format(day, 'yyyy-MM-dd') : '')
      setOpen(false)
    }

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation()
      commit('')
    }

    const displayLabel = selectedDate
      ? format(selectedDate, 'dd/MM/yyyy', { locale: es })
      : placeholder

    return (
      <>
        <input
          ref={ref}
          type='hidden'
          name={name}
          id={id}
          value={value}
          onBlur={onBlur}
          readOnly
          tabIndex={-1}
          aria-hidden
          {...(rest as React.InputHTMLAttributes<HTMLInputElement>)}
        />
        <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
          <PopoverTrigger asChild>
            <Button
              type='button'
              variant='outline'
              disabled={disabled}
              aria-label={id ? undefined : placeholder}
              className={cn(
                'w-full justify-start text-left font-normal h-10 px-3',
                !selectedDate && 'text-muted-foreground',
                className
              )}
            >
              <CalendarIcon className='mr-2 h-4 w-4 shrink-0 text-muted-foreground' />
              <span className='flex-1 truncate'>{displayLabel}</span>
              {clearable && selectedDate && !disabled && (
                <X
                  className='ml-1 h-3.5 w-3.5 shrink-0 opacity-50 hover:opacity-100'
                  onClick={handleClear}
                />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className='w-auto p-0' align='start'>
            <Calendar
              mode='single'
              selected={selectedDate}
              onSelect={handleSelect}
              initialFocus
              captionLayout='dropdown'
              startMonth={new Date(1990, 0)}
              endMonth={new Date(new Date().getFullYear() + 15, 11)}
              disabled={day => {
                if (minDate && day < minDate) return true
                if (maxDate && day > maxDate) return true
                return false
              }}
            />
          </PopoverContent>
        </Popover>
      </>
    )
  }
)

DateInput.displayName = 'DateInput'
