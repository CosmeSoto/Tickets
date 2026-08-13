'use client'

import * as React from 'react'
import type { DropdownProps } from 'react-day-picker'

import { useCalendarContainer } from '@/components/ui/calendar-container-context'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/**
 * Select de mes/año para react-day-picker (reemplaza <select> nativos).
 * El contenido se porta dentro del calendario para convivir con Dialog/Popover.
 */
export function CalendarSelectDropdown(props: DropdownProps) {
  const { options, value, onChange, 'aria-label': ariaLabel } = props
  const containerRef = useCalendarContainer()

  const handleValueChange = (newValue: string) => {
    onChange?.({
      target: { value: newValue },
    } as React.ChangeEvent<HTMLSelectElement>)
  }

  return (
    <Select value={value?.toString()} onValueChange={handleValueChange}>
      <SelectTrigger
        aria-label={ariaLabel}
        className='h-8 w-fit min-w-[5rem] gap-1 border px-2 py-0 text-sm font-medium shadow-xs'
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        container={containerRef?.current ?? undefined}
        position='popper'
        className='z-[250] max-h-60'
      >
        <SelectGroup>
          {options?.map(option => (
            <SelectItem
              key={option.value}
              value={option.value.toString()}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
