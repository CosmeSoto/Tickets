/**
 * Type Section Component (Generic)
 * Reutilizable para Equipment, License, Consumable types
 */

'use client'

import { useState } from 'react'
import { Plus, Settings, Trash2, Eye, EyeOff, Edit2, Download, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { useTableSort } from '@/hooks/common/use-table-sort'
import { useExport } from '@/hooks/common/use-export'
import type { ExportColumn } from '@/lib/utils/export'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import type { AnyType, TypeKind } from '@/hooks/inventory/use-type-management'

// ── Types ──────────────────────────────────────────────────────────────────

interface TypeSectionProps<T extends AnyType> {
  typeKind: TypeKind
  types: T[]
  loading: boolean
  saving: boolean
  familyColor?: string | null
  onCreateType: () => void
  onEditType: (type: T) => void
  onDeleteType: (typeId: string) => Promise<boolean>
  onToggleActive: (typeId: string) => Promise<boolean>
  onManageAttributes: (type: T) => void
}

const TYPE_LABELS: Record<TypeKind, { singular: string; plural: string }> = {
  equipment: { singular: 'Tipo de Equipo', plural: 'Tipos de Equipo' },
  license: { singular: 'Tipo de Licencia', plural: 'Tipos de Licencia' },
  consumable: { singular: 'Tipo de Consumible', plural: 'Tipos de Consumible' },
}

// ── Component ──────────────────────────────────────────────────────────────

export function TypeSection<T extends AnyType>({
  typeKind,
  types,
  loading,
  saving,
  familyColor,
  onCreateType,
  onEditType,
  onDeleteType,
  onToggleActive,
  onManageAttributes,
}: TypeSectionProps<T>) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [typeToDelete, setTypeToDelete] = useState<T | null>(null)

  const labels = TYPE_LABELS[typeKind]

  // Sorting
  const { sortedData, requestSort, getSortIcon } = useTableSort(types, {
    key: 'name',
    direction: 'asc',
  })

  // Export configuration
  const exportColumns: ExportColumn<T>[] = [
    { header: 'Nombre', accessor: 'name' },
    { header: 'Descripción', accessor: t => t.description || '' },
    { header: 'Estado', accessor: t => (t.isActive ? 'Activo' : 'Inactivo') },
    { header: 'Familia', accessor: 'familyId' },
  ]

  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    getData: () => types,
    columns: exportColumns,
    filename: `tipos-${typeKind}`,
    title: labels.plural,
    subtitle: `${types.length} tipo${types.length !== 1 ? 's' : ''}`,
  })

  const handleDeleteClick = (type: T) => {
    setTypeToDelete(type)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!typeToDelete) return

    const success = await onDeleteType(typeToDelete.id)
    if (success) {
      setDeleteDialogOpen(false)
      setTypeToDelete(null)
    }
  }

  if (loading) {
    return (
      <div className='flex items-center justify-center py-8'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary' />
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h3 className='text-lg font-semibold'>{labels.plural}</h3>
          <p className='text-sm text-muted-foreground'>
            {types.length} {types.length === 1 ? 'tipo' : 'tipos'} configurado
            {types.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className='flex gap-2'>
          {types.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='outline' size='sm' disabled={exporting || loading}>
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
          <Button onClick={onCreateType} disabled={saving} size='sm'>
            <Plus className='h-4 w-4 mr-2' />
            Nuevo Tipo
          </Button>
        </div>
      </div>

      {/* Table */}
      {types.length === 0 ? (
        <div className='border rounded-lg p-8 text-center text-muted-foreground'>
          <p className='text-sm'>No hay tipos configurados</p>
          <p className='text-xs mt-1'>Crea el primer tipo para comenzar</p>
        </div>
      ) : (
        <div className='border rounded-lg overflow-hidden'>
          <div className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    sortKey='name'
                    currentSort={getSortIcon('name')}
                    onSort={requestSort}
                  >
                    Nombre
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey='description'
                    currentSort={getSortIcon('description')}
                    onSort={requestSort}
                  >
                    Descripción
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey='isActive'
                    currentSort={getSortIcon('isActive')}
                    onSort={requestSort}
                    align='center'
                  >
                    Estado
                  </SortableTableHead>
                  <TableHead className='text-right'>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map(type => (
                  <TableRow key={type.id}>
                    <TableCell className='font-medium'>{type.name}</TableCell>
                    <TableCell className='text-sm text-muted-foreground max-w-md truncate'>
                      {type.description || '—'}
                    </TableCell>
                    <TableCell className='text-center'>
                      {type.isActive ? (
                        <div className='flex items-center justify-center gap-1.5 text-green-600 dark:text-green-500'>
                          <CheckCircle className='h-4 w-4' />
                          <span className='text-sm font-medium'>Activo</span>
                        </div>
                      ) : (
                        <div className='flex items-center justify-center gap-1.5 text-muted-foreground'>
                          <XCircle className='h-4 w-4' />
                          <span className='text-sm font-medium'>Inactivo</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className='text-right'>
                      <div className='flex items-center justify-end gap-1'>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => onEditType(type)}
                          disabled={saving}
                          title='Editar'
                        >
                          <Edit2 className='h-4 w-4' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => onManageAttributes(type)}
                          disabled={saving}
                          title='Gestionar atributos'
                        >
                          <Settings className='h-4 w-4' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => onToggleActive(type.id)}
                          disabled={saving}
                          title={type.isActive ? 'Desactivar' : 'Activar'}
                        >
                          {type.isActive ? (
                            <EyeOff className='h-4 w-4' />
                          ) : (
                            <Eye className='h-4 w-4' />
                          )}
                        </Button>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => handleDeleteClick(type)}
                          disabled={saving}
                          title='Eliminar'
                        >
                          <Trash2 className='h-4 w-4 text-destructive' />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tipo?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de eliminar el tipo <strong>{typeToDelete?.name}</strong>. Esta acción
              no se puede deshacer.
              {typeToDelete?.isActive && (
                <span className='block mt-2 text-destructive font-medium'>
                  Este tipo está activo y puede estar en uso.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className='bg-destructive'>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
