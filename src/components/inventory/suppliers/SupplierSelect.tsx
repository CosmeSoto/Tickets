'use client'

import { useState, useEffect, useCallback } from 'react'
import { Check, ChevronsUpDown, X, Plus, Loader2, Pencil, PowerOff, Trash2 } from 'lucide-react'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useSession } from 'next-auth/react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { SupplierForm } from './SupplierForm'
import { useToast } from '@/hooks/use-toast'
import { extractCatchError } from '@/lib/utils/api-error'

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

type ConfirmAction = { type: 'deactivate' | 'delete'; supplier: Supplier }

export function SupplierSelect({
  value,
  onChange,
  disabled,
  placeholder = 'Seleccionar proveedor',
  familyId,
  allowCreate = true,
}: SupplierSelectProps) {
  const { toast } = useToast()
  const { data: session } = useSession()

  // Permisos: crear/editar → canManageInventory; desactivar/eliminar → solo ADMIN
  const userRole = session?.user?.role
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin === true
  const canEdit =
    allowCreate &&
    (userRole === 'ADMIN' || isSuperAdmin || (session?.user as any)?.canManageInventory === true)
  const canDeactivateOrDelete = userRole === 'ADMIN' || isSuperAdmin
  const [open, setOpen] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

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

  useEffect(() => {
    loadSuppliers()
  }, [loadSuppliers])

  const selected = suppliers.find(s => s.id === value)

  const openCreate = () => {
    setEditingSupplier(null)
    setOpen(false)
    setFormOpen(true)
  }
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
    if (!editingSupplier) onChange(supplier.id)
  }

  const handleConfirmAction = async () => {
    if (!confirm) return
    setActionLoading(true)
    try {
      if (confirm.type === 'deactivate') {
        // Verificar activos antes de desactivar
        const check = await fetch(`/api/inventory/suppliers/${confirm.supplier.id}`)
        if (check.ok) {
          const data = await check.json()
          const total =
            (data._count?.equipment ?? 0) +
            (data._count?.consumables ?? 0) +
            (data._count?.software_licenses ?? 0)
          if (total > 0) {
            toast({
              title: 'No se puede desactivar',
              description: `Este proveedor tiene ${total} activo(s) asociado(s). Reasígnalos antes de desactivarlo.`,
              variant: 'destructive',
            })
            return
          }
        }
        const res = await fetch(`/api/inventory/suppliers/${confirm.supplier.id}`, {
          method: 'PATCH',
        })
        if (!res.ok) throw new Error()
        toast({ title: 'Proveedor desactivado', description: confirm.supplier.name })
        if (value === confirm.supplier.id) onChange(null)
        loadSuppliers()
      } else {
        // Eliminar permanente
        const res = await fetch(`/api/inventory/suppliers/${confirm.supplier.id}`, {
          method: 'DELETE',
        })
        const data = await res.json()
        if (!res.ok) {
          toast({ title: 'No se puede eliminar', description: data.error, variant: 'destructive' })
          return
        }
        toast({ title: 'Proveedor eliminado', description: confirm.supplier.name })
        if (value === confirm.supplier.id) onChange(null)
        loadSuppliers()
      }
    } catch (err) {
      toast({ title: 'Error', description: extractCatchError(err, 'No se pudo completar la acción'), variant: 'destructive' })
    } finally {
      setActionLoading(false)
      setConfirm(null)
    }
  }

  return (
    <>
      <div className='flex gap-2'>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant='outline'
              role='combobox'
              aria-expanded={open}
              disabled={disabled || loading}
              className='w-full justify-between font-normal'
            >
              {loading ? (
                <span className='flex items-center gap-2 text-muted-foreground'>
                  <Loader2 className='h-3.5 w-3.5 animate-spin' /> Cargando...
                </span>
              ) : selected ? (
                <span className='truncate'>
                  {selected.name}
                  {selected.taxId ? ` (${selected.taxId})` : ''}
                </span>
              ) : (
                <span className='text-muted-foreground'>{placeholder}</span>
              )}
              <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
            </Button>
          </PopoverTrigger>
          <PopoverContent className='w-[460px] p-0' align='start'>
            <Command>
              <CommandInput placeholder='Buscar proveedor...' />
              <CommandList>
                {canEdit && (
                  <CommandGroup>
                    <CommandItem
                      value='__create__'
                      onSelect={openCreate}
                      className='text-primary font-medium'
                    >
                      <Plus className='mr-2 h-4 w-4' />
                      Crear nuevo proveedor
                    </CommandItem>
                  </CommandGroup>
                )}
                <CommandEmpty>
                  <div className='py-3 text-center space-y-2'>
                    <p className='text-sm text-muted-foreground'>No se encontraron proveedores.</p>
                    {canEdit && (
                      <Button type='button' size='sm' variant='outline' onClick={openCreate}>
                        <Plus className='mr-1.5 h-3.5 w-3.5' />
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
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4 shrink-0',
                          value === s.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <span className='flex-1 truncate'>{s.name}</span>
                      {s.taxId && (
                        <span className='ml-2 text-xs text-muted-foreground shrink-0'>
                          {s.taxId}
                        </span>
                      )}
                      {/* Acciones según rol */}
                      {(canEdit || canDeactivateOrDelete) && (
                        <div
                          className='flex items-center gap-0.5 ml-2'
                          onClick={e => e.stopPropagation()}
                        >
                          {canEdit && (
                            <button
                              type='button'
                              onClick={e => openEdit(s, e)}
                              className='p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground'
                              title='Editar proveedor'
                            >
                              <Pencil className='h-3.5 w-3.5' />
                            </button>
                          )}
                          {canDeactivateOrDelete && (
                            <button
                              type='button'
                              onClick={() => {
                                setOpen(false)
                                setConfirm({ type: 'deactivate', supplier: s })
                              }}
                              className='p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 text-muted-foreground hover:text-amber-700 dark:hover:text-amber-400'
                              title='Desactivar proveedor'
                            >
                              <PowerOff className='h-3.5 w-3.5' />
                            </button>
                          )}
                          {canDeactivateOrDelete && (
                            <button
                              type='button'
                              onClick={() => {
                                setOpen(false)
                                setConfirm({ type: 'delete', supplier: s })
                              }}
                              className='p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive'
                              title='Eliminar proveedor'
                            >
                              <Trash2 className='h-3.5 w-3.5' />
                            </button>
                          )}
                        </div>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {value && !disabled && (
          <Button
            type='button'
            variant='ghost'
            size='icon'
            onClick={() => onChange(null)}
            title='Quitar proveedor'
          >
            <X className='h-4 w-4' />
          </Button>
        )}
      </div>

      {/* Modal crear/editar */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className='max-w-2xl' aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editingSupplier ? 'Editar proveedor' : 'Nuevo proveedor'}</DialogTitle>
          </DialogHeader>
          <SupplierForm
            supplier={editingSupplier}
            defaultFamilyId={familyId}
            onSuccess={handleSaved}
            onCancel={() => {
              setFormOpen(false)
              setEditingSupplier(null)
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Confirmar desactivar / eliminar */}
      <AlertDialog open={!!confirm} onOpenChange={o => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.type === 'delete'
                ? `¿Eliminar "${confirm.supplier.name}"?`
                : `¿Desactivar "${confirm?.supplier.name}"?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.type === 'delete' ? (
                <>
                  Esta acción es <strong>permanente</strong> y no se puede deshacer. Solo es posible
                  si el proveedor no tiene activos asociados.
                </>
              ) : (
                <>
                  El proveedor quedará inactivo y no aparecerá en nuevos formularios. Sus
                  asociaciones existentes se conservarán. Solo es posible si no tiene activos
                  asociados actualmente.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              disabled={actionLoading}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {actionLoading
                ? 'Verificando...'
                : confirm?.type === 'delete'
                  ? 'Eliminar'
                  : 'Desactivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
