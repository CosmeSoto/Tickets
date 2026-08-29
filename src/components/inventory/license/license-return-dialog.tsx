'use client'

/**
 * LicenseReturnDialog — confirmación liviana para "Devolver" una licencia.
 *
 * A diferencia de Equipos (que genera acta de devolución firmable), acá no hay acta:
 * se decidió que una licencia no necesita ese nivel de trazabilidad física — devolver
 * es instantáneo, igual que ya funcionaba el botón «Desasignar» escondido dentro del
 * diálogo de asignación. Este componente solo le da visibilidad como acción de primer
 * nivel (mismo patrón "Asignar/Devolver" que Equipos) y explica qué implica.
 */

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2, RotateCcw } from 'lucide-react'

type LicenseReturnDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  licenseId: string
  licenseName: string
  /** Descripción legible del destinatario actual — "Juan Pérez", "Departamento X", "Empresa". */
  currentAssignee?: string | null
  onReturned: () => void
}

export function LicenseReturnDialog({
  open,
  onOpenChange,
  licenseId,
  licenseName,
  currentAssignee,
  onReturned,
}: LicenseReturnDialogProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/inventory/licenses/${licenseId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unassign' }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'No se pudo devolver la licencia')
      }
      onReturned()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Devolver licencia</DialogTitle>
          <DialogDescription>
            <span className='font-medium text-foreground'>{licenseName}</span>
            {currentAssignee ? (
              <>
                {' '}
                deja de estar asignada a{' '}
                <span className='font-medium text-foreground'>{currentAssignee}</span>.
              </>
            ) : (
              ' deja de estar asignada.'
            )}
          </DialogDescription>
        </DialogHeader>

        <p className='text-sm text-muted-foreground rounded-md border bg-muted/30 px-3 py-2'>
          Esto no afecta el pago ni la vigencia de la licencia — sigue siendo válida según su fecha
          de vencimiento y queda disponible para asignarla a otra persona cuando quieras.
        </p>

        {error && <p className='text-sm text-destructive'>{error}</p>}

        <DialogFooter className='gap-2 sm:gap-2'>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type='button' disabled={submitting} onClick={() => void handleConfirm()}>
            {submitting ? (
              <Loader2 className='h-4 w-4 mr-1.5 animate-spin' />
            ) : (
              <RotateCcw className='h-4 w-4 mr-1.5' />
            )}
            Confirmar devolución
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
