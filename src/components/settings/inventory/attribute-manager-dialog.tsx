/**
 * Attribute Manager Dialog Component
 * Gestiona atributos de un tipo específico con tabla profesional
 */

'use client'

import { useEffect, useState } from 'react'
import { Plus, Edit, Trash2, MoveUp, MoveDown, Download } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import type { ExportColumn } from '@/lib/utils/export'

// ── Types ──────────────────────────────────────────────────────────────────

interface AttributeManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  typeKind: TypeKind
  typeId: string
  typeName: string
  familyColor?: string | null
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
  familyColor,
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

  // Export configuration
  const exportColumns: ExportColumn<Attribute>[] = [
    { header: 'Orden', accessor: 'order' },
    { header: 'Nombre Técnico', accessor: 'attributeName' },
    { header: 'Etiqueta', accessor: 'attributeLabel' },
    {
      header: 'Tipo',
      accessor: attr => ATTRIBUTE_TYPE_LABELS[attr.attributeType] || attr.attributeType,
    },
    { header: 'Requerido', accessor: attr => (attr.isRequired ? 'Sí' : 'No') },
    { header: 'Visible', accessor: attr => (attr.isVisible ? 'Sí' : 'No') },
    { header: 'Texto de Ayuda', accessor: attr => attr.helpText || '' },
  ]

  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    getData: () => attributes,
    columns: exportColumns,
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
    }
  }

  const handleSave = async (data: CreateAttributeData): Promise<boolean> => {
    let success = false

    if (editingAttribute) {
      success = await updateAttribute(editingAttribute.id, data)
    } else {
      success = await createAttribute(data)
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
            {/* Header con contador y acciones */}
            <div className='flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4'>
              <div>
                <p className='text-sm text-muted-foreground'>
                  {attributes.length === 0
                    ? 'No hay atributos configurados'
                    : `${attributes.length} atributo${attributes.length !== 1 ? 's' : ''} configurado${attributes.length !== 1 ? 's' : ''}`}
                </p>
              </div>
              <div className='flex gap-2'>
                {attributes.length > 0 && (
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
                )}
                <Button onClick={handleCreate} disabled={loading || saving} size='sm'>
                  <Plus className='h-4 w-4 mr-2' />
                  Nuevo Atributo
                </Button>
              </div>
            </div>

            {/* Loading state */}
            {loading ? (
              <div className='flex items-center justify-center py-12'>
                <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary' />
              </div>
            ) : attributes.length === 0 ? (
              /* Empty state */
              <div className='text-center py-12 border-2 border-dashed rounded-lg'>
                <p className='text-muted-foreground mb-4'>
                  Crea atributos personalizados para capturar información específica
                </p>
                <Button variant='outline' onClick={handleCreate}>
                  <Plus className='h-4 w-4 mr-2' />
                  Crear Primer Atributo
                </Button>
              </div>
            ) : (
              <>
                {/* Vista Desktop: Tabla Compacta */}
                <div className='hidden md:block border rounded-lg overflow-hidden'>
                  <div className='overflow-x-auto'>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className='w-16 py-2'>#</TableHead>
                          <TableHead className='py-2'>Atributo</TableHead>
                          <TableHead className='w-24 py-2'>Tipo</TableHead>
                          <TableHead className='w-16 py-2 text-center'>Req.</TableHead>
                          <TableHead className='w-20 py-2 text-right'>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {attributes.map((attr, index) => (
                          <TableRow key={attr.id}>
                            <TableCell className='py-2'>
                              <div className='flex items-center gap-1'>
                                <span className='text-sm font-mono text-muted-foreground w-6'>
                                  {attr.order}
                                </span>
                                <div className='flex flex-col gap-0.5'>
                                  <Button
                                    variant='ghost'
                                    size='sm'
                                    className='h-5 w-5 p-0 hover:bg-muted'
                                    onClick={() => handleReorder(attr, 'up')}
                                    disabled={index === 0 || saving}
                                    title='Subir'
                                  >
                                    <MoveUp className='h-3 w-3' />
                                  </Button>
                                  <Button
                                    variant='ghost'
                                    size='sm'
                                    className='h-5 w-5 p-0 hover:bg-muted'
                                    onClick={() => handleReorder(attr, 'down')}
                                    disabled={index === attributes.length - 1 || saving}
                                    title='Bajar'
                                  >
                                    <MoveDown className='h-3 w-3' />
                                  </Button>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className='py-2'>
                              <div className='space-y-0.5'>
                                <div className='font-medium text-sm'>{attr.attributeLabel}</div>
                                <div className='text-xs text-muted-foreground font-mono'>
                                  {attr.attributeName}
                                </div>
                                {attr.helpText && (
                                  <div className='text-xs text-muted-foreground line-clamp-1'>
                                    {attr.helpText}
                                  </div>
                                )}
                                {/* Opciones inline */}
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
                            </TableCell>
                            <TableCell className='py-2'>
                              <Badge variant='secondary' className='text-xs px-2 py-0.5'>
                                {ATTRIBUTE_TYPE_LABELS[attr.attributeType]}
                              </Badge>
                            </TableCell>
                            <TableCell className='py-2 text-center'>
                              {attr.isRequired ? (
                                <Badge variant='destructive' className='text-xs px-1.5 py-0'>
                                  Sí
                                </Badge>
                              ) : (
                                <Badge variant='outline' className='text-xs px-1.5 py-0'>
                                  No
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className='py-2 text-right'>
                              <div className='flex justify-end gap-0.5'>
                                <Button
                                  variant='ghost'
                                  size='sm'
                                  className='h-7 w-7 p-0'
                                  onClick={() => handleEdit(attr)}
                                  disabled={saving}
                                  title='Editar'
                                >
                                  <Edit className='h-3.5 w-3.5' />
                                </Button>
                                <Button
                                  variant='ghost'
                                  size='sm'
                                  className='h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10'
                                  onClick={() => handleDeleteClick(attr)}
                                  disabled={saving}
                                  title='Eliminar'
                                >
                                  <Trash2 className='h-3.5 w-3.5' />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Vista Mobile: Cards */}
                <div className='md:hidden space-y-3'>
                  {attributes.map((attr, index) => (
                    <div key={attr.id} className='border rounded-lg p-4 space-y-3'>
                      <div className='flex items-start justify-between gap-2'>
                        <div className='flex-1 min-w-0'>
                          <div className='font-medium truncate'>{attr.attributeLabel}</div>
                          <div className='text-xs text-muted-foreground font-mono truncate'>
                            {attr.attributeName}
                          </div>
                        </div>
                        <div className='flex items-center gap-1 flex-shrink-0'>
                          <Button
                            variant='ghost'
                            size='sm'
                            className='h-8 w-8 p-0'
                            onClick={() => handleReorder(attr, 'up')}
                            disabled={index === 0 || saving}
                          >
                            <MoveUp className='h-4 w-4' />
                          </Button>
                          <Button
                            variant='ghost'
                            size='sm'
                            className='h-8 w-8 p-0'
                            onClick={() => handleReorder(attr, 'down')}
                            disabled={index === attributes.length - 1 || saving}
                          >
                            <MoveDown className='h-4 w-4' />
                          </Button>
                        </div>
                      </div>

                      {attr.helpText && (
                        <div className='text-xs text-muted-foreground'>{attr.helpText}</div>
                      )}

                      <div className='flex flex-wrap items-center gap-2'>
                        <Badge variant='secondary' className='text-xs px-2 py-0.5'>
                          {ATTRIBUTE_TYPE_LABELS[attr.attributeType]}
                        </Badge>
                        {attr.isRequired ? (
                          <Badge variant='destructive' className='text-xs px-2 py-0.5'>
                            Requerido
                          </Badge>
                        ) : (
                          <Badge variant='outline' className='text-xs px-2 py-0.5'>
                            Opcional
                          </Badge>
                        )}
                        {!attr.isVisible && (
                          <Badge variant='secondary' className='text-xs px-2 py-0.5'>
                            Oculto
                          </Badge>
                        )}
                        <Badge variant='outline' className='text-xs px-2 py-0.5 font-mono'>
                          #{attr.order}
                        </Badge>
                      </div>

                      {attr.attributeType === 'select' &&
                        attr.options?.options &&
                        Array.isArray(attr.options.options) && (
                          <div className='text-xs text-muted-foreground'>
                            {attr.options.options.length} opciones:{' '}
                            {attr.options.options.slice(0, 3).join(', ')}
                            {attr.options.options.length > 3 && '...'}
                          </div>
                        )}

                      <div className='flex gap-2 pt-2 border-t'>
                        <Button
                          variant='outline'
                          size='sm'
                          className='flex-1'
                          onClick={() => handleEdit(attr)}
                          disabled={saving}
                        >
                          <Edit className='h-4 w-4 mr-2' />
                          Editar
                        </Button>
                        <Button
                          variant='outline'
                          size='sm'
                          className='flex-1 text-destructive hover:text-destructive'
                          onClick={() => handleDeleteClick(attr)}
                          disabled={saving}
                        >
                          <Trash2 className='h-4 w-4 mr-2' />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
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
