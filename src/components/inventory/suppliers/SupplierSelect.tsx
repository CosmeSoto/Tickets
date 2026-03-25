'use client'

import { useState, useEffect } from 'react'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface Supplier {
  id: string
  name: string
  taxId?: string | null
  type: string
}

interface SupplierSelectProps {
  value?: string | null
  onChange: (supplierId: string | null) => void
  disabled?: boolean
  placeholder?: string
}

export function SupplierSelect({ value, onChange, disabled, placeholder = 'Seleccionar proveedor' }: SupplierSelectProps) {
  const [open, setOpen] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch('/api/inventory/suppliers?active=true&limit=200')
      .then(r => r.json())
      .then(d => setSuppliers(d.suppliers || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const selected = suppliers.find(s => s.id === value)

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || loading}
            className="w-full justify-between font-normal"
          >
            {selected
              ? `${selected.name}${selected.taxId ? ` (${selected.taxId})` : ''}`
              : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar proveedor..." />
            <CommandList>
              <CommandEmpty>No se encontraron proveedores.</CommandEmpty>
              <CommandGroup>
                {suppliers.map(s => (
                  <CommandItem
                    key={s.id}
                    value={`${s.name} ${s.taxId || ''}`}
                    onSelect={() => {
                      onChange(s.id === value ? null : s.id)
                      setOpen(false)
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value === s.id ? 'opacity-100' : 'opacity-0')} />
                    <span className="flex-1">{s.name}</span>
                    {s.taxId && <span className="ml-2 text-xs text-muted-foreground">{s.taxId}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && !disabled && (
        <Button type="button" variant="ghost" size="icon" onClick={() => onChange(null)} title="Quitar proveedor">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
