/**
 * Permanent Delete Dialog Component
 */

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
import { getEquipmentDisplayName } from '@/lib/utils/equipment-display'

interface PermanentDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipmentCode: string
  equipmentTypeName?: string
  equipmentBrandName?: string
  equipmentModelName?: string
  equipmentStatus?: string
  onConfirm: () => void
  deleting: boolean
}

export function PermanentDeleteDialog({
  open,
  onOpenChange,
  equipmentCode,
  equipmentTypeName,
  equipmentBrandName,
  equipmentModelName,
  equipmentStatus,
  onConfirm,
  deleting,
}: PermanentDeleteDialogProps) {
  const isRetired = equipmentStatus === 'RETIRED'

  const displayName = getEquipmentDisplayName({
    equipmentCode,
    equipmentTypeName,
    equipmentBrandName,
    equipmentModelName,
  })

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className='text-destructive'>
            Eliminar equipo permanentemente
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className='space-y-3'>
              <p>
                Esta acción es <span className='font-semibold text-destructive'>irreversible</span>.
                Se eliminará el equipo <span className='font-semibold'>{displayName}</span> y todos
                sus registros asociados (mantenimientos, asignaciones, actas) de forma permanente.
              </p>
              {!isRetired && (
                <p className='text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded px-3 py-2'>
                  ⚠ Este equipo no está retirado. Solo el Super Administrador puede eliminarlo en
                  este estado.
                </p>
              )}
              <p className='text-xs text-muted-foreground'>
                Esta acción quedará registrada en el historial de auditoría.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={deleting}
            className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
          >
            {deleting ? 'Eliminando...' : 'Eliminar permanentemente'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
