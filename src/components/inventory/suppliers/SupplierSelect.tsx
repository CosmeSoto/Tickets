'use client'

import { useState, useEffect, useCallback } from 'react'
import { Check, ChevronsUpDown, X, Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { SupplierForm } from './SupplierForm'

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
  /** Muestra botón para crear proveedor inline. Default: true */
  allowCreate?: boolean
}

export function SupplierSelect({
  value,
  onChange,
  disabled,
  placeholder = 'Seleccionar proveedor',
  allowCreate = true,
}: SupplierSelectProps) {
  const [open, setOpen] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const loadSuppliers = useCallback(() => {
    setLoading(true)
    fetch('/api/inventory/suppliers?active=true')
      .then(r => r.json())
      .then(d => setSuppliers(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadSuppliers() }, [loadSuppliers])

  const selected = suppliers.find(s => s.id === value)

  const handleCreated = (supplier: Supplier) => {
    setCreateOpen(false)
    loadSuppliers()
    onChange(supplier.id)
  }

  return (
    <>
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
              {loading ? (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando...
                </span>
              ) : selected ? (
                <span className="truncate">
                  {selected.name}{selected.taxId ? ` (${selected.taxId})` : ''}
                </span>
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar proveedor..." />
              <CommandList>
                {/* Opción de crear nuevo al inicio */}
                {allowCreate && (
                  <CommandGroup>
                    <CommandItem
                      value="__create__"
                      onSelect={() => { setOpen(false); setCreateOpen(true) }}
                      className="text-primary font-medium"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Crear nuevo proveedor
                    </CommandItem>
                  </CommandGroup>
                )}
                <CommandEmpty>
                  <div className="py-3 text-center space-y-2">
                    <p className="text-sm text-muted-foreground">No se encontraron proveedores.</p>
                    {allowCreate && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => { setOpen(false); setCreateOpen(true) }}
                      >
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Crear proveedor
                      </Button>
                    )}
                  </div>
                </CommandEmpty>
                <CommandGroup heading={suppliers.length > 0 ? 'Proveedores' : undefined}>
                  {suppliers.map(s => (
                    <CommandItem
                      key={s.id}
                      value={`${s.name} ${s.taxId || ''}`}
                      onSelect={() => {
                        onChange(s.id === value ? null : s.id)
                        setOpen(false)
                      }}
                    >
                      <Check className={cn('mr-2 h-4 w-4 shrink-0', value === s.id ? 'opacity-100' : 'opacity-0')} />
                      <span className="flex-1 truncate">{s.name}</span>
                      {s.taxId && <span className="ml-2 text-xs text-muted-foreground shrink-0">{s.taxId}</span>}
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

      {/* Modal de creación inline */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nuevo proveedor</DialogTitle>
          </DialogHeader>
          <SupplierForm
            onSuccess={handleCreated}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
