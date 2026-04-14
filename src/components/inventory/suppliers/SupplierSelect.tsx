'use client'

import { useState, useEffect, useCallback } from 'react'
import { Check, ChevronsUpDown, X, Plus, Loader2, Pencil, PowerOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { SupplierForm } from './SupplierForm'
import { useToast } from '@/hooks/use-toast'

interface Supplier {
  id: string
  name: string
  taxId?: string | null
  type: string
  isActive?: boolean
}

interface SupplierSelectProps {
  value?: string | null
  onChange: (supplierId: string | null) => void
  disabled?: boolean
  placeholder?: string
  familyId?: string
  allowCreate?: boolean
}

export function SupplierSelect({
  value,
  onChange,
  disabled,
  placeholder = 'Seleccionar proveedor',
  familyId,
  allowCreate = true,
}: SupplierSelectProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [deactivatingSupplier, setDeactivatingSupplier] = useState<Supplier | null>(null)
  const [deactivating, setDeactivating] = useState(false)

  const loadSuppliers = useCallback(() => {
    setLoading(true)
    const url = familyId
      ? `/api/inventory/suppliers?active=true&familyId=${familyId}`
      : '/api/inventory/suppliers?active=true'
    fetch(url)
      .then(r => r.json())
      .then(d => setSuppliers(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [familyId])

  useEffect(() => { loadSuppliers() }, [loadSuppliers])

  const selected = suppliers.find(s => s.id === value)

  const openCreate = () => { setEditingSupplier(null); setOpen(false); setFormOpen(true) }
  const openEdit = (s: Supplier, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingSupplier(s)
    setOpen(false)
    setFormOpen(true)
  }

  const handleSaved = (supplier: Supplier) => {
    setFormOpen(false)
    setEditingSupplier(null)
    loadSuppliers()
    // Si es creación, seleccionar el nuevo proveedor
    if (!editingSupplier) onChange(supplier.id)
  }

  const handleDeactivate = async () => {
    if (!deactivatingSupplier) return
    setDeactivating(true)
    try {
      // Verificar si tiene activos asociados antes de desactivar
      const res = await fetch(`/api/inventory/suppliers/${deactivatingSupplier.id}`)
      if (res.ok) {
        const data = await res.json()
        const total = (data._count?.equipment ?? 0) + (data._count?.consumables ?? 0) + (data._count?.software_licenses ?? 0)
        if (total > 0) {
          toast({
            title: 'No se puede desactivar',
            description: `Este proveedor tiene ${total} activo(s) asociado(s). Reasígnalos antes de desactivarlo.`,
            variant: 'destructive',
          })
          setDeactivatingSupplier(null)
          return
        }
      }

      const patchRes = await fetch(`/api/inventory/suppliers/${deactivatingSupplier.id}`, { method: 'PATCH' })
      if (!patchRes.ok) throw new Error('Error al desactivar')

      toast({ title: 'Proveedor desactivado', description: deactivatingSupplier.name })
      if (value === deactivatingSupplier.id) onChange(null)
      loadSuppliers()
    } catch {
      toast({ title: 'Error', description: 'No se pudo desactivar el proveedor', variant: 'destructive' })
    } finally {
      setDeactivating(false)
      setDeactivatingSupplier(null)
    }
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
          <PopoverContent className="w-[420px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar proveedor..." />
              <CommandList>
                {allowCreate && (
                  <CommandGroup>
                    <CommandItem
                      value="__create__"
                      onSelect={openCreate}
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
                      <Button type="button" size="sm" variant="outline" onClick={openCreate}>
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
                      onSelect={() => { onChange(s.id === value ? null : s.id); setOpen(false) }}
                      className="group"
                    >
                      <Check className={cn('mr-2 h-4 w-4 shrink-0', value === s.id ? 'opacity-100' : 'opacity-0')} />
                      <span className="flex-1 truncate">{s.name}</span>
                      {s.taxId && <span className="ml-2 text-xs text-muted-foreground shrink-0">{s.taxId}</span>}
                      {/* Acciones editar/desactivar al hover */}
                      <div className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => openEdit(s, e)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                          title="Editar proveedor"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setOpen(false); setDeactivatingSupplier(s) }}
                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          title="Desactivar proveedor"
                        >
                          <PowerOff className="h-3 w-3" />
                        </button>
                      </div>
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

      {/* Modal crear/editar */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editingSupplier ? 'Editar proveedor' : 'Nuevo proveedor'}</DialogTitle>
          </DialogHeader>
          <SupplierForm
            supplier={editingSupplier}
            defaultFamilyId={familyId}
            onSuccess={handleSaved}
            onCancel={() => { setFormOpen(false); setEditingSupplier(null) }}
          />
        </DialogContent>
      </Dialog>

      {/* Confirmar desactivar */}
      <AlertDialog open={!!deactivatingSupplier} onOpenChange={o => !o && setDeactivatingSupplier(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar "{deactivatingSupplier?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              El proveedor quedará inactivo y no aparecerá en nuevos formularios.
              Sus asociaciones existentes con equipos, consumibles y licencias se conservarán.
              Solo se puede desactivar si no tiene activos asociados actualmente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivating}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              disabled={deactivating}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deactivating ? 'Verificando...' : 'Desactivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
