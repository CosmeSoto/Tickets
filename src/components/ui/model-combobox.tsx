'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Package } from 'lucide-react'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface ModelOption {
  id: string
  brand: string
  model: string
  category?: string
}

interface ModelComboboxProps {
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function ModelCombobox({
  value,
  onValueChange,
  placeholder = 'Seleccionar modelo...',
  disabled = false,
  className,
}: ModelComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [models, setModels] = React.useState<ModelOption[]>([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    const fetchModels = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/inventory/models')
        if (res.ok) {
          const data = await res.json()
          setModels(data)
        }
      } catch (error) {
        console.error('Error fetching models:', error)
      } finally {
        setLoading(false)
      }
    }

    if (open && models.length === 0) {
      fetchModels()
    }
  }, [open, models.length])

  const selectedModel = models.find(m => m.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          role='combobox'
          aria-expanded={open}
          className={cn('w-full justify-between font-normal', className)}
          disabled={disabled}
        >
          <div className='flex items-center gap-2 flex-1 min-w-0'>
            <Package className='h-4 w-4 text-muted-foreground flex-shrink-0' />
            <span className={cn(!selectedModel && 'text-muted-foreground', 'truncate')}>
              {selectedModel ? `${selectedModel.brand} ${selectedModel.model}` : placeholder}
            </span>
          </div>
          <ChevronsUpDown className='h-4 w-4 opacity-40 flex-shrink-0' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-[400px] p-0' align='start'>
        <Command>
          <CommandInput placeholder='Buscar modelo...' />
          <CommandList>
            <CommandEmpty>
              {loading ? 'Cargando modelos...' : 'No se encontraron modelos'}
            </CommandEmpty>
            {models.length > 0 && (
              <CommandGroup>
                {models.map(model => (
                  <CommandItem
                    key={model.id}
                    value={`${model.brand} ${model.model}`}
                    onSelect={() => {
                      onValueChange(model.id)
                      setOpen(false)
                    }}
                    className='cursor-pointer'
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === model.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className='flex flex-col'>
                      <span className='font-medium'>
                        {model.brand} {model.model}
                      </span>
                      {model.category && (
                        <span className='text-xs text-muted-foreground'>{model.category}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
