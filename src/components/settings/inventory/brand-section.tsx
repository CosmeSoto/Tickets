'use client'

import { useState } from 'react'
import { Plus, Edit2, Trash2, Eye, EyeOff, Download, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTable, type Column } from '@/components/ui/data-table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useExport } from '@/hooks/common/use-export'
import { EquipmentBrandInlineForm } from '@/components/inventory/asset-forms/EquipmentBrandInlineForm'
import type { EquipmentBrand } from '@/hooks/inventory/use-brand-management'

interface BrandSectionProps {
  brands: EquipmentBrand[]
  loading: boolean
  saving: boolean
  familyId?: string | null
  familyColor?: string | null
  onCreateBrand: () => void
  onEditBrand: (brand: EquipmentBrand) => void
  onDeleteBrand: (brandId: string) => Promise<void>
  onToggleActive: (brandId: string) => Promise<void>
}

export function BrandSection({
  brands,
  loading,
  saving,
  familyId,
  familyColor,
  onCreateBrand,
  onEditBrand,
  onDeleteBrand,
  onToggleActive,
}: BrandSectionProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [brandToDelete, setBrandToDelete] = useState<EquipmentBrand | null>(null)
  const [brandFormOpen, setBrandFormOpen] = useState(false)
  const [brandFormMode, setBrandFormMode] = useState<'create' | 'edit'>('create')
  const [selectedBrand, setSelectedBrand] = useState<EquipmentBrand | null>(null)

  // Estado para paginación
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)

  // Export configuration
  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    getData: () => brands,
    columns: [
      { header: 'Nombre', accessor: (b: EquipmentBrand) => b.name },
      { header: 'Código', accessor: (b: EquipmentBrand) => b.code || '' },
      { header: 'Estado', accessor: (b: EquipmentBrand) => (b.isActive ? 'Activo' : 'Inactivo') },
    ],
    filename: 'marcas-equipos',
    title: 'Marcas de Equipos',
    subtitle: `${brands.length} marca${brands.length !== 1 ? 's' : ''}`,
  })

  const handleCreateBrand = () => {
    setBrandFormMode('create')
    setSelectedBrand(null)
    setBrandFormOpen(true)
  }

  const handleEditBrand = (brand: EquipmentBrand) => {
    setBrandFormMode('edit')
    setSelectedBrand(brand)
    setBrandFormOpen(true)
  }

  const handleBrandFormSuccess = (item: any) => {
    setBrandFormOpen(false)
    if (brandFormMode === 'create') {
      onCreateBrand()
    }
  }

  const handleDeleteClick = (brand: EquipmentBrand) => {
    setBrandToDelete(brand)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!brandToDelete) return
    try {
      await onDeleteBrand(brandToDelete.id)
      setDeleteDialogOpen(false)
      setBrandToDelete(null)
    } catch (e) {
      console.error(e)
    }
  }

  // Configuración de columnas para DataTable
  const columns: Column<EquipmentBrand>[] = [
    {
      key: 'name',
      label: 'Nombre',
      sortable: true,
      render: (brand: EquipmentBrand) => (
        <div>
          <div className='font-medium'>{brand.name}</div>
          {brand.code && (
            <div className='text-xs text-muted-foreground line-clamp-1'>Código: {brand.code}</div>
          )}
        </div>
      ),
    },
    {
      key: 'isActive',
      label: 'Estado',
      sortable: true,
      width: '140px',
      render: (brand: EquipmentBrand) =>
        brand.isActive ? (
          <div className='flex items-center justify-center gap-1.5 text-green-600 dark:text-green-500'>
            <CheckCircle className='h-4 w-4' />
            <span className='text-sm font-medium'>Activo</span>
          </div>
        ) : (
          <div className='flex items-center justify-center gap-1.5 text-muted-foreground'>
            <XCircle className='h-4 w-4' />
            <span className='text-sm font-medium'>Inactivo</span>
          </div>
        ),
    },
  ]

  return (
    <>
      <DataTable
        data={brands}
        columns={columns}
        loading={loading}
        searchable={true}
        searchPlaceholder='Buscar por nombre...'
        externalSearch={false}
        pagination={{
          page,
          limit,
          total: brands.length,
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
          <Button onClick={handleCreateBrand} disabled={saving} size='sm'>
            <Plus className='h-4 w-4 mr-2' />
            Nueva Marca
          </Button>
        }
        rowActions={(brand: EquipmentBrand) => (
          <div className='flex items-center justify-end gap-1'>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => handleEditBrand(brand)}
              disabled={saving}
              title='Editar'
            >
              <Edit2 className='h-4 w-4' />
            </Button>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => onToggleActive(brand.id)}
              disabled={saving}
              title={brand.isActive ? 'Desactivar' : 'Activar'}
            >
              {brand.isActive ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
            </Button>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => handleDeleteClick(brand)}
              disabled={saving}
              title='Eliminar'
            >
              <Trash2 className='h-4 w-4 text-destructive' />
            </Button>
          </div>
        )}
        emptyState={{
          title: 'No hay marcas configuradas',
          description: 'Crea la primera marca para comenzar',
          action: (
            <Button onClick={handleCreateBrand} disabled={saving}>
              <Plus className='h-4 w-4 mr-2' />
              Crear Primera Marca
            </Button>
          ),
        }}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar marca?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de eliminar la marca <strong>{brandToDelete?.name}</strong>. Esta acción
              no se puede deshacer.
              {brandToDelete?.isActive && (
                <span className='block mt-2 text-destructive font-medium'>
                  Esta marca está activa y puede estar en uso.
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

      {/* Brand Form Dialog */}
      <Dialog open={brandFormOpen} onOpenChange={setBrandFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{brandFormMode === 'create' ? 'Nueva Marca' : 'Editar Marca'}</DialogTitle>
          </DialogHeader>
          <EquipmentBrandInlineForm
            familyId={familyId || undefined}
            item={selectedBrand ? { id: selectedBrand.id, name: selectedBrand.name } : undefined}
            onSuccess={handleBrandFormSuccess}
            onCancel={() => setBrandFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
