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

interface PermanentDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipmentCode: string
  onConfirm: () => void
  deleting: boolean
}

export function PermanentDeleteDialog({
  open,
  onOpenChange,
  equipmentCode,
  onConfirm,
  deleting,
}: PermanentDeleteDialogProps) {
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
                Se eliminará el equipo <span className='font-semibold'>{equipmentCode}</span> y
                todos sus registros asociados (mantenimientos, asignaciones) de forma permanente.
              </p>
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
