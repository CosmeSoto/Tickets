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
import { extractCatchError } from '@/lib/utils/api-error'
import { toast } from 'sonner'
import type { Supplier } from '@/types/inventory/supplier'

const PAGE_SIZE = 30

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
  const { data: session } = useSession()

  // Permisos: crear/editar → canManageInventory; desactivar → ADMIN o SuperAdmin;
  // eliminar permanentemente → solo SuperAdmin (igual que en el listado de Proveedores)
  const userRole = session?.user?.role
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin === true
  const canEdit =
    allowCreate &&
    (userRole === 'ADMIN' || isSuperAdmin || (session?.user as any)?.canManageInventory === true)
  const canDeactivate = userRole === 'ADMIN' || isSuperAdmin
  const canDelete = isSuperAdmin
  const [open, setOpen] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [formDirty, setFormDirty] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)

  const loadSuppliers = useCallback(
    async (search?: string, pageNum = 1, append = false) => {
      if (append) setLoadingMore(true)
      else setLoading(true)
      try {
        const params = new URLSearchParams({
          active: 'true',
          limit: String(PAGE_SIZE),
          page: String(pageNum),
        })
        if (familyId) params.set('familyId', familyId)
        if (search?.trim()) params.set('search', search.trim())
        const res = await fetch(`/api/inventory/suppliers?${params}`)
        if (!res.ok) return
        const data = await res.json()
        const list: Supplier[] = Array.isArray(data) ? data : (data.suppliers ?? [])
        const pages = data.pagination?.pages ?? 1
        setPage(pageNum)
        setTotalPages(pages)
        setSuppliers(prev => {
          if (!append) return list
          const merged = [...prev]
          for (const s of list) {
            if (!merged.some(x => x.id === s.id)) merged.push(s)
          }
          return merged
        })
      } catch {
        /* silencioso */
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [familyId]
  )

  // Búsqueda server-side con debounce (reinicia a página 1)
  useEffect(() => {
    const timer = setTimeout(() => loadSuppliers(searchQuery, 1, false), 300)
    return () => clearTimeout(timer)
  }, [searchQuery, loadSuppliers])

  // Asegurar que el proveedor seleccionado aparezca aunque no esté en la página actual
  useEffect(() => {
    if (!value) return
    fetch(`/api/inventory/suppliers/${value}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!data?.id) return
        setSuppliers(prev => (prev.some(s => s.id === data.id) ? prev : [data, ...prev]))
      })
      .catch(() => {})
  }, [value])

  const selected = suppliers.find(s => s.id === value)

  const openCreate = () => {
    setEditingSupplier(null)
    setFormDirty(false)
    setOpen(false)
    setFormOpen(true)
  }
  const openEdit = (s: Supplier, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingSupplier(s)
    setFormDirty(false)
    setOpen(false)
    setFormOpen(true)
  }

  const closeForm = () => {
    if (
      formDirty &&
      !window.confirm(
        'Hay cambios sin guardar en el proveedor. ¿Cerrar y descartar lo que estabas llenando?'
      )
    ) {
      return
    }
    setFormDirty(false)
    setFormOpen(false)
    setEditingSupplier(null)
  }

  const handleSaved = (supplier: Supplier) => {
    const wasEdit = !!editingSupplier
    setFormDirty(false)
    setFormOpen(false)
    setEditingSupplier(null)
    loadSuppliers(searchQuery, 1, false)
    if (!wasEdit) {
      onChange(supplier.id)
      toast.success('Proveedor creado', {
        description: `${supplier.name} fue creado y seleccionado`,
      })
    } else {
      toast.success('Proveedor actualizado', {
        description: `${supplier.name} fue actualizado exitosamente`,
      })
    }
  }

  const handleListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (loadingMore || loading || page >= totalPages) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 48) {
      loadSuppliers(searchQuery, page + 1, true)
    }
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
            toast.error('No se puede desactivar', {
              description: `Este proveedor tiene ${total} activo(s) asociado(s). Reasígnalos antes de desactivarlo.`,
            })
            return
          }
        }
        const res = await fetch(`/api/inventory/suppliers/${confirm.supplier.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: false }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          toast.error('No se puede desactivar', {
            description: data.error || 'Error al desactivar',
          })
          return
        }
        toast.success('Proveedor desactivado', { description: confirm.supplier.name })
        if (value === confirm.supplier.id) onChange(null)
        loadSuppliers(searchQuery, 1, false)
      } else {
        // Eliminar permanente
        const res = await fetch(`/api/inventory/suppliers/${confirm.supplier.id}`, {
          method: 'DELETE',
        })
        const data = await res.json()
        if (!res.ok) {
          toast.error('No se puede eliminar', { description: data.error })
          return
        }
        toast.success('Proveedor eliminado', { description: confirm.supplier.name })
        if (value === confirm.supplier.id) onChange(null)
        loadSuppliers(searchQuery, 1, false)
      }
    } catch (err) {
      toast.error('Error', {
        description: extractCatchError(err, 'No se pudo completar la acción'),
      })
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
            <Command shouldFilter={false}>
              <CommandInput
                placeholder='Buscar proveedor...'
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <CommandList className='max-h-[300px] overflow-y-auto' onScroll={handleListScroll}>
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
                        const nextId = s.id === value ? null : s.id
                        const isNewSelection = nextId !== null && nextId !== value
                        onChange(nextId)
                        if (isNewSelection) {
                          toast.success('Proveedor seleccionado', { description: s.name })
                        }
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
                      {(canEdit || canDeactivate || canDelete) && (
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
                          {canDeactivate && (
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
                          {canDelete && (
                            <button
                              type='button'
                              onClick={() => {
                                setOpen(false)
                                setConfirm({ type: 'delete', supplier: s })
                              }}
                              className='p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive'
                              title='Eliminar proveedor (Solo Super Admin)'
                            >
                              <Trash2 className='h-3.5 w-3.5' />
                            </button>
                          )}
                        </div>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
                {loadingMore && (
                  <div className='flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground'>
                    <Loader2 className='h-3.5 w-3.5 animate-spin' />
                    Cargando más...
                  </div>
                )}
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
      <Dialog
        open={formOpen}
        onOpenChange={open => {
          if (open) {
            setFormOpen(true)
            return
          }
          closeForm()
        }}
      >
        <DialogContent
          className='w-[min(98vw,56rem)] max-w-4xl max-h-[92vh] overflow-y-auto'
          aria-describedby={undefined}
        >
          <DialogHeader>
            <DialogTitle>{editingSupplier ? 'Editar proveedor' : 'Nuevo proveedor'}</DialogTitle>
          </DialogHeader>
          <div onSubmit={e => e.stopPropagation()}>
            <SupplierForm
              supplier={editingSupplier}
              defaultFamilyId={familyId}
              embedded
              onDirtyChange={setFormDirty}
              onSuccess={handleSaved}
              onCancel={closeForm}
            />
          </div>
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
