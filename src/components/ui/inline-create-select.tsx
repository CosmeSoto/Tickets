'use client'

/**
 * InlineCreateSelect — select con búsqueda + CRUD inline (crear, editar, eliminar)
 * sin salir del formulario actual.
 */

import { useState, ReactNode } from 'react'
import { Check, ChevronsUpDown, Plus, X, Pencil, Trash2 } from 'lucide-react'
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
  createLabel?: string
  createTitle?: string
  editTitle?: string
  /** Formulario de creación/edición. Recibe item (undefined = crear) */
  createForm?: (props: {
    item?: InlineSelectOption
    onSuccess: (item: InlineSelectOption) => void
    onCancel: () => void
  }) => ReactNode
  /** Función para eliminar un item. Debe retornar Promise<void> */
  onDelete?: (id: string) => Promise<void>
  /** Mensaje de confirmación al eliminar */
  deleteConfirmMessage?: string
  /** Callback después de crear o editar un item (útil para recargar la lista) */
  onAfterSave?: (item: InlineSelectOption, isEdit: boolean) => void
  /** Callback al elegir un item existente de la lista (no al crear) */
  onSelected?: (item: InlineSelectOption) => void
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
  editTitle = 'Editar',
  createForm,
  onDelete,
  deleteConfirmMessage = '¿Eliminar este elemento? Esta acción no se puede deshacer.',
  onAfterSave,
  onSelected,
}: InlineCreateSelectProps) {
  const [open, setOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<InlineSelectOption | undefined>(undefined)
  const [deletingItem, setDeletingItem] = useState<InlineSelectOption | null>(null)
  const [deleting, setDeleting] = useState(false)

  const selected = options.find(o => o.id === value)

  const openCreate = () => {
    setEditingItem(undefined)
    setOpen(false)
    setFormOpen(true)
  }
  const openEdit = (item: InlineSelectOption, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingItem(item)
    setOpen(false)
    setFormOpen(true)
  }

  const handleSaved = (item: InlineSelectOption) => {
    const isEdit = !!editingItem
    setFormOpen(false)
    setEditingItem(undefined)
    // Si es creación, seleccionar el nuevo item
    if (!isEdit) onChange(item.id)
    // Notificar al padre para que recargue la lista
    onAfterSave?.(item, isEdit)
  }

  const handleDelete = async () => {
    if (!deletingItem || !onDelete) return
    setDeleting(true)
    try {
      await onDelete(deletingItem.id)
      if (value === deletingItem.id) onChange('')
    } finally {
      setDeleting(false)
      setDeletingItem(null)
    }
  }

  const canEdit = !!createForm
  const canDelete = !!onDelete

  return (
    <>
      <div className='flex gap-2'>
        <Popover open={open} onOpenChange={setOpen} modal={false}>
          <PopoverTrigger asChild>
            <Button
              type='button'
              variant='outline'
              role='combobox'
              aria-expanded={open}
              disabled={disabled}
              className='w-full justify-between font-normal'
            >
              <span className={cn('truncate', !selected && 'text-muted-foreground')}>
                {selected ? selected.name : placeholder}
              </span>
              <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className='w-[400px] p-0 max-h-[400px] overflow-hidden'
            align='start'
            side='bottom'
            sideOffset={4}
          >
            <Command shouldFilter={true} className='h-full'>
              <CommandInput placeholder='Buscar...' className='border-b' />
              <CommandList className='max-h-[340px] overflow-y-scroll scroll-smooth'>
                {/* Botón crear */}
                {createForm && (
                  <CommandGroup>
                    <CommandItem
                      value='__create__'
                      onSelect={openCreate}
                      className='text-primary font-medium'
                    >
                      <Plus className='mr-2 h-4 w-4' />
                      {createLabel}
                    </CommandItem>
                  </CommandGroup>
                )}
                <CommandEmpty>
                  <div className='py-3 text-center space-y-2'>
                    <p className='text-sm text-muted-foreground'>Sin resultados.</p>
                    {createForm && (
                      <Button type='button' size='sm' variant='outline' onClick={openCreate}>
                        <Plus className='mr-1.5 h-3.5 w-3.5' />
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
                      onSelect={() => {
                        const isNewSelection = opt.id !== value
                        onChange(opt.id)
                        if (isNewSelection) onSelected?.(opt)
                        setOpen(false)
                      }}
                      className='group'
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4 shrink-0',
                          value === opt.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <div className='flex-1 min-w-0'>
                        <p className='truncate text-sm'>{opt.name}</p>
                        {opt.description && (
                          <p className='truncate text-xs text-muted-foreground'>
                            {opt.description}
                          </p>
                        )}
                      </div>
                      {/* Acciones editar/eliminar — visibles al hover */}
                      {(canEdit || canDelete) && (
                        <div className='flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity'>
                          {canEdit && (
                            <button
                              type='button'
                              onClick={e => openEdit(opt, e)}
                              className='p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground'
                              title='Editar'
                            >
                              <Pencil className='h-3 w-3' />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type='button'
                              onClick={e => {
                                e.stopPropagation()
                                setOpen(false)
                                setDeletingItem(opt)
                              }}
                              className='p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive'
                              title='Eliminar'
                            >
                              <Trash2 className='h-3 w-3' />
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

        {allowClear && value && !disabled && (
          <Button
            type='button'
            variant='ghost'
            size='icon'
            onClick={() => onChange('')}
            title='Limpiar'
          >
            <X className='h-4 w-4' />
          </Button>
        )}
      </div>

      {/* Modal crear/editar */}
      {createForm && (
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent className='max-w-lg' aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>{editingItem ? editTitle : createTitle}</DialogTitle>
            </DialogHeader>
            <div onSubmitCapture={e => e.stopPropagation()}>
              {createForm({
                item: editingItem,
                onSuccess: handleSaved,
                onCancel: () => {
                  setFormOpen(false)
                  setEditingItem(undefined)
                },
              })}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Confirmar eliminar */}
      <AlertDialog open={!!deletingItem} onOpenChange={o => !o && setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar &quot;{deletingItem?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>{deleteConfirmMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
