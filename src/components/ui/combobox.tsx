'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export interface ComboboxOption {
  value: string
  label: string
  color?: string
  description?: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  disabled?: boolean
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = 'Selecciona una opción...',
  searchPlaceholder = 'Buscar...',
  emptyText = 'No se encontraron resultados',
  className,
  disabled = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState('')

  const selectedOption = options.find(option => option.value === value)

  const filteredOptions = React.useMemo(() => {
    if (!searchValue) return options

    return options.filter(option =>
      (option.label ?? '').toLowerCase().includes(searchValue.toLowerCase())
    )
  }, [options, searchValue])

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          role='combobox'
          aria-expanded={open}
          className={cn('w-full min-w-0 justify-between gap-2', className)}
          disabled={disabled}
        >
          {selectedOption ? (
            <div className='flex min-w-0 flex-1 items-center gap-2 overflow-hidden'>
              {selectedOption.color && (
                <div
                  className='h-3 w-3 shrink-0 rounded-full'
                  style={{ backgroundColor: selectedOption.color }}
                />
              )}
              <span className='truncate text-left'>{selectedOption.label}</span>
            </div>
          ) : (
            <span className='truncate text-muted-foreground'>{placeholder}</span>
          )}
          <ChevronsUpDown className='h-4 w-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className='w-[var(--radix-popover-trigger-width)] max-w-[min(100vw-2rem,28rem)] p-0 max-h-[400px] overflow-hidden'
        align='start'
        side='bottom'
        sideOffset={4}
      >
        <Command shouldFilter={false} className='h-full'>
          <div className='flex items-center border-b px-3'>
            <Search className='mr-2 h-4 w-4 shrink-0 opacity-50' />
            <input
              className='flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50'
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
            />
          </div>
          <CommandEmpty>{emptyText}</CommandEmpty>
          <CommandGroup className='max-h-[340px] overflow-y-scroll scroll-smooth'>
            {filteredOptions.map(option => (
              <CommandItem
                key={option.value}
                value={option.value}
                onSelect={currentValue => {
                  onValueChange(currentValue === value ? '' : currentValue)
                  setOpen(false)
                  setSearchValue('')
                }}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4 shrink-0',
                    value === option.value ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <div className='flex min-w-0 flex-1 items-center gap-2'>
                  {option.color && (
                    <div
                      className='h-3 w-3 shrink-0 rounded-full'
                      style={{ backgroundColor: option.color }}
                    />
                  )}
                  <div className='min-w-0 flex-1'>
                    <div className='truncate font-medium'>{option.label}</div>
                    {option.description && (
                      <div className='truncate text-xs text-muted-foreground'>
                        {option.description}
                      </div>
                    )}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
