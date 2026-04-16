'use client'

/**
 * FamilyCombobox — selector de familia con buscador integrado.
 *
 * Escala a cualquier cantidad de familias. Filtra en memoria (los datos
 * ya están cargados en el cliente). Compatible con shadcn Command/Popover.
 *
 * Uso como filtro:
 *   <FamilyCombobox
 *     families={families}
 *     value={filters.family}
 *     onValueChange={(v) => setFilter('family', v)}
 *     allowAll
 *   />
 *
 * Uso en formulario (sin opción "Todas"):
 *   <FamilyCombobox
 *     families={availableFamilies}
 *     value={selectedFamilyId ?? ''}
 *     onValueChange={setSelectedFamilyId}
 *     allowNull
 *     nullLabel="Sin preferencia"
 *     nullDescription="El sistema asignará automáticamente"
 *   />
 */

import * as React from 'react'
import { Check, ChevronsUpDown, Search, Users, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

export interface FamilyOption {
  id: string
  name: string
  code: string
  color?: string | null
  isOwnFamily?: boolean
}

interface FamilyComboboxProps {
  families: FamilyOption[]
  /** ID de la familia seleccionada. Usa 'all' para "Todas" o '' para null/sin preferencia. */
  value: string
  onValueChange: (value: string) => void
  /** Muestra la opción "Todas las áreas" (para filtros) */
  allowAll?: boolean
  /** Muestra la opción "Sin preferencia" con valor '' (para formularios) */
  allowNull?: boolean
  nullLabel?: string
  nullDescription?: string
  placeholder?: string
  disabled?: boolean
  className?: string
  /** Muestra el botón X para limpiar */
  allowClear?: boolean
  /** Ancho del popover */
  popoverWidth?: string
}

export function FamilyCombobox({
  families,
  value,
  onValueChange,
  allowAll = false,
  allowNull = false,
  nullLabel = 'Sin preferencia',
  nullDescription,
  placeholder = 'Seleccionar área...',
  disabled = false,
  className,
  allowClear = false,
  popoverWidth = '280px',
}: FamilyComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')

  // Familia actualmente seleccionada
  const selectedFamily = React.useMemo(() => {
    if (!value || value === 'all') return null
    return families.find(f => f.id === value) ?? null
  }, [value, families])

  // Familias filtradas por búsqueda
  const filteredFamilies = React.useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return families
    return families.filter(
      f =>
        f.name.toLowerCase().includes(q) ||
        f.code.toLowerCase().includes(q)
    )
  }, [families, search])

  // Label del trigger
  const triggerLabel = React.useMemo(() => {
    if (value === 'all' || (allowAll && !value)) return 'Todas las áreas'
    if (!value && allowNull) return nullLabel
    if (selectedFamily) return selectedFamily.name
    return placeholder
  }, [value, allowAll, allowNull, selectedFamily, nullLabel, placeholder])

  const handleSelect = (newValue: string) => {
    onValueChange(newValue)
    setOpen(false)
    setSearch('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onValueChange(allowAll ? 'all' : '')
    setSearch('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          title={selectedFamily?.name ?? triggerLabel}
          className={cn('w-full justify-between font-normal min-w-[180px]', className)}
          disabled={disabled}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {selectedFamily ? (
              <>
                <span
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: selectedFamily.color ?? '#6366f1' }}
                />
                <span className="truncate">{selectedFamily.name}</span>
                {selectedFamily.isOwnFamily && (
                  <Badge variant="secondary" className="text-xs px-1 py-0 flex-shrink-0">
                    Mi área
                  </Badge>
                )}
              </>
            ) : (
              <>
                <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className={cn(value === 'all' || allowAll ? '' : 'text-muted-foreground', 'truncate')}>
                  {triggerLabel}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {allowClear && value && value !== 'all' && (
              <X
                className="h-3.5 w-3.5 opacity-50 hover:opacity-100"
                onClick={handleClear}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-40" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        style={{ width: popoverWidth }}
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar área..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No se encontraron áreas</CommandEmpty>

            {/* Opción "Todas las áreas" */}
            {allowAll && (
              <CommandGroup>
                <CommandItem
                  value="all"
                  onSelect={() => handleSelect('all')}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn('mr-2 h-4 w-4', value === 'all' ? 'opacity-100' : 'opacity-0')}
                  />
                  <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Todas las áreas</span>
                </CommandItem>
              </CommandGroup>
            )}

            {/* Opción "Sin preferencia" */}
            {allowNull && (
              <CommandGroup>
                <CommandItem
                  value=""
                  onSelect={() => handleSelect('')}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn('mr-2 h-4 w-4', !value ? 'opacity-100' : 'opacity-0')}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{nullLabel}</span>
                    {nullDescription && (
                      <span className="text-xs text-muted-foreground">{nullDescription}</span>
                    )}
                  </div>
                </CommandItem>
              </CommandGroup>
            )}

            {(allowAll || allowNull) && filteredFamilies.length > 0 && (
              <CommandSeparator />
            )}

            {/* Lista de familias */}
            {filteredFamilies.length > 0 && (
              <CommandGroup heading={families.length > 5 ? `${filteredFamilies.length} áreas` : undefined}>
                {/* Mi área primero */}
                {filteredFamilies
                  .filter(f => f.isOwnFamily)
                  .map(f => (
                    <CommandItem
                      key={f.id}
                      value={f.id}
                      onSelect={() => handleSelect(f.id)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn('mr-2 h-4 w-4 flex-shrink-0', value === f.id ? 'opacity-100' : 'opacity-0')}
                      />
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0 mr-2"
                        style={{ backgroundColor: f.color ?? '#6366f1' }}
                      />
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <span className="font-medium break-words">{f.name}</span>
                        <Badge variant="secondary" className="text-xs px-1 py-0 flex-shrink-0">
                          Mi área
                        </Badge>
                      </div>
                    </CommandItem>
                  ))}
                {/* Resto de familias */}
                {filteredFamilies
                  .filter(f => !f.isOwnFamily)
                  .map(f => (
                    <CommandItem
                      key={f.id}
                      value={f.id}
                      onSelect={() => handleSelect(f.id)}
                      className="cursor-pointer py-3"
                    >
                      <Check
                        className={cn('mr-2 h-4 w-4 flex-shrink-0 self-start mt-0.5', value === f.id ? 'opacity-100' : 'opacity-0')}
                      />
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0 mr-2 mt-1"
                        style={{ backgroundColor: f.color ?? '#6366f1' }}
                      />
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="break-words leading-snug">{f.name}</span>
                        <span className="text-xs text-muted-foreground font-mono mt-0.5">{f.code}</span>
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
