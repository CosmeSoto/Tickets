/**
 * Equipment Action Buttons
 * Botones de acción agrupados por prioridad:
 *   - Primarios: Asignar, Reportar Problema
 *   - Secundarios: Editar, Devolver, Mantenimiento, Adquirir
 *   - Destructivos: Solicitar Baja, Eliminar definitivamente
 */

import {
  Edit,
  UserPlus,
  Wrench,
  Trash2,
  AlertCircle,
  ShoppingCart,
  RotateCcw,
  DollarSign,
  ArrowRightLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal } from 'lucide-react'

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
  canSell: boolean
  canTransferFamily?: boolean
  isSuperAdmin?: boolean
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
  onSell: () => void
  onTransferFamily?: () => void
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
  canSell,
  canTransferFamily = false,
  isSuperAdmin = false,
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
  onSell,
  onTransferFamily,
}: EquipmentActionButtonsProps) {
  const hasSecondaryActions =
    canEdit ||
    canReturn ||
    canMaintenance ||
    canRequestMaintenance ||
    canConvertToPurchase ||
    canSell ||
    canTransferFamily ||
    canRetire ||
    canPermanentDelete

  return (
    <div className='flex items-center gap-2 shrink-0'>
      {/* Acción principal del cliente */}
      {canReportProblem && (
        <Button size='sm' onClick={onReportProblem}>
          <AlertCircle className='h-4 w-4 mr-1.5' />
          Reportar problema
        </Button>
      )}

      {/* Asignar — acción primaria de gestión */}
      {canAssign && (
        <Button size='sm' onClick={onAssign}>
          <UserPlus className='h-4 w-4 mr-1.5' />
          Asignar
        </Button>
      )}

      {/* Menú de acciones secundarias */}
      {hasSecondaryActions && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size='sm' variant='outline'>
              <MoreHorizontal className='h-4 w-4' />
              <span className='sr-only'>Más acciones</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-52'>
            {canEdit && (
              <DropdownMenuItem onClick={onEdit}>
                <Edit className='h-4 w-4 mr-2' />
                Editar
              </DropdownMenuItem>
            )}
            {canReturn && (
              <DropdownMenuItem onClick={onReturn}>
                <RotateCcw className='h-4 w-4 mr-2' />
                Devolver a bodega
              </DropdownMenuItem>
            )}
            {canMaintenance && (
              <DropdownMenuItem onClick={onMaintenance}>
                <Wrench className='h-4 w-4 mr-2' />
                Registrar mantenimiento
              </DropdownMenuItem>
            )}
            {canRequestMaintenance && !isInMaintenance && (
              <DropdownMenuItem onClick={onRequestMaintenance}>
                <Wrench className='h-4 w-4 mr-2' />
                Solicitar mantenimiento
              </DropdownMenuItem>
            )}
            {canConvertToPurchase && (
              <DropdownMenuItem onClick={onConvertToPurchase}>
                <ShoppingCart className='h-4 w-4 mr-2' />
                Adquirir en propiedad
              </DropdownMenuItem>
            )}
            {canSell && (
              <DropdownMenuItem onClick={onSell}>
                <DollarSign className='h-4 w-4 mr-2' />
                {isSuperAdmin ? 'Registrar venta' : 'Solicitar venta'}
              </DropdownMenuItem>
            )}
            {canTransferFamily && (
              <DropdownMenuItem onClick={onTransferFamily}>
                <ArrowRightLeft className='h-4 w-4 mr-2' />
                Transferir a otra área
              </DropdownMenuItem>
            )}
            {(canRetire || canPermanentDelete) &&
              (canEdit || canReturn || canMaintenance || canConvertToPurchase) && (
                <DropdownMenuSeparator />
              )}
            {canRetire && (
              <DropdownMenuItem
                onClick={onRetire}
                className='text-destructive focus:text-destructive focus:bg-destructive/10'
              >
                <Trash2 className='h-4 w-4 mr-2' />
                Solicitar baja
              </DropdownMenuItem>
            )}
            {canPermanentDelete && (
              <DropdownMenuItem
                onClick={onPermanentDelete}
                className='text-destructive focus:text-destructive focus:bg-destructive/10'
              >
                <Trash2 className='h-4 w-4 mr-2' />
                Eliminar definitivamente
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
