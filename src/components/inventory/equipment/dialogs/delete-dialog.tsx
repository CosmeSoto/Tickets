/**
 * Delete Dialog Component
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

interface DeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipmentCode: string
  equipmentBrand: string
  equipmentModel: string
  onConfirm: () => void
  deleting: boolean
}

export function DeleteDialog({
  open,
  onOpenChange,
  equipmentCode,
  equipmentBrand,
  equipmentModel,
  onConfirm,
  deleting,
}: DeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Dar de baja el equipo</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className='space-y-2'>
              <p>
                ¿Confirmas que el equipo <span className='font-semibold'>{equipmentCode}</span> (
                {equipmentBrand} {equipmentModel}) ya no está en uso y debe darse de baja?
              </p>
              <p className='text-sm text-muted-foreground'>
                El estado cambiará a <span className='font-medium'>Retirado</span>. El equipo dejará
                de aparecer como activo en el inventario. Podrás eliminarlo definitivamente después
                si lo necesitas.
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
            {deleting ? 'Procesando...' : 'Sí, dar de baja'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
