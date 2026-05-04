/**
 * Decommission Dialog Component
 *
 * Adapta el formulario según el tipo de adquisición del equipo:
 *   - FIXED_ASSET : baja por obsolescencia/daño — flujo con evidencia fotográfica
 *   - RENTAL      : devolución al proveedor arrendador
 *   - LOAN        : devolución al propietario del bien prestado
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DecommissionRequestForm,
  type AcquisitionMode,
} from '../../decommission/DecommissionRequestForm'

interface DecommissionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipmentId: string
  equipmentCode: string
  equipmentBrand: string
  equipmentModel: string
  /** Modo de adquisición — determina si es baja o devolución */
  acquisitionMode?: AcquisitionMode
  onSuccess: () => void
}

const DIALOG_TITLES: Record<AcquisitionMode, string> = {
  FIXED_ASSET: 'Solicitar Baja de Equipo',
  RENTAL: 'Registrar Devolución al Proveedor',
  LOAN: 'Registrar Devolución al Propietario',
}

const DIALOG_DESCRIPTIONS: Record<AcquisitionMode, string> = {
  FIXED_ASSET: 'Esta solicitud será revisada por el administrador antes de proceder.',
  RENTAL:
    'Registra la devolución del equipo arrendado. El administrador confirmará el cierre del contrato.',
  LOAN: 'Registra la devolución del bien prestado. El administrador confirmará la recepción.',
}

export function DecommissionDialog({
  open,
  onOpenChange,
  equipmentId,
  equipmentCode,
  equipmentBrand,
  equipmentModel,
  acquisitionMode = 'FIXED_ASSET',
  onSuccess,
}: DecommissionDialogProps) {
  const title = DIALOG_TITLES[acquisitionMode]
  const description = DIALOG_DESCRIPTIONS[acquisitionMode]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-lg max-h-[90vh] overflow-y-auto' aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DecommissionRequestForm
          assetType='EQUIPMENT'
          assetId={equipmentId}
          assetName={`${equipmentCode} — ${equipmentBrand} ${equipmentModel}`}
          acquisitionMode={acquisitionMode}
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
