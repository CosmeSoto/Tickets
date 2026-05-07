/**
 * BulkActionsToolbar Component
 * Toolbar que aparece cuando hay equipos seleccionados para acciones masivas
 * Integrado con modales de acciones masivas
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DollarSign, Wrench, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BulkForSaleModal } from './BulkForSaleModal'
import { BulkMaintenanceModal } from './BulkMaintenanceModal'
import { BulkDecommissionModal } from './BulkDecommissionModal'

interface Equipment {
  id: string
  code: string
  serialNumber: string
  brand: string
  model: string
}

interface BulkActionsToolbarProps {
  selectedCount: number
  selectedEquipment: Equipment[]
  onForSale?: () => void
  onMaintenance?: () => void
  onDecommission?: () => void
  onClearSelection: () => void
  onSuccess: () => void
  className?: string
}

export function BulkActionsToolbar({
  selectedCount,
  selectedEquipment,
  onForSale,
  onMaintenance,
  onDecommission,
  onClearSelection,
  onSuccess,
  className,
}: BulkActionsToolbarProps) {
  const [forSaleModalOpen, setForSaleModalOpen] = useState(false)
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false)
  const [decommissionModalOpen, setDecommissionModalOpen] = useState(false)

  if (selectedCount === 0) return null

  const handleSuccess = () => {
    onSuccess()
    onClearSelection()
  }

  const handleForSale = () => {
    if (onForSale) {
      onForSale()
    } else {
      setForSaleModalOpen(true)
    }
  }

  const handleMaintenance = () => {
    if (onMaintenance) {
      onMaintenance()
    } else {
      setMaintenanceModalOpen(true)
    }
  }

  const handleDecommission = () => {
    if (onDecommission) {
      onDecommission()
    } else {
      setDecommissionModalOpen(true)
    }
  }

  return (
    <>
      <div
        className={cn(
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
          'bg-background border rounded-lg shadow-lg',
          'flex items-center gap-2 p-3',
          'animate-in slide-in-from-bottom-5 duration-300',
          className
        )}
      >
        {/* Contador */}
        <div className='flex items-center gap-2 px-3 border-r'>
          <Badge variant='default' className='text-sm'>
            {selectedCount}
          </Badge>
          <span className='text-sm font-medium'>
            {selectedCount === 1 ? 'equipo seleccionado' : 'equipos seleccionados'}
          </span>
        </div>

        {/* Acciones */}
        <div className='flex items-center gap-2'>
          <Button variant='outline' size='sm' onClick={handleForSale} className='gap-2'>
            <DollarSign className='h-4 w-4' />
            Poner en venta
          </Button>

          <Button variant='outline' size='sm' onClick={handleMaintenance} className='gap-2'>
            <Wrench className='h-4 w-4' />
            Mantenimiento
          </Button>

          <Button
            variant='outline'
            size='sm'
            onClick={handleDecommission}
            className='gap-2 text-destructive hover:text-destructive'
          >
            <Trash2 className='h-4 w-4' />
            Dar de baja
          </Button>
        </div>

        {/* Limpiar selección */}
        <Button variant='ghost' size='sm' onClick={onClearSelection} className='ml-2'>
          <X className='h-4 w-4' />
        </Button>
      </div>

      {/* Modales */}
      <BulkForSaleModal
        open={forSaleModalOpen}
        onOpenChange={setForSaleModalOpen}
        equipment={selectedEquipment}
        onSuccess={handleSuccess}
      />

      <BulkMaintenanceModal
        open={maintenanceModalOpen}
        onOpenChange={setMaintenanceModalOpen}
        equipment={selectedEquipment}
        onSuccess={handleSuccess}
      />

      <BulkDecommissionModal
        open={decommissionModalOpen}
        onOpenChange={setDecommissionModalOpen}
        equipment={selectedEquipment}
        onSuccess={handleSuccess}
      />
    </>
  )
}

// Variante compacta para espacios reducidos
export function BulkActionsToolbarCompact({
  selectedCount,
  onForSale,
  onMaintenance,
  onDecommission,
  onClearSelection,
  className,
}: BulkActionsToolbarProps) {
  if (selectedCount === 0) return null

  return (
    <div className={cn('flex items-center gap-2 p-2 bg-muted rounded-lg', className)}>
      <Badge variant='default'>{selectedCount}</Badge>
      <span className='text-sm'>seleccionado{selectedCount !== 1 ? 's' : ''}</span>

      <div className='flex-1' />

      <Button variant='ghost' size='icon' onClick={onForSale} title='Poner en venta'>
        <DollarSign className='h-4 w-4' />
      </Button>

      <Button variant='ghost' size='icon' onClick={onMaintenance} title='Mantenimiento'>
        <Wrench className='h-4 w-4' />
      </Button>

      <Button
        variant='ghost'
        size='icon'
        onClick={onDecommission}
        title='Dar de baja'
        className='text-destructive hover:text-destructive'
      >
        <Trash2 className='h-4 w-4' />
      </Button>

      <Button variant='ghost' size='icon' onClick={onClearSelection} title='Limpiar'>
        <X className='h-4 w-4' />
      </Button>
    </div>
  )
}
