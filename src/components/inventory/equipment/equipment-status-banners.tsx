/**
 * Equipment Status Banners Component
 * Displays contextual status alerts
 */

import { Wrench, AlertCircle, ExternalLink } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { Equipment, Assignment, MaintenanceRecord } from './utils/equipment-types'

interface EquipmentStatusBannersProps {
  equipment: Equipment
  currentAssignment?: Assignment
  maintenanceRecords: MaintenanceRecord[]
  userRole: string
  isInMaintenance: boolean
  isAssigned: boolean
  isRetired: boolean
  canPermanentDelete: boolean
}

export function EquipmentStatusBanners({
  equipment,
  currentAssignment,
  maintenanceRecords,
  userRole,
  isInMaintenance,
  isAssigned,
  isRetired,
  canPermanentDelete,
}: EquipmentStatusBannersProps) {
  return (
    <>
      {/* Banner de mantenimiento activo */}
      {isInMaintenance && maintenanceRecords.length > 0 && (
        <Alert className='border-amber-400 bg-amber-50 dark:bg-amber-950/30'>
          <Wrench className='h-4 w-4 text-amber-600 dark:text-amber-400' />
          <AlertDescription className='text-amber-800 dark:text-amber-200 flex items-center justify-between'>
            <span>
              <span className='font-medium'>Equipo en mantenimiento.</span>{' '}
              {userRole === 'CLIENT'
                ? 'El equipo está siendo atendido por el equipo técnico. Recibirás una notificación cuando esté listo.'
                : 'Completa el mantenimiento para devolver el equipo a bodega o reasignarlo.'}
            </span>
            <a
              href={`/inventory/maintenance/${maintenanceRecords[0].id}`}
              className='ml-4 flex items-center gap-1 text-sm font-medium text-amber-700 dark:text-amber-300 underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-100 flex-shrink-0'
            >
              Ver mantenimiento <ExternalLink className='h-3 w-3' />
            </a>
          </AlertDescription>
        </Alert>
      )}

      {/* Banner de solicitud pendiente */}
      {!isInMaintenance && maintenanceRecords.some(r => r.status === 'REQUESTED') && (
        <Alert className='border-blue-300 bg-blue-50 dark:bg-blue-950/30'>
          <AlertCircle className='h-4 w-4 text-blue-600 dark:text-blue-400' />
          <AlertDescription className='text-blue-800 dark:text-blue-200 flex items-center justify-between'>
            <span>
              <span className='font-medium'>Solicitud de mantenimiento pendiente.</span>{' '}
              {userRole === 'CLIENT'
                ? 'Tu solicitud está siendo revisada por el equipo técnico.'
                : 'Hay una solicitud de mantenimiento pendiente de aprobación.'}
            </span>
            {maintenanceRecords.find(r => r.status === 'REQUESTED') && (
              <a
                href={`/inventory/maintenance/${maintenanceRecords.find(r => r.status === 'REQUESTED')!.id}`}
                className='ml-4 flex items-center gap-1 text-sm font-medium text-blue-700 dark:text-blue-300 underline underline-offset-2 hover:text-blue-900 dark:hover:text-blue-100 flex-shrink-0'
              >
                Ver solicitud <ExternalLink className='h-3 w-3' />
              </a>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Banner de asignación activa */}
      {isAssigned && currentAssignment && (
        <Alert className='border-blue-300 bg-blue-50 dark:bg-blue-950/30'>
          <AlertCircle className='h-4 w-4 text-blue-600 dark:text-blue-400' />
          <AlertDescription className='text-blue-800 dark:text-blue-200'>
            <span className='font-medium'>Equipo asignado</span> a{' '}
            <span className='font-medium'>{currentAssignment.receiver?.name}</span> desde el{' '}
            {new Date(currentAssignment.startDate).toLocaleDateString('es-ES')}.
            {(userRole === 'ADMIN' || userRole === 'TECHNICIAN') &&
              ' Para reasignarlo, primero devuélvelo a bodega.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Banner de equipo retirado */}
      {isRetired && (
        <Alert className='border-border bg-muted'>
          <AlertCircle className='h-4 w-4 text-muted-foreground' />
          <AlertDescription className='text-muted-foreground'>
            <div className='flex items-center justify-between gap-3 flex-wrap'>
              <div>
                <span className='font-medium'>Equipo dado de baja.</span> Ya no está activo en el
                inventario.
                {canPermanentDelete && ' Puedes eliminarlo definitivamente del sistema.'}
              </div>
              {/* Folio y PDF del acta de baja */}
              {(() => {
                const decommissionReq = ((equipment as any).decommission_requests ?? [])[0]
                const act = decommissionReq?.act
                if (!act) return null
                return (
                  <div className='flex items-center gap-2 flex-shrink-0'>
                    {act.folio && (
                      <span className='font-mono text-xs font-semibold'>{act.folio}</span>
                    )}
                    {act.pdfPath && (
                      <a
                        href={`/api/inventory/decommission-acts/${decommissionReq.id}/pdf`}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='flex items-center gap-1 text-xs font-medium underline underline-offset-2 hover:text-foreground'
                      >
                        <ExternalLink className='h-3 w-3' />
                        Descargar acta
                      </a>
                    )}
                  </div>
                )
              })()}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </>
  )
}
