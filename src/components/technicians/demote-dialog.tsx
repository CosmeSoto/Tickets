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

interface DemoteDialogProps {
  technician: Technician | null
  demoting: boolean
  validation: {
    canDemote: boolean
    pendingTickets: number
    activeAssignments: number
  } | null
  onClose: () => void
  onConfirm: () => void
}

export function DemoteDialog({ technician, demoting, validation, onClose, onConfirm }: DemoteDialogProps) {
  return (
    <AlertDialog open={!!technician} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Convertir técnico a cliente?</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Estás seguro de que quieres convertir a "{technician?.name}" de técnico a cliente?
            {technician && validation && (
              <div className='mt-3 p-3 bg-muted rounded text-sm'>
                <div className='font-medium mb-2'>Validación de seguridad:</div>
                <div className='space-y-1'>
                  <div className={validation.pendingTickets === 0 ? 'text-green-600' : 'text-red-600'}>
                    {validation.pendingTickets === 0 ? '✓' : '✗'} Tickets pendientes: {validation.pendingTickets}
                  </div>
                  <div className={validation.activeAssignments === 0 ? 'text-green-600' : 'text-red-600'}>
                    {validation.activeAssignments === 0 ? '✓' : '✗'} Asignaciones activas: {validation.activeAssignments}
                  </div>
                </div>
                
                {!validation.canDemote && (
                  <div className='mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded'>
                    <div className='text-yellow-800 font-medium mb-1'>⚠️ Acciones requeridas:</div>
                    <ul className='text-xs text-yellow-700 space-y-1'>
                      {validation.pendingTickets > 0 && (
                        <li>• Resolver o reasignar todos los tickets pendientes</li>
                      )}
                      {validation.activeAssignments > 0 && (
                        <li>• Eliminar todas las asignaciones de categorías</li>
                      )}
                    </ul>
                  </div>
                )}
                
                {validation.canDemote && (
                  <div className='mt-3 p-2 bg-green-50 border border-green-200 rounded'>
                    <div className='text-green-800 text-xs'>
                      ✓ El técnico cumple con todos los requisitos para ser convertido a cliente.
                      Todas sus asignaciones de categorías serán eliminadas.
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className='mt-2'>Esta acción no se puede deshacer.</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex flex-row justify-end space-x-2">
          <AlertDialogCancel disabled={demoting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={demoting || !validation?.canDemote}
            className='bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400'
          >
            {demoting ? (
              <>
                <RefreshCw className='h-4 w-4 mr-2 animate-spin' />
                Convirtiendo...
              </>
            ) : (
              'Convertir a Cliente'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
