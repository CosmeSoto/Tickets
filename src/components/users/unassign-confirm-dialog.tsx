'use client'

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

interface UnassignConfirmDialogProps {
  open: boolean
  familyName: string
  activeTicketCount: number
  onConfirm: () => void
  onCancel: () => void
}

export function UnassignConfirmDialog({
  open,
  familyName,
  activeTicketCount,
  onConfirm,
  onCancel,
}: UnassignConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={v => !v && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar desasignación</AlertDialogTitle>
          <AlertDialogDescription>
            La familia <strong>{familyName}</strong> tiene <strong>{activeTicketCount}</strong>{' '}
            ticket(s) activo(s) asignados a este técnico. ¿Deseas continuar con la desasignación?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
          >
            Desasignar de todas formas
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
