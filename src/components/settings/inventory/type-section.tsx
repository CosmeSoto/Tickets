/**
 * Type Section Component (Generic)
 * Reutilizable para Equipment, License, Consumable types
 */

'use client'

import { useState } from 'react'
import { Plus, Settings, Trash2, Eye, EyeOff, Edit2, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column } from '@/components/ui/data-table'
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

  // Configuración de columnas para DataTable
  const columns: Column<T>[] = [
    {
      key: 'name',
      label: 'Nombre',
      sortable: true,
      render: (type: T) => (
        <div>
          <div className='font-medium'>{type.name}</div>
          {type.description && (
            <div className='text-xs text-muted-foreground line-clamp-1'>{type.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'attributes',
      label: 'Atributos',
      sortable: true,
      width: '120px',
      render: (type: T) => (
        <div className='text-center'>
          <Badge variant='secondary' className='font-mono'>
            {(type as any)._count?.attributes || 0}
          </Badge>
        </div>
      ),
    },
    {
      key: 'isActive',
      label: 'Estado',
      sortable: true,
      width: '140px',
      render: (type: T) =>
        type.isActive ? (
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
        data={types}
        columns={columns}
        loading={loading}
        searchable={true}
        searchPlaceholder='Buscar por nombre...'
        filters={[
          {
            key: 'status',
            label: 'Estado',
            type: 'select',
            options: [
              { value: 'active', label: 'Activos' },
              { value: 'inactive', label: 'Inactivos' },
            ],
          },
        ]}
        actions={
          <Button onClick={onCreateType} disabled={saving} size='sm'>
            <Plus className='h-4 w-4 mr-2' />
            Nuevo Tipo
          </Button>
        }
        rowActions={(type: T) => (
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
              {type.isActive ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
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
        )}
        emptyState={{
          title: 'No hay tipos configurados',
          description: 'Crea el primer tipo para comenzar',
          action: (
            <Button onClick={onCreateType} disabled={saving}>
              <Plus className='h-4 w-4 mr-2' />
              Crear Primer Tipo
            </Button>
          ),
        }}
      />

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
    </>
  )
}
