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
import { RefreshCw } from 'lucide-react'
import type { Technician } from '@/hooks/use-technicians'

interface DeleteDialogProps {
  technician: Technician | null
  deleting: boolean
  onClose: () => void
  onConfirm: () => void
}

export function DeleteDialog({ technician, deleting, onClose, onConfirm }: DeleteDialogProps) {
  return (
    <AlertDialog open={!!technician} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar técnico?</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Estás seguro de que quieres eliminar al técnico "{technician?.name}"?
            {technician && (
              <div className='mt-3 p-3 bg-muted rounded text-sm'>
                <div className='font-medium mb-2'>Información del técnico:</div>
                <div>• Tickets asignados: {technician._count?.assignedTickets || 0}</div>
                <div>• Categorías asignadas: {technician._count?.technicianAssignments || 0}</div>
                {!technician.canDelete && (
                  <div className='mt-2 text-red-600 font-medium'>
                    ⚠️ No se puede eliminar: tiene tickets o asignaciones activas
                  </div>
                )}
              </div>
            )}
            <div className='mt-2'>Esta acción no se puede deshacer.</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex flex-row justify-end space-x-2">
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={deleting || !technician?.canDelete}
            className='bg-red-600 hover:bg-red-700 disabled:bg-gray-400'
          >
            {deleting ? (
              <>
                <RefreshCw className='h-4 w-4 mr-2 animate-spin' />
                Eliminando...
              </>
            ) : (
              'Eliminar'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
