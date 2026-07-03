import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'

interface BatchIntegrityAlertProps {
  integrity: {
    isConsistent: boolean
    recordedQuantity: number
    actualEquipmentCount: number
    message?: string
  }
}

export function BatchIntegrityAlert({ integrity }: BatchIntegrityAlertProps) {
  if (integrity.isConsistent) return null

  return (
    <Alert
      variant='default'
      className='border-amber-500/50 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100'
    >
      <AlertTriangle className='h-4 w-4' />
      <AlertTitle className='text-sm'>Inconsistencia en el lote</AlertTitle>
      <AlertDescription className='text-sm'>
        {integrity.message ??
          `Cantidad registrada: ${integrity.recordedQuantity}. Equipos vinculados: ${integrity.actualEquipmentCount}.`}
      </AlertDescription>
    </Alert>
  )
}
