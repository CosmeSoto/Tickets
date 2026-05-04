/**
 * Equipment Action Buttons Component
 * Displays action buttons based on permissions
 */

import { Edit, UserPlus, Wrench, Trash2, AlertCircle, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EquipmentActionButtonsProps {
  canReportProblem: boolean
  canRequestMaintenance: boolean
  canEdit: boolean
  canAssign: boolean
  canReturn: boolean
  canMaintenance: boolean
  canRetire: boolean
  canPermanentDelete: boolean
  canConvertToPurchase: boolean
  isInMaintenance: boolean
  onReportProblem: () => void
  onRequestMaintenance: () => void
  onEdit: () => void
  onAssign: () => void
  onReturn: () => void
  onMaintenance: () => void
  onRetire: () => void
  onPermanentDelete: () => void
  onConvertToPurchase: () => void
}

export function EquipmentActionButtons({
  canReportProblem,
  canRequestMaintenance,
  canEdit,
  canAssign,
  canReturn,
  canMaintenance,
  canRetire,
  canPermanentDelete,
  canConvertToPurchase,
  isInMaintenance,
  onReportProblem,
  onRequestMaintenance,
  onEdit,
  onAssign,
  onReturn,
  onMaintenance,
  onRetire,
  onPermanentDelete,
  onConvertToPurchase,
}: EquipmentActionButtonsProps) {
  return (
    <div className='flex gap-2 flex-wrap'>
      {canReportProblem && (
        <Button onClick={onReportProblem} variant='default'>
          <AlertCircle className='mr-2 h-4 w-4' />
          Reportar Problema
        </Button>
      )}
      {canRequestMaintenance && !isInMaintenance && (
        <Button
          onClick={onRequestMaintenance}
          variant='outline'
          className='border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30'
        >
          <Wrench className='mr-2 h-4 w-4' />
          Solicitar Mantenimiento
        </Button>
      )}
      {canConvertToPurchase && (
        <Button onClick={onConvertToPurchase} variant='outline'>
          <ShoppingCart className='mr-2 h-4 w-4' />
          Adquirir en propiedad
        </Button>
      )}
      {canEdit && (
        <Button onClick={onEdit} variant='outline'>
          <Edit className='mr-2 h-4 w-4' />
          Editar
        </Button>
      )}
      {canAssign && (
        <Button onClick={onAssign}>
          <UserPlus className='mr-2 h-4 w-4' />
          Asignar
        </Button>
      )}
      {canReturn && (
        <Button
          onClick={onReturn}
          variant='outline'
          className='border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30'
        >
          <UserPlus className='mr-2 h-4 w-4 rotate-180' />
          Devolver a Bodega
        </Button>
      )}
      {canMaintenance && (
        <Button onClick={onMaintenance} variant='outline'>
          <Wrench className='mr-2 h-4 w-4' />
          Mantenimiento
        </Button>
      )}
      {canRetire && (
        <Button onClick={onRetire} variant='destructive'>
          <Trash2 className='mr-2 h-4 w-4' />
          Solicitar Baja
        </Button>
      )}
      {canPermanentDelete && (
        <Button
          onClick={onPermanentDelete}
          variant='ghost'
          size='sm'
          className='text-muted-foreground hover:text-destructive hover:bg-destructive/10'
          title='Eliminar permanentemente del sistema'
        >
          <Trash2 className='mr-2 h-4 w-4' />
          <span className='text-xs'>Eliminar definitivamente</span>
        </Button>
      )}
    </div>
  )
}
