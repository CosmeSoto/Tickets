/**
 * Component: WarehouseCard
 * Tarjeta para mostrar información de una bodega
 */

import { Warehouse } from '@/hooks/inventory/use-warehouse-management'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { MapPin, User, Package, Box, Edit, Trash2 } from 'lucide-react'

interface WarehouseCardProps {
  warehouse: Warehouse
  onEdit: (warehouse: Warehouse) => void
  onDelete: (warehouse: Warehouse) => void
  disabled?: boolean
}

export function WarehouseCard({ warehouse, onEdit, onDelete, disabled }: WarehouseCardProps) {
  const totalItems = (warehouse._count?.equipment || 0) + (warehouse._count?.consumables || 0)

  return (
    <Card className={!warehouse.isActive ? 'opacity-60' : ''}>
      <CardHeader className='pb-3'>
        <div className='flex items-start justify-between gap-2'>
          <div className='flex-1 min-w-0'>
            <h3 className='font-semibold text-base truncate'>{warehouse.name}</h3>
            {warehouse.location && (
              <div className='flex items-center gap-1.5 text-xs text-muted-foreground mt-1'>
                <MapPin className='h-3.5 w-3.5 flex-shrink-0' />
                <span className='truncate'>{warehouse.location}</span>
              </div>
            )}
          </div>
          <Badge variant={warehouse.isActive ? 'default' : 'secondary'} className='flex-shrink-0'>
            {warehouse.isActive ? 'Activa' : 'Inactiva'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className='space-y-3'>
        {/* Descripción */}
        {warehouse.description && (
          <p className='text-sm text-muted-foreground line-clamp-2'>{warehouse.description}</p>
        )}

        {/* Manager */}
        {warehouse.manager && (
          <div className='flex items-center gap-2 text-sm'>
            <User className='h-4 w-4 text-muted-foreground flex-shrink-0' />
            <div className='min-w-0 flex-1'>
              <p className='font-medium truncate'>{warehouse.manager.name}</p>
              <p className='text-xs text-muted-foreground truncate'>{warehouse.manager.email}</p>
            </div>
          </div>
        )}

        {/* Estadísticas */}
        <div className='flex items-center gap-4 pt-2 border-t'>
          <div className='flex items-center gap-1.5 text-sm'>
            <Box className='h-4 w-4 text-muted-foreground' />
            <span className='font-medium'>{warehouse._count?.equipment || 0}</span>
            <span className='text-muted-foreground'>equipos</span>
          </div>
          <div className='flex items-center gap-1.5 text-sm'>
            <Package className='h-4 w-4 text-muted-foreground' />
            <span className='font-medium'>{warehouse._count?.consumables || 0}</span>
            <span className='text-muted-foreground'>suministros</span>
          </div>
        </div>

        {/* Acciones */}
        <div className='flex items-center gap-2 pt-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => onEdit(warehouse)}
            disabled={disabled}
            className='flex-1'
          >
            <Edit className='h-4 w-4 mr-1.5' />
            Editar
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => onDelete(warehouse)}
            disabled={disabled || totalItems > 0}
            className='flex-1'
          >
            <Trash2 className='h-4 w-4 mr-1.5' />
            {totalItems > 0 ? 'Desactivar' : 'Eliminar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
