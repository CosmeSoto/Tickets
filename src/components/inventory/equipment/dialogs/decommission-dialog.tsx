/**
 * Decommission Dialog Component
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DecommissionRequestForm } from '../../decommission/DecommissionRequestForm'

interface DecommissionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipmentId: string
  equipmentCode: string
  equipmentBrand: string
  equipmentModel: string
  onSuccess: () => void
}

export function DecommissionDialog({
  open,
  onOpenChange,
  equipmentId,
  equipmentCode,
  equipmentBrand,
  equipmentModel,
  onSuccess,
}: DecommissionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-lg' aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Solicitar Baja de Equipo</DialogTitle>
          <DialogDescription>
            Esta solicitud será revisada por el administrador antes de proceder.
          </DialogDescription>
        </DialogHeader>
        <DecommissionRequestForm
          assetType='EQUIPMENT'
          assetId={equipmentId}
          assetName={`${equipmentCode} — ${equipmentBrand} ${equipmentModel}`}
          onSuccess={() => {
            onOpenChange(false)
            onSuccess()
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
