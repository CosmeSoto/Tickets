/**
 * Component: WarehousesTab
 * Tab para gestión de bodegas por familia
 */

import { useState } from 'react'
import { useWarehouseManagement, Warehouse } from '@/hooks/inventory/use-warehouse-management'
import { WarehouseFormDialog } from './warehouse-form-dialog'
import { CloneCatalogItemDialog } from './clone-catalog-item-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column } from '@/components/ui/data-table'
import { useExport } from '@/hooks/common/use-export'
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
import {
  Plus,
  Warehouse as WarehouseIcon,
  AlertTriangle,
  Pencil,
  Trash2,
  MapPin,
  User,
  Package,
  Box,
  CheckCircle,
  XCircle,
  Download,
  Copy,
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
    loadWarehouses,
  } = useWarehouseManagement(familyId)

  const [formOpen, setFormOpen] = useState(false)
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [warehouseToDelete, setWarehouseToDelete] = useState<Warehouse | null>(null)
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false)
  const [warehouseToClone, setWarehouseToClone] = useState<Warehouse | null>(null)

  // Estado para paginación
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)

  // Export configuration
  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    getData: () => warehouses,
    columns: [
      { header: 'Nombre', accessor: (w: Warehouse) => w.name },
      { header: 'Ubicación', accessor: (w: Warehouse) => w.location || '' },
      { header: 'Responsable', accessor: (w: Warehouse) => w.manager?.name || 'Sin responsable' },
      { header: 'Equipos', accessor: (w: Warehouse) => String(w._count?.equipment || 0) },
      { header: 'Suministros', accessor: (w: Warehouse) => String(w._count?.consumables || 0) },
      {
        header: 'Total Items',
        accessor: (w: Warehouse) =>
          String((w._count?.equipment || 0) + (w._count?.consumables || 0)),
      },
      { header: 'Estado', accessor: (w: Warehouse) => (w.isActive ? 'Activa' : 'Inactiva') },
    ],
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

  // Configuración de columnas para DataTable
  const columns: Column<Warehouse>[] = [
    {
      key: 'name',
      label: 'Nombre',
      sortable: true,
      render: (warehouse: Warehouse) => (
        <div className='flex items-start gap-2'>
          <WarehouseIcon className='h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0' />
          <div className='min-w-0 flex-1'>
            <p className='font-medium text-sm break-words'>{warehouse.name}</p>
            {warehouse.description && (
              <p className='text-xs text-muted-foreground mt-0.5 break-words'>
                {warehouse.description}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'location',
      label: 'Ubicación',
      sortable: true,
      render: (warehouse: Warehouse) =>
        warehouse.location ? (
          <div className='flex items-start gap-1.5 text-sm'>
            <MapPin className='h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5' />
            <span className='break-words'>{warehouse.location}</span>
          </div>
        ) : (
          <span className='text-xs text-muted-foreground'>—</span>
        ),
    },
    {
      key: 'manager',
      label: 'Responsable',
      sortable: true,
      render: (warehouse: Warehouse) =>
        warehouse.manager ? (
          <div className='flex items-start gap-1.5 text-sm'>
            <User className='h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5' />
            <span className='break-words'>{warehouse.manager.name}</span>
          </div>
        ) : (
          <span className='text-xs text-muted-foreground'>—</span>
        ),
    },
    {
      key: 'items',
      label: 'Items',
      sortable: false,
      width: '140px',
      render: (warehouse: Warehouse) => {
        const equipmentCount = warehouse._count?.equipment || 0
        const consumablesCount = warehouse._count?.consumables || 0
        return (
          <div className='flex items-center justify-center gap-3'>
            <div
              className='flex items-center gap-1 cursor-help'
              title={`${equipmentCount} Equipo${equipmentCount !== 1 ? 's' : ''}`}
            >
              <Package className='h-3.5 w-3.5 text-blue-500' />
              <span className='text-sm font-medium'>{equipmentCount}</span>
            </div>
            <div
              className='flex items-center gap-1 cursor-help'
              title={`${consumablesCount} Suministro${consumablesCount !== 1 ? 's' : ''}`}
            >
              <Box className='h-3.5 w-3.5 text-amber-500' />
              <span className='text-sm font-medium'>{consumablesCount}</span>
            </div>
          </div>
        )
      },
    },
    {
      key: 'isActive',
      label: 'Estado',
      sortable: true,
      width: '100px',
      render: (warehouse: Warehouse) =>
        warehouse.isActive ? (
          <div className='flex items-center justify-center gap-1.5 text-green-600 dark:text-green-500'>
            <CheckCircle className='h-4 w-4' />
          </div>
        ) : (
          <div className='flex items-center justify-center gap-1.5 text-muted-foreground'>
            <XCircle className='h-4 w-4' />
          </div>
        ),
    },
  ]

  return (
    <>
      <DataTable
        title='Bodegas'
        description='Gestiona las bodegas de almacenamiento para esta área'
        data={warehouses}
        columns={columns}
        loading={loading}
        searchable={true}
        searchPlaceholder='Buscar por nombre...'
        externalSearch={false}
        pagination={{
          page,
          limit,
          total: warehouses.length,
          onPageChange: setPage,
          onLimitChange: newLimit => {
            setLimit(newLimit)
            setPage(1)
          },
        }}
        onExport={
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
        }
        actions={
          <Button onClick={handleCreate} disabled={loading || saving} size='sm'>
            <Plus className='h-4 w-4 mr-2' />
            Nueva Bodega
          </Button>
        }
        rowActions={(warehouse: Warehouse) => (
          <div className='flex items-center justify-end gap-1'>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => handleEdit(warehouse)}
              disabled={saving}
              title='Editar bodega'
            >
              <Pencil className='h-4 w-4' />
            </Button>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => updateWarehouse(warehouse.id, { isActive: !warehouse.isActive })}
              disabled={saving}
              title={warehouse.isActive ? 'Desactivar bodega' : 'Activar bodega'}
            >
              {warehouse.isActive ? (
                <CheckCircle className='h-4 w-4 text-green-600 dark:text-green-500' />
              ) : (
                <XCircle className='h-4 w-4 text-muted-foreground' />
              )}
            </Button>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => handleDelete(warehouse)}
              disabled={saving}
              title='Eliminar bodega'
            >
              <Trash2 className='h-4 w-4 text-destructive' />
            </Button>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => {
                setWarehouseToClone(warehouse)
                setCloneDialogOpen(true)
              }}
              disabled={saving}
              title='Copiar a otra área'
            >
              <Copy className='h-4 w-4 text-blue-500' />
            </Button>
          </div>
        )}
        emptyState={{
          icon: <WarehouseIcon className='h-12 w-12 text-muted-foreground/30 mb-4' />,
          title: 'No hay bodegas',
          description: 'Crea la primera bodega para esta área',
          action: (
            <Button onClick={handleCreate} size='sm'>
              <Plus className='h-4 w-4 mr-2' />
              Crear Bodega
            </Button>
          ),
        }}
      />

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

      {warehouseToClone && (
        <CloneCatalogItemDialog
          open={cloneDialogOpen}
          onOpenChange={open => {
            setCloneDialogOpen(open)
            if (!open) setWarehouseToClone(null)
          }}
          kind='warehouse'
          itemId={warehouseToClone.id}
          itemName={warehouseToClone.name}
          currentFamilyId={familyId ?? null}
          onSuccess={() => {
            void loadWarehouses()
          }}
        />
      )}
    </>
  )
}
