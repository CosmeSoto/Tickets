/**
 * Componente de búsqueda con debounce visual
 * Incluye icono, placeholder y botón de limpiar
 */

'use client'

import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  autoFocus?: boolean
  debouncing?: boolean
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Buscar...',
  className,
  disabled = false,
  autoFocus = false,
  debouncing = false
}: SearchInputProps) {
  const handleClear = () => {
    onChange('')
  }

  return (
    <div className={cn('relative flex-1 min-w-[200px]', className)}>
      <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
      
      <Input
        type='text'
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        className={cn(
          'pl-9 pr-9',
          debouncing && 'animate-pulse'
        )}
        aria-label='Buscar'
      />
      
      {value && (
        <Button
          type='button'
          variant='ghost'
          size='sm'
          onClick={handleClear}
          disabled={disabled}
          className='absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 hover:bg-muted'
          aria-label='Limpiar búsqueda'
        >
          <X className='h-4 w-4' />
        </Button>
      )}
    </div>
  )
}
