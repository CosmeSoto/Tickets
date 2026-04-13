'use client'

/**
 * InlineCreateSelect — select con búsqueda + botón para crear un nuevo ítem
 * sin salir del formulario actual.
 *
 * Uso:
 *   <InlineCreateSelect
 *     options={equipmentTypes}
 *     value={typeId}
 *     onChange={setTypeId}
 *     placeholder="Buscar tipo..."
 *     createLabel="Crear tipo de equipo"
 *     createForm={<EquipmentTypeForm onSuccess={...} onCancel={...} />}
 *     createTitle="Nuevo tipo de equipo"
 *   />
 */

import { useState, ReactNode } from 'react'
import { Check, ChevronsUpDown, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export interface InlineSelectOption {
  id: string
  name: string
  description?: string
}

interface InlineCreateSelectProps {
  options: InlineSelectOption[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  disabled?: boolean
  allowClear?: boolean
  /** Texto del botón de crear */
  createLabel?: string
  /** Título del modal de creación */
  createTitle?: string
  /**
   * Render del formulario de creación.
   * Recibe onSuccess(newItem) y onCancel como props.
   */
  createForm?: (props: {
    onSuccess: (item: InlineSelectOption) => void
    onCancel: () => void
  }) => ReactNode
}

export function InlineCreateSelect({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar...',
  disabled = false,
  allowClear = false,
  createLabel = 'Crear nuevo',
  createTitle = 'Crear nuevo',
  createForm,
}: InlineCreateSelectProps) {
  const [open, setOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const selected = options.find(o => o.id === value)

  const handleCreated = (item: InlineSelectOption) => {
    setCreateOpen(false)
    onChange(item.id)
  }

  return (
    <>
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              disabled={disabled}
              className="w-full justify-between font-normal"
            >
              <span className={cn('truncate', !selected && 'text-muted-foreground')}>
                {selected ? selected.name : placeholder}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar..." />
              <CommandList>
                {/* Botón crear al inicio si hay createForm */}
                {createForm && (
                  <CommandGroup>
                    <CommandItem
                      value="__create__"
                      onSelect={() => { setOpen(false); setCreateOpen(true) }}
                      className="text-primary font-medium"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {createLabel}
                    </CommandItem>
                  </CommandGroup>
                )}
                <CommandEmpty>
                  <div className="py-3 text-center space-y-2">
                    <p className="text-sm text-muted-foreground">Sin resultados.</p>
                    {createForm && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => { setOpen(false); setCreateOpen(true) }}
                      >
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        {createLabel}
                      </Button>
                    )}
                  </div>
                </CommandEmpty>
                <CommandGroup>
                  {options.map(opt => (
                    <CommandItem
                      key={opt.id}
                      value={opt.name}
                      onSelect={() => { onChange(opt.id); setOpen(false) }}
                    >
                      <Check className={cn('mr-2 h-4 w-4 shrink-0', value === opt.id ? 'opacity-100' : 'opacity-0')} />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm">{opt.name}</p>
                        {opt.description && (
                          <p className="truncate text-xs text-muted-foreground">{opt.description}</p>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {allowClear && value && !disabled && (
          <Button type="button" variant="ghost" size="icon" onClick={() => onChange('')} title="Limpiar">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Modal de creación inline */}
      {createForm && (
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{createTitle}</DialogTitle>
            </DialogHeader>
            {createForm({
              onSuccess: handleCreated,
              onCancel: () => setCreateOpen(false),
            })}
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
