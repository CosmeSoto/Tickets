/**
 * Attribute Manager Dialog Component
 * Gestiona atributos de un tipo específico con tabla profesional
 */

'use client'

import { useEffect, useState } from 'react'
import { Plus, Edit, Trash2, MoveUp, MoveDown, Download, Eye, EyeOff } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AttributeFormDialog } from './attribute-form-dialog'
import {
  useAttributeManagement,
  type Attribute,
  type TypeKind,
  type CreateAttributeData,
} from '@/hooks/inventory/use-attribute-management'
import { useExport } from '@/hooks/common/use-export'

// ── Types ──────────────────────────────────────────────────────────────────

interface ExportColumnConfig<T> {
  header: string
  accessor: keyof T | ((item: T) => string | number)
}

interface AttributeManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  typeKind: TypeKind
  typeId: string
  typeName: string
  familyColor?: string | null
  /** Callback cuando cambia el número de atributos */
  onAttributesChange?: () => void
}

const ATTRIBUTE_TYPE_LABELS: Record<string, string> = {
  text: 'Texto',
  number: 'Número',
  select: 'Lista',
  date: 'Fecha',
  boolean: 'Sí/No',
}

// ── Component ──────────────────────────────────────────────────────────────

export function AttributeManagerDialog({
  open,
  onOpenChange,
  typeKind,
  typeId,
  typeName,
  onAttributesChange,
}: AttributeManagerDialogProps) {
  const {
    attributes,
    loading,
    saving,
    loadAttributes,
    createAttribute,
    updateAttribute,
    deleteAttribute,
    reorderAttributes,
  } = useAttributeManagement(typeKind, typeId)

  const [formOpen, setFormOpen] = useState(false)
  const [editingAttribute, setEditingAttribute] = useState<Attribute | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [attributeToDelete, setAttributeToDelete] = useState<Attribute | null>(null)

  // Estado para paginación
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)

  // Export configuration
  const exportColumns: ExportColumnConfig<Attribute>[] = [
    { header: 'Nombre Técnico', accessor: 'attributeName' },
    { header: 'Etiqueta', accessor: 'attributeLabel' },
    {
      header: 'Tipo',
      accessor: (attr: Attribute) =>
        ATTRIBUTE_TYPE_LABELS[attr.attributeType] || attr.attributeType,
    },
    { header: 'Requerido', accessor: (attr: Attribute) => (attr.isRequired ? 'Sí' : 'No') },
    { header: 'Visible', accessor: (attr: Attribute) => (attr.isVisible ? 'Sí' : 'No') },
    { header: 'Texto de Ayuda', accessor: (attr: Attribute) => attr.helpText || '' },
  ]

  // Convert to format expected by useExport
  const exportColumnsForHook = exportColumns.map(col => {
    if (typeof col.accessor === 'string') {
      return {
        key: col.accessor,
        label: col.header,
      }
    } else {
      const accessorFn = col.accessor as (item: Attribute) => string | number
      return {
        key: '_computed',
        label: col.header,
        format: (_: any, row: Attribute) => String(accessorFn(row)),
      }
    }
  })

  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    getData: () => attributes,
    columns: exportColumnsForHook,
    filename: `atributos-${typeName.toLowerCase().replace(/\s+/g, '-')}`,
    title: `Atributos de ${typeName}`,
    subtitle: `${attributes.length} atributo${attributes.length !== 1 ? 's' : ''}`,
  })

  // Load attributes when dialog opens
  useEffect(() => {
    if (open) {
      loadAttributes()
    }
  }, [open, loadAttributes])

  // Handlers
  const handleCreate = () => {
    setEditingAttribute(null)
    setFormOpen(true)
  }

  const handleEdit = (attribute: Attribute) => {
    setEditingAttribute(attribute)
    setFormOpen(true)
  }

  const handleDeleteClick = (attribute: Attribute) => {
    setAttributeToDelete(attribute)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!attributeToDelete) return

    const success = await deleteAttribute(attributeToDelete.id)
    if (success) {
      setDeleteDialogOpen(false)
      setAttributeToDelete(null)
      // Notificar al padre que cambió el número de atributos
      onAttributesChange?.()
    }
  }

  const handleSave = async (data: CreateAttributeData): Promise<boolean> => {
    let success = false

    if (editingAttribute) {
      success = await updateAttribute(editingAttribute.id, data)
    } else {
      success = await createAttribute(data)
      // Notificar al padre solo cuando se crea (no cuando se edita)
      if (success) {
        onAttributesChange?.()
      }
    }

    if (success) {
      setFormOpen(false)
      setEditingAttribute(null)
    }

    return success
  }

  const handleReorder = async (attribute: Attribute, direction: 'up' | 'down') => {
    const currentIndex = attributes.findIndex(a => a.id === attribute.id)
    if (currentIndex === -1) return

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= attributes.length) return

    const reordered = [...attributes]
    const [removed] = reordered.splice(currentIndex, 1)
    reordered.splice(newIndex, 0, removed)

    await reorderAttributes(reordered.map(a => a.id))
  }

  const handleToggleVisible = async (attribute: Attribute) => {
    await updateAttribute(attribute.id, {
      isVisible: !attribute.isVisible,
    })
  }

  // Configuración de columnas para DataTable
  const columns: Column<Attribute>[] = [
    {
      key: 'attributeLabel',
      label: 'Atributo',
      sortable: true,
      render: (attr: Attribute) => (
        <div className='space-y-0.5'>
          <div className='font-medium text-sm'>{attr.attributeLabel}</div>
          <div className='text-xs text-muted-foreground font-mono'>{attr.attributeName}</div>
          {attr.helpText && (
            <div className='text-xs text-muted-foreground line-clamp-1'>{attr.helpText}</div>
          )}
          {attr.attributeType === 'select' &&
            attr.options?.options &&
            Array.isArray(attr.options.options) && (
              <div className='text-xs text-muted-foreground'>
                {attr.options.options.length} opciones:{' '}
                {attr.options.options.slice(0, 2).join(', ')}
                {attr.options.options.length > 2 && '...'}
              </div>
            )}
        </div>
      ),
    },
    {
      key: 'attributeType',
      label: 'Tipo',
      sortable: true,
      width: '120px',
      render: (attr: Attribute) => (
        <Badge variant='secondary' className='text-xs px-2 py-0.5'>
          {ATTRIBUTE_TYPE_LABELS[attr.attributeType]}
        </Badge>
      ),
    },
    {
      key: 'isRequired',
      label: 'Req.',
      sortable: true,
      width: '80px',
      render: (attr: Attribute) =>
        attr.isRequired ? (
          <div className='flex justify-center'>
            <Badge variant='destructive' className='text-xs px-1.5 py-0'>
              Sí
            </Badge>
          </div>
        ) : (
          <div className='flex justify-center'>
            <Badge variant='outline' className='text-xs px-1.5 py-0'>
              No
            </Badge>
          </div>
        ),
    },
    {
      key: 'isVisible',
      label: 'Vis.',
      sortable: true,
      width: '80px',
      render: (attr: Attribute) => (
        <div className='flex justify-center'>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant='ghost'
                  size='sm'
                  className='h-7 w-7 p-0'
                  onClick={() => handleToggleVisible(attr)}
                  disabled={saving}
                >
                  {attr.isVisible ? (
                    <Eye className='h-3.5 w-3.5 text-green-600' />
                  ) : (
                    <EyeOff className='h-3.5 w-3.5 text-gray-400' />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{attr.isVisible ? 'Visible en formularios' : 'Oculto en formularios'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      ),
    },
  ]

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='max-w-5xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Atributos de {typeName}</DialogTitle>
            <DialogDescription>
              Gestiona los atributos personalizados para este tipo
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-4'>
            <DataTable
              data={attributes}
              columns={columns}
              loading={loading}
              searchable={true}
              searchPlaceholder='Buscar atributo...'
              externalSearch={false}
              pagination={{
                page,
                limit,
                total: attributes.length,
                onPageChange: setPage,
                onLimitChange: newLimit => {
                  setLimit(newLimit)
                  setPage(1)
                },
              }}
              onExport={
                attributes.length > 0 ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant='outline' size='sm' disabled={exporting}>
                        <Download className='h-4 w-4 mr-2' />
                        Exportar
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='end'>
                      <DropdownMenuLabel>Formato</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={exportCSV}>CSV</DropdownMenuItem>
                      <DropdownMenuItem onClick={exportExcel}>Excel</DropdownMenuItem>
                      <DropdownMenuItem onClick={exportPDF}>PDF</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : undefined
              }
              actions={
                <Button onClick={handleCreate} disabled={loading || saving} size='sm'>
                  <Plus className='h-4 w-4 mr-2' />
                  Nuevo Atributo
                </Button>
              }
              rowActions={(attr: Attribute) => {
                const index = attributes.findIndex(a => a.id === attr.id)
                return (
                  <div className='flex items-center justify-end gap-0.5'>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant='ghost'
                            size='sm'
                            className='h-7 w-7 p-0'
                            onClick={() => handleReorder(attr, 'up')}
                            disabled={index === 0 || saving}
                          >
                            <MoveUp className='h-3.5 w-3.5' />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Subir en el orden</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant='ghost'
                            size='sm'
                            className='h-7 w-7 p-0'
                            onClick={() => handleReorder(attr, 'down')}
                            disabled={index === attributes.length - 1 || saving}
                          >
                            <MoveDown className='h-3.5 w-3.5' />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Bajar en el orden</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant='ghost'
                            size='sm'
                            className='h-7 w-7 p-0'
                            onClick={() => handleEdit(attr)}
                            disabled={saving}
                          >
                            <Edit className='h-3.5 w-3.5' />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Editar atributo</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant='ghost'
                            size='sm'
                            className='h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10'
                            onClick={() => handleDeleteClick(attr)}
                            disabled={saving}
                          >
                            <Trash2 className='h-3.5 w-3.5' />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Eliminar atributo</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )
              }}
              emptyState={{
                title: 'No hay atributos configurados',
                description: 'Crea atributos personalizados para capturar información específica',
                action: (
                  <Button variant='outline' onClick={handleCreate}>
                    <Plus className='h-4 w-4 mr-2' />
                    Crear Primer Atributo
                  </Button>
                ),
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Form Dialog */}
      <AttributeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        attribute={editingAttribute}
        onSave={handleSave}
        saving={saving}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar atributo?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de eliminar el atributo{' '}
              <strong>{attributeToDelete?.attributeLabel}</strong>. Esta acción no se puede
              deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={saving}
              className='bg-destructive hover:bg-destructive/90'
            >
              {saving ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
