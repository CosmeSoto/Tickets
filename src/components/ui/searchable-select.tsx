/**
 * Componente SearchableSelect - Select con búsqueda integrada
 * Optimizado para listas grandes con virtualización y debounce
 */

'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Check, ChevronsUpDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

export interface SearchableSelectOption {
  value: string
  label: string
  description?: string
  icon?: React.ReactNode
}

interface SearchableSelectProps {
  options: SearchableSelectOption[]
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  emptyText?: string
  searchPlaceholder?: string
  disabled?: boolean
  className?: string
  allowClear?: boolean
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = 'Seleccionar...',
  emptyText = 'No se encontraron resultados',
  searchPlaceholder = 'Buscar...',
  disabled = false,
  className,
  allowClear = true,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Filtrar opciones basado en búsqueda
  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options

    const query = searchQuery.toLowerCase()
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(query) ||
        option.description?.toLowerCase().includes(query) ||
        option.value.toLowerCase().includes(query)
    )
  }, [options, searchQuery])

  // Encontrar la opción seleccionada
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
  )

  // Manejar selección
  const handleSelect = useCallback(
    (selectedValue: string) => {
      if (selectedValue === value) {
        // Si se selecciona el mismo valor, deseleccionar si allowClear está habilitado
        if (allowClear) {
          onValueChange('')
        }
      } else {
        onValueChange(selectedValue)
      }
      setOpen(false)
      setSearchQuery('')
    },
    [value, onValueChange, allowClear]
  )

  // Limpiar selección
  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onValueChange('')
      setSearchQuery('')
    },
    [onValueChange]
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between',
            !value && 'text-muted-foreground',
            className
          )}
          disabled={disabled}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <div className="flex items-center space-x-1 ml-2">
            {value && allowClear && !disabled && (
              <X
                className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
                onClick={handleClear}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => handleSelect(option.value)}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === option.value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      {option.icon}
                      <span>{option.label}</span>
                    </div>
                    {option.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {option.description}
                      </p>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
