'use client'

import { useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertTriangle,
  Clock,
  Package,
  FileText,
  ClipboardList,
  Wrench,
  Key,
  Layers,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { inventoryToast as toast } from '@/lib/utils/inventory-toast'

interface DashboardAlerts {
  lowStockConsumables: number
  maintenanceDue: number
  expiringContracts: number
  expiringRentals: number
  expiringLicenses: number
  pendingActs: number
  pendingRequests: number
  batchCriticalBatches: number
  batchWarningBatches: number
}

export function AlertsSection() {
  const [alerts, setAlerts] = useState<DashboardAlerts | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAlerts()
  }, [])

  const fetchAlerts = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/inventory/dashboard/alerts')

      if (res.ok) {
        const data = await res.json()
        setAlerts(data)
      } else {
        toast({
          title: 'No se pudieron cargar las alertas',
          description: 'Intenta recargar la página',
          variant: 'destructive',
        })
      }
    } catch (err) {
      toast({
        title: 'Error de conexión',
        description: 'No se pudieron cargar las alertas del inventario',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className='space-y-3'>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className='h-20 animate-pulse rounded-lg bg-muted' />
        ))}
      </div>
    )
  }

  if (!alerts || !hasAlerts(alerts)) {
    return null
  }

  return (
    <div className='space-y-3'>
      {alerts.batchCriticalBatches > 0 && (
        <Alert variant='destructive'>
          <Layers className='h-4 w-4' />
          <AlertTitle>Lotes con alerta crítica</AlertTitle>
          <AlertDescription className='flex items-center justify-between'>
            <span>
              {alerts.batchCriticalBatches} lote{alerts.batchCriticalBatches !== 1 ? 's' : ''} sin
              stock o con utilización crítica
              {alerts.batchWarningBatches > 0 && ` · ${alerts.batchWarningBatches} en advertencia`}
            </span>
            <Link href='/inventory?tab=batches'>
              <Button variant='outline' size='sm'>
                Ver lotes
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {alerts.batchCriticalBatches === 0 && alerts.batchWarningBatches > 0 && (
        <Alert>
          <Layers className='h-4 w-4' />
          <AlertTitle>Lotes con stock bajo</AlertTitle>
          <AlertDescription className='flex items-center justify-between'>
            <span>
              {alerts.batchWarningBatches} lote{alerts.batchWarningBatches !== 1 ? 's' : ''} con
              alta utilización o poco stock
            </span>
            <Link href='/inventory?tab=batches'>
              <Button variant='outline' size='sm'>
                Ver lotes
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {alerts.lowStockConsumables > 0 && (
        <Alert variant='destructive'>
          <AlertTriangle className='h-4 w-4' />
          <AlertTitle>Stock Bajo</AlertTitle>
          <AlertDescription className='flex items-center justify-between'>
            <span>
              {alerts.lowStockConsumables} suministro{alerts.lowStockConsumables !== 1 ? 's' : ''}{' '}
              con stock bajo del mínimo
            </span>
            <Link href='/inventory'>
              <Button variant='outline' size='sm'>
                Ver
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {alerts.maintenanceDue > 0 && (
        <Alert>
          <Wrench className='h-4 w-4' />
          <AlertTitle>Mantenimientos Programados</AlertTitle>
          <AlertDescription className='flex items-center justify-between'>
            <span>
              {alerts.maintenanceDue} mantenimiento{alerts.maintenanceDue !== 1 ? 's' : ''}{' '}
              programado{alerts.maintenanceDue !== 1 ? 's' : ''} en los próximos 30 días
            </span>
            <Link href='/inventory/maintenance'>
              <Button variant='outline' size='sm'>
                Ver
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {alerts.expiringContracts > 0 && (
        <Alert>
          <Clock className='h-4 w-4' />
          <AlertTitle>Contratos por Vencer</AlertTitle>
          <AlertDescription className='flex items-center justify-between'>
            <span>
              {alerts.expiringContracts} contrato{alerts.expiringContracts !== 1 ? 's' : ''} vence
              {alerts.expiringContracts !== 1 ? 'n' : ''} en los próximos 30 días
            </span>
            <Link href='/inventory/contracts'>
              <Button variant='outline' size='sm'>
                Ver
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {alerts.expiringRentals > 0 && (
        <Alert>
          <Package className='h-4 w-4' />
          <AlertTitle>Arrendamientos por Vencer</AlertTitle>
          <AlertDescription className='flex items-center justify-between'>
            <span>
              {alerts.expiringRentals} equipo{alerts.expiringRentals !== 1 ? 's' : ''} arrendado
              {alerts.expiringRentals !== 1 ? 's' : ''} vence
              {alerts.expiringRentals !== 1 ? 'n' : ''} en los próximos 30 días
            </span>
            <Link href='/inventory?ownershipType=RENTAL'>
              <Button variant='outline' size='sm'>
                Ver
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {alerts.expiringLicenses > 0 && (
        <Alert>
          <Key className='h-4 w-4' />
          <AlertTitle>Licencias por Expirar</AlertTitle>
          <AlertDescription className='flex items-center justify-between'>
            <span>
              {alerts.expiringLicenses} licencia{alerts.expiringLicenses !== 1 ? 's' : ''} expira
              {alerts.expiringLicenses !== 1 ? 'n' : ''} en los próximos 30 días
            </span>
            <Link href='/inventory/licenses'>
              <Button variant='outline' size='sm'>
                Ver
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {alerts.pendingActs > 0 && (
        <Alert>
          <FileText className='h-4 w-4' />
          <AlertTitle>Actas Pendientes</AlertTitle>
          <AlertDescription className='flex items-center justify-between'>
            <span>
              {alerts.pendingActs} acta{alerts.pendingActs !== 1 ? 's' : ''} pendiente
              {alerts.pendingActs !== 1 ? 's' : ''} de firma
            </span>
            <Link href='/inventory/acts'>
              <Button variant='outline' size='sm'>
                Ver
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {alerts.pendingRequests > 0 && (
        <Alert>
          <ClipboardList className='h-4 w-4' />
          <AlertTitle>Solicitudes Pendientes</AlertTitle>
          <AlertDescription className='flex items-center justify-between'>
            <span>
              {alerts.pendingRequests} solicitud{alerts.pendingRequests !== 1 ? 'es' : ''} pendiente
              {alerts.pendingRequests !== 1 ? 's' : ''} de aprobación
            </span>
            <Link href='/inventory/requests'>
              <Button variant='outline' size='sm'>
                Ver
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

function hasAlerts(alerts: DashboardAlerts): boolean {
  return (
    alerts.batchCriticalBatches > 0 ||
    alerts.batchWarningBatches > 0 ||
    alerts.lowStockConsumables > 0 ||
    alerts.maintenanceDue > 0 ||
    alerts.expiringContracts > 0 ||
    alerts.expiringRentals > 0 ||
    alerts.expiringLicenses > 0 ||
    alerts.pendingActs > 0 ||
    alerts.pendingRequests > 0
  )
}
