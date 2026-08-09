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

function normalizeModelsPayload(data: unknown): ModelOption[] {
  const raw = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { models?: unknown }).models)
      ? (data as { models: unknown[] }).models
      : []

  return raw
    .map((item): ModelOption | null => {
      if (!item || typeof item !== 'object') return null
      const m = item as Record<string, unknown>
      if (typeof m.id !== 'string') return null
      const brand =
        typeof m.brand === 'string'
          ? m.brand
          : m.brand && typeof m.brand === 'object' && 'name' in m.brand
            ? String((m.brand as { name?: unknown }).name ?? '')
            : ''
      const modelName = typeof m.model === 'string' ? m.model : ''
      const category =
        m.type && typeof m.type === 'object' && 'name' in m.type
          ? String((m.type as { name?: unknown }).name ?? '')
          : typeof m.category === 'string'
            ? m.category
            : undefined
      return { id: m.id, brand, model: modelName, category }
    })
    .filter((m): m is ModelOption => m != null)
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
  const [loadError, setLoadError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open || models.length > 0 || loading) return

    const fetchModels = async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const res = await fetch('/api/inventory/models?limit=500&isActive=true')
        if (!res.ok) {
          setLoadError('No se pudieron cargar los modelos')
          setModels([])
          return
        }
        const data = await res.json()
        setModels(normalizeModelsPayload(data))
      } catch (error) {
        console.error('Error fetching models:', error)
        setLoadError('No se pudieron cargar los modelos')
        setModels([])
      } finally {
        setLoading(false)
      }
    }

    void fetchModels()
  }, [open, models.length, loading])

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
              {loading
                ? 'Cargando modelos...'
                : loadError
                  ? loadError
                  : 'No se encontraron modelos'}
            </CommandEmpty>
            {models.length > 0 && (
              <CommandGroup>
                {models.map(model => (
                  <CommandItem
                    key={model.id}
                    value={`${model.brand} ${model.model} ${model.id}`}
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
