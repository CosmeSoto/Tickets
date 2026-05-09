/**
 * Component: WarehousesTab
 * Tab para gestión de bodegas por familia
 */

import { useState } from 'react'
import { useWarehouseManagement, Warehouse } from '@/hooks/inventory/use-warehouse-management'
import { WarehouseFormDialog } from './warehouse-form-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useTableSort } from '@/hooks/common/use-table-sort'
import { useExport } from '@/hooks/common/use-export'
import type { ExportColumn } from '@/lib/utils/export'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import {
  Plus,
  RefreshCw,
  Warehouse as WarehouseIcon,
  AlertTriangle,
  MoreVertical,
  Pencil,
  Trash2,
  MapPin,
  User,
  Package,
  Box,
  CheckCircle,
  XCircle,
  Download,
} from 'lucide-react'

interface WarehousesTabProps {
  familyId: string
}

export function WarehousesTab({ familyId }: WarehousesTabProps) {
  const {
    warehouses,
    availableManagers,
    loading,
    saving,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse,
  } = useWarehouseManagement(familyId)

  const [formOpen, setFormOpen] = useState(false)
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [warehouseToDelete, setWarehouseToDelete] = useState<Warehouse | null>(null)

  // Sorting
  const { sortedData, requestSort, getSortIcon } = useTableSort(warehouses, {
    key: 'name',
    direction: 'asc',
  })

  // Export configuration
  const exportColumns: ExportColumn<Warehouse>[] = [
    { header: 'Nombre', accessor: 'name' },
    { header: 'Ubicación', accessor: w => w.location || '' },
    { header: 'Responsable', accessor: w => w.manager?.name || 'Sin responsable' },
    { header: 'Equipos', accessor: w => w._count?.equipment || 0 },
    { header: 'Consumibles', accessor: w => w._count?.consumables || 0 },
    { header: 'Estado', accessor: w => (w.isActive ? 'Activa' : 'Inactiva') },
    { header: 'Descripción', accessor: w => w.description || '' },
  ]

  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    getData: () => warehouses,
    columns: exportColumns,
    filename: 'bodegas',
    title: 'Bodegas',
    subtitle: `${warehouses.length} bodega${warehouses.length !== 1 ? 's' : ''}`,
  })

  const handleCreate = () => {
    setSelectedWarehouse(null)
    setFormOpen(true)
  }

  const handleEdit = (warehouse: Warehouse) => {
    setSelectedWarehouse(warehouse)
    setFormOpen(true)
  }

  const handleDelete = (warehouse: Warehouse) => {
    setWarehouseToDelete(warehouse)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!warehouseToDelete) return

    const success = await deleteWarehouse(warehouseToDelete.id)
    if (success) {
      setDeleteDialogOpen(false)
      setWarehouseToDelete(null)
    }
  }

  const handleSave = async (data: any) => {
    let success = false

    if (selectedWarehouse) {
      // Editar
      success = await updateWarehouse(selectedWarehouse.id, data)
    } else {
      // Crear
      const result = await createWarehouse(data)
      success = !!result
    }

    if (success) {
      setFormOpen(false)
      setSelectedWarehouse(null)
    }
  }

  const totalItems = warehouseToDelete
    ? (warehouseToDelete._count?.equipment || 0) + (warehouseToDelete._count?.consumables || 0)
    : 0

  return (
    <>
      <Card>
        <CardHeader>
          <div className='flex items-start justify-between gap-4'>
            <div>
              <CardTitle className='flex items-center gap-2'>
                <WarehouseIcon className='h-5 w-5' />
                Bodegas
              </CardTitle>
              <CardDescription>
                Gestiona las bodegas de almacenamiento para esta área
              </CardDescription>
            </div>
            <div className='flex gap-2'>
              {warehouses.length > 0 && (
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
              <Button onClick={handleCreate} disabled={loading || saving} size='sm'>
                <Plus className='h-4 w-4 mr-1.5' />
                Nueva Bodega
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className='flex items-center justify-center py-12'>
              <RefreshCw className='h-6 w-6 animate-spin text-muted-foreground' />
            </div>
          ) : warehouses.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-12 text-center'>
              <WarehouseIcon className='h-12 w-12 text-muted-foreground/30 mb-4' />
              <p className='text-base font-medium text-muted-foreground'>No hay bodegas</p>
              <p className='text-sm text-muted-foreground mt-1 mb-4'>
                Crea la primera bodega para esta área
              </p>
              <Button onClick={handleCreate} size='sm'>
                <Plus className='h-4 w-4 mr-1.5' />
                Crear Bodega
              </Button>
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
                        sortKey='location'
                        currentSort={getSortIcon('location')}
                        onSort={requestSort}
                      >
                        Ubicación
                      </SortableTableHead>
                      <SortableTableHead
                        sortKey='manager.name'
                        currentSort={getSortIcon('manager.name')}
                        onSort={requestSort}
                      >
                        Responsable
                      </SortableTableHead>
                      <SortableTableHead
                        sortKey='_count.equipment'
                        currentSort={getSortIcon('_count.equipment')}
                        onSort={requestSort}
                        align='center'
                      >
                        Equipos
                      </SortableTableHead>
                      <SortableTableHead
                        sortKey='_count.consumables'
                        currentSort={getSortIcon('_count.consumables')}
                        onSort={requestSort}
                        align='center'
                      >
                        Consumibles
                      </SortableTableHead>
                      <SortableTableHead
                        sortKey='isActive'
                        currentSort={getSortIcon('isActive')}
                        onSort={requestSort}
                        align='center'
                      >
                        Estado
                      </SortableTableHead>
                      <TableHead className='w-[70px]'></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedData.map(warehouse => {
                      const equipmentCount = warehouse._count?.equipment || 0
                      const consumablesCount = warehouse._count?.consumables || 0

                      return (
                        <TableRow key={warehouse.id}>
                          <TableCell>
                            <div className='flex items-start gap-2'>
                              <WarehouseIcon className='h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0' />
                              <div className='min-w-0'>
                                <p className='font-medium text-sm'>{warehouse.name}</p>
                                {warehouse.description && (
                                  <p className='text-xs text-muted-foreground line-clamp-1'>
                                    {warehouse.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            {warehouse.location ? (
                              <div className='flex items-center gap-1.5 text-sm'>
                                <MapPin className='h-3.5 w-3.5 text-muted-foreground flex-shrink-0' />
                                <span className='line-clamp-1'>{warehouse.location}</span>
                              </div>
                            ) : (
                              <span className='text-xs text-muted-foreground'>Sin ubicación</span>
                            )}
                          </TableCell>

                          <TableCell>
                            {warehouse.manager ? (
                              <div className='flex items-center gap-1.5 text-sm'>
                                <User className='h-3.5 w-3.5 text-muted-foreground flex-shrink-0' />
                                <span className='line-clamp-1'>{warehouse.manager.name}</span>
                              </div>
                            ) : (
                              <span className='text-xs text-muted-foreground'>Sin responsable</span>
                            )}
                          </TableCell>

                          <TableCell className='text-center'>
                            <div className='flex items-center justify-center gap-1.5'>
                              <Package className='h-3.5 w-3.5 text-muted-foreground' />
                              <span className='text-sm font-medium'>{equipmentCount}</span>
                            </div>
                          </TableCell>

                          <TableCell className='text-center'>
                            <div className='flex items-center justify-center gap-1.5'>
                              <Box className='h-3.5 w-3.5 text-muted-foreground' />
                              <span className='text-sm font-medium'>{consumablesCount}</span>
                            </div>
                          </TableCell>

                          <TableCell className='text-center'>
                            {warehouse.isActive ? (
                              <div className='flex items-center justify-center gap-1.5 text-green-600 dark:text-green-500'>
                                <CheckCircle className='h-4 w-4' />
                                <span className='text-sm font-medium'>Activa</span>
                              </div>
                            ) : (
                              <div className='flex items-center justify-center gap-1.5 text-muted-foreground'>
                                <XCircle className='h-4 w-4' />
                                <span className='text-sm font-medium'>Inactiva</span>
                              </div>
                            )}
                          </TableCell>

                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant='ghost'
                                  size='sm'
                                  className='h-8 w-8 p-0'
                                  disabled={saving}
                                >
                                  <MoreVertical className='h-4 w-4' />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align='end'>
                                <DropdownMenuItem onClick={() => handleEdit(warehouse)}>
                                  <Pencil className='h-4 w-4 mr-2' />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleDelete(warehouse)}
                                  className='text-destructive'
                                >
                                  <Trash2 className='h-4 w-4 mr-2' />
                                  Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo de formulario */}
      <WarehouseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        warehouse={selectedWarehouse}
        availableManagers={availableManagers}
        onSave={handleSave}
        saving={saving}
      />

      {/* Diálogo de confirmación de eliminación */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className='flex items-center gap-2'>
              <AlertTriangle className='h-5 w-5 text-destructive' />
              {totalItems > 0 ? 'Desactivar Bodega' : 'Eliminar Bodega'}
            </AlertDialogTitle>
            <AlertDialogDescription className='space-y-2'>
              {totalItems > 0 ? (
                <>
                  <p>
                    Esta bodega tiene <strong>{totalItems} items asignados</strong> y no puede ser
                    eliminada.
                  </p>
                  <p>Se desactivará para que no aparezca en los formularios.</p>
                  <p className='text-sm text-muted-foreground'>
                    Los items existentes permanecerán en la bodega.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    ¿Estás seguro de que deseas eliminar la bodega{' '}
                    <strong>{warehouseToDelete?.name}</strong>?
                  </p>
                  <p className='text-sm text-muted-foreground'>Esta acción no se puede deshacer.</p>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={saving}>
              {saving
                ? 'Procesando...'
                : totalItems > 0
                  ? 'Desactivar'
                  : 'Eliminar Definitivamente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
