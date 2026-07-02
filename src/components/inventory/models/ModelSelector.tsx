/**
 * ModelSelector Component
 * Selector de modelos de equipos con búsqueda y creación inline
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Check, ChevronsUpDown, Plus, Search } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { useDebounce } from '@/hooks/common/use-debounce'

interface EquipmentModel {
  id: string
  brand: string
  model: string
  sku: string | null
  type: {
    id: string
    name: string
    code: string
  }
  standardPrice: number | null
}

interface ModelSelectorProps {
  value?: string
  onValueChange: (modelId: string, model: EquipmentModel | null) => void
  typeId?: string
  familyId?: string
  disabled?: boolean
  placeholder?: string
  showStock?: boolean
  onCreateNew?: () => void
}

function normalizeModel(model: Record<string, unknown>): EquipmentModel {
  const brand = model.brand
  const type = model.type as EquipmentModel['type'] | undefined
  return {
    id: String(model.id),
    brand: typeof brand === 'string' ? brand : ((brand as { name?: string })?.name ?? ''),
    model: String(model.model ?? ''),
    sku: (model.sku as string | null) ?? null,
    type: type ?? { id: String(model.typeId ?? ''), name: '', code: '' },
    standardPrice: (model.standardPrice as number | null) ?? null,
  }
}

export function ModelSelector({
  value,
  onValueChange,
  typeId,
  familyId,
  disabled = false,
  placeholder = 'Seleccionar modelo...',
  showStock = false,
  onCreateNew,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [models, setModels] = useState<EquipmentModel[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState<EquipmentModel | null>(null)

  const debouncedSearch = useDebounce(search, 300)

  // Fetch models
  const fetchModels = useCallback(
    async (query: string) => {
      if (!query || query.length < 2) {
        setModels([])
        return
      }

      setLoading(true)
      try {
        const params = new URLSearchParams({
          q: query,
          limit: '20',
          ...(typeId && { typeId }),
          ...(familyId && { familyId }),
        })

        const response = await fetch(`/api/inventory/models/search?${params}`)
        if (!response.ok) throw new Error('Error al buscar modelos')

        const data = await response.json()
        setModels((data.models || []).map((m: Record<string, unknown>) => normalizeModel(m)))
      } catch (error) {
        console.error('Error fetching models:', error)
        setModels([])
      } finally {
        setLoading(false)
      }
    },
    [typeId, familyId]
  )

  // Fetch selected model details
  const fetchModelDetails = useCallback(async (modelId: string) => {
    try {
      const response = await fetch(`/api/inventory/models/${modelId}`)
      if (!response.ok) throw new Error('Error al obtener modelo')

      const model = await response.json()
      setSelectedModel(normalizeModel(model))
    } catch (error) {
      console.error('Error fetching model details:', error)
    }
  }, [])

  // Effect: Search models
  useEffect(() => {
    if (debouncedSearch) {
      fetchModels(debouncedSearch)
    } else {
      setModels([])
    }
  }, [debouncedSearch, fetchModels])

  // Effect: Load selected model
  useEffect(() => {
    if (value && !selectedModel) {
      fetchModelDetails(value)
    }
  }, [value, selectedModel, fetchModelDetails])

  const handleSelect = (modelId: string) => {
    const model = models.find(m => m.id === modelId)
    if (model) {
      setSelectedModel(model)
      onValueChange(modelId, model)
      setOpen(false)
      setSearch('')
    }
  }

  const handleCreateNew = () => {
    setOpen(false)
    onCreateNew?.()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          role='combobox'
          aria-expanded={open}
          className='w-full justify-between'
          disabled={disabled}
        >
          {selectedModel ? (
            <div className='flex items-center gap-2 truncate'>
              <span className='truncate'>
                {selectedModel.brand} {selectedModel.model}
              </span>
              {selectedModel.sku && (
                <Badge variant='secondary' className='text-xs'>
                  {selectedModel.sku}
                </Badge>
              )}
            </div>
          ) : (
            <span className='text-muted-foreground'>{placeholder}</span>
          )}
          <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-[400px] p-0' align='start'>
        <Command shouldFilter={false}>
          <div className='flex items-center border-b px-3'>
            <Search className='mr-2 h-4 w-4 shrink-0 opacity-50' />
            <input
              placeholder='Buscar por marca, modelo o SKU...'
              className='flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50'
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <CommandList>
            {loading && (
              <div className='py-6 text-center text-sm text-muted-foreground'>Buscando...</div>
            )}
            {!loading && search.length > 0 && search.length < 2 && (
              <div className='py-6 text-center text-sm text-muted-foreground'>
                Escribe al menos 2 caracteres
              </div>
            )}
            {!loading && search.length >= 2 && models.length === 0 && (
              <CommandEmpty>
                <div className='py-6 text-center'>
                  <p className='text-sm text-muted-foreground mb-3'>No se encontraron modelos</p>
                  {onCreateNew && (
                    <Button variant='outline' size='sm' onClick={handleCreateNew} className='gap-2'>
                      <Plus className='h-4 w-4' />
                      Crear nuevo modelo
                    </Button>
                  )}
                </div>
              </CommandEmpty>
            )}
            {!loading && models.length > 0 && (
              <CommandGroup>
                {models.map(model => (
                  <CommandItem
                    key={model.id}
                    value={model.id}
                    onSelect={() => handleSelect(model.id)}
                    className='cursor-pointer'
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === model.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-2'>
                        <span className='font-medium truncate'>
                          {model.brand} {model.model}
                        </span>
                        {model.sku && (
                          <Badge variant='secondary' className='text-xs'>
                            {model.sku}
                          </Badge>
                        )}
                      </div>
                      <div className='text-xs text-muted-foreground'>
                        {model.type.name}
                        {model.standardPrice && (
                          <span className='ml-2'>• ${model.standardPrice.toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {onCreateNew && models.length > 0 && (
              <div className='border-t p-2'>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={handleCreateNew}
                  className='w-full justify-start gap-2'
                >
                  <Plus className='h-4 w-4' />
                  Crear nuevo modelo
                </Button>
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
