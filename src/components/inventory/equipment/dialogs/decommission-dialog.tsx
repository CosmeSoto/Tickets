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
import { getEquipmentDisplayName } from '@/lib/utils/equipment-display'

interface DecommissionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipmentId: string
  equipmentCode: string
  equipmentTypeName?: string
  equipmentBrandName?: string
  equipmentModelName?: string
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
  equipmentTypeName,
  equipmentBrandName,
  equipmentModelName,
  acquisitionMode = 'FIXED_ASSET',
  onSuccess,
}: DecommissionDialogProps) {
  const title = DIALOG_TITLES[acquisitionMode]
  const description = DIALOG_DESCRIPTIONS[acquisitionMode]
  const assetName = getEquipmentDisplayName({
    equipmentCode,
    equipmentTypeName,
    equipmentBrandName,
    equipmentModelName,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-lg max-h-[90vh]' aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className='overflow-y-auto max-h-[calc(90vh-100px)]'>
          <DecommissionRequestForm
            assetType='EQUIPMENT'
            assetId={equipmentId}
            assetName={assetName}
            acquisitionMode={acquisitionMode}
            onSuccess={() => {
              onOpenChange(false)
              onSuccess()
            }}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
