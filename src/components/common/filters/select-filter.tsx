/**
 * Componente de filtro select estilizado
 * Incluye indicador de filtro activo y label opcional
 */

'use client'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectFilterProps {
  id: string
  label?: string
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  disabled?: boolean
  showActiveIndicator?: boolean
}

export function SelectFilter({
  id,
  label,
  value,
  onChange,
  options,
  placeholder = 'Seleccionar...',
  className,
  disabled = false,
  showActiveIndicator = true
}: SelectFilterProps) {
  const isActive = value && value !== 'all' && value !== ''
  const selectedOption = options.find(opt => opt.value === value)

  return (
    <div className={cn('flex flex-col space-y-1.5', className)}>
      {label && (
        <Label htmlFor={id} className='flex items-center space-x-2'>
          <span>{label}</span>
          {showActiveIndicator && isActive && (
            <Badge variant='secondary' className='h-5 px-1.5 text-xs'>
              Activo
            </Badge>
          )}
        </Label>
      )}
      
      <Select
        value={value}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger 
          id={id}
          className={cn(
            'min-w-[150px]',
            isActive && 'border-primary'
          )}
        >
          <SelectValue placeholder={placeholder}>
            {selectedOption?.label || placeholder}
          </SelectValue>
        </SelectTrigger>
        
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
