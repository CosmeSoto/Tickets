'use client'

/**
 * Ficha de un lote de licencias — contraparte de la ficha de lote de equipos
 * (`/inventory/batches/[id]`), pero sin depreciación/condición (no aplican a
 * una licencia). Reusa RenewLicenseBatchDialog tal cual (la misma acción que
 * ya existía desde la ficha de una licencia individual, ver license-detail.tsx).
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  KeyRound,
  Calendar,
  DollarSign,
  Building2,
  FileText,
  RefreshCw,
  CheckCircle,
  UserCheck,
  ExternalLink,
} from 'lucide-react'
import { BatchUtilizationAlerts } from '@/components/inventory/batch/BatchUtilizationAlerts'
import { RenewLicenseBatchDialog } from '@/components/inventory/license/renew-license-batch-dialog'
import { LICENSE_RENEWAL_FREQUENCY_LABELS } from '@/lib/inventory/license-labels'

interface LicenseBatchDetailData {
  batch: {
    id: string
    batchCode: string
    licenseType: { id: string; name: string }
    quantity: number
    unitCost: number
    totalCost: number
    purchaseDate: string
    invoiceNumber: string | null
    purchaseOrderNumber: string | null
    supplier: { id: string; name: string } | null
    department: { id: string; name: string } | null
    renewalDate: string | null
    renewalCost: number | null
    renewalFrequency: string | null
    customFrequencyMonths: number | null
    notes: string | null
  }
  licenses: Array<{
    id: string
    code: string
    name: string
    assignedToUser: string | null
    assignedToDepartment: string | null
    assignedToEquipment: string | null
    batchRenewalLinked: boolean
  }>
  metrics: { total: number; assigned: number; available: number }
  hasContractLink: boolean
}

interface LicenseBatchDetailProps {
  batchId: string
  canEdit: boolean
}

export function LicenseBatchDetail({ batchId, canEdit }: LicenseBatchDetailProps) {
  const router = useRouter()
  const [data, setData] = useState<LicenseBatchDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showRenewDialog, setShowRenewDialog] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/inventory/license-batches/${batchId}`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Error al cargar el lote')
      }
      setData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el lote')
    } finally {
      setLoading(false)
    }
  }, [batchId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className='space-y-4'>
        <div className='h-8 w-48 bg-muted animate-pulse rounded' />
        <div className='h-32 w-full bg-muted animate-pulse rounded-lg' />
        <div className='h-64 w-full bg-muted animate-pulse rounded-lg' />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className='text-center py-16 text-muted-foreground'>
        <p className='font-medium text-destructive'>{error || 'Lote no encontrado'}</p>
        <Button
          variant='outline'
          size='sm'
          className='mt-4'
          onClick={() => router.push('/inventory')}
        >
          Volver a Inventario
        </Button>
      </div>
    )
  }

  const { batch, licenses, metrics, hasContractLink } = data
  const utilizationRate = metrics.total > 0 ? (metrics.assigned / metrics.total) * 100 : 0

  return (
    <div className='space-y-6'>
      {/* Breadcrumb */}
      <div className='flex items-center gap-3'>
        <Link href='/inventory'>
          <Button variant='ghost' size='sm' className='flex items-center gap-2 -ml-2'>
            <ArrowLeft className='w-4 h-4' />
            Inventario
          </Button>
        </Link>
        <span className='text-muted-foreground'>/</span>
        <Link href='/inventory?tab=batches'>
          <Button variant='ghost' size='sm' className='-ml-2'>
            Lotes
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className='flex items-start justify-between gap-4 flex-wrap'>
        <div>
          <div className='flex items-center gap-3 mb-1 flex-wrap'>
            <KeyRound className='w-7 h-7 text-primary' />
            <h1 className='text-2xl font-bold'>{batch.batchCode}</h1>
            <Badge variant='secondary'>{batch.quantity} licencias</Badge>
            {hasContractLink && (
              <Badge variant='outline' className='gap-1'>
                <FileText className='h-3 w-3' />
                Con contrato
              </Badge>
            )}
          </div>
          <p className='text-muted-foreground ml-10'>{batch.licenseType.name}</p>
        </div>
        {canEdit && !hasContractLink && (
          <Button variant='outline' size='sm' onClick={() => setShowRenewDialog(true)}>
            <RefreshCw className='h-3.5 w-3.5 mr-1.5' />
            Renovar lote completo
          </Button>
        )}
      </div>

      {hasContractLink && (
        <p className='text-sm text-muted-foreground'>
          La renovación de este lote se gestiona desde su contrato vinculado — cada licencia quedó
          como una línea propia del contrato.
        </p>
      )}

      {/* Métricas */}
      <div className='space-y-3'>
        <div className='grid grid-cols-3 gap-3'>
          <div className='rounded-lg border bg-card p-4 text-center'>
            <p className='text-2xl font-bold'>{metrics.total}</p>
            <p className='text-xs text-muted-foreground'>Total</p>
          </div>
          <div className='rounded-lg border bg-card p-4 text-center'>
            <p className='text-2xl font-bold text-green-600'>{metrics.available}</p>
            <p className='text-xs text-muted-foreground'>Disponibles</p>
          </div>
          <div className='rounded-lg border bg-card p-4 text-center'>
            <p className='text-2xl font-bold text-blue-600'>{metrics.assigned}</p>
            <p className='text-xs text-muted-foreground'>Asignadas</p>
          </div>
        </div>
        <div>
          <div className='flex justify-between text-xs text-muted-foreground mb-1'>
            <span>Utilización</span>
            <span>{utilizationRate.toFixed(0)}%</span>
          </div>
          <div className='h-1.5 bg-muted rounded-full overflow-hidden'>
            <div
              className={`h-full rounded-full transition-all ${
                utilizationRate > 90
                  ? 'bg-red-500'
                  : utilizationRate > 70
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(utilizationRate, 100)}%` }}
            />
          </div>
        </div>
        <BatchUtilizationAlerts
          metrics={{ ...metrics, maintenance: 0, retired: 0, utilizationRate }}
        />
      </div>

      {/* Información del lote */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base flex items-center gap-2'>
            <FileText className='w-4 h-4' />
            Información del Lote
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
            <div className='flex items-center gap-3'>
              <Calendar className='w-4 h-4 text-muted-foreground shrink-0' />
              <div>
                <p className='text-xs text-muted-foreground'>Fecha de Compra</p>
                <p className='font-medium text-sm'>
                  {format(new Date(batch.purchaseDate), 'PPP', { locale: es })}
                </p>
              </div>
            </div>

            <div className='flex items-center gap-3'>
              <DollarSign className='w-4 h-4 text-muted-foreground shrink-0' />
              <div>
                <p className='text-xs text-muted-foreground'>Costo Unitario / Total</p>
                <p className='font-medium text-sm'>
                  ${batch.unitCost.toFixed(2)} / ${batch.totalCost.toFixed(2)}
                </p>
              </div>
            </div>

            <div className='flex items-center gap-3'>
              <Building2 className='w-4 h-4 text-muted-foreground shrink-0' />
              <div>
                <p className='text-xs text-muted-foreground'>Proveedor</p>
                <p className='font-medium text-sm'>{batch.supplier?.name || '—'}</p>
              </div>
            </div>

            {batch.department && (
              <div className='flex items-center gap-3'>
                <Building2 className='w-4 h-4 text-muted-foreground shrink-0' />
                <div>
                  <p className='text-xs text-muted-foreground'>Departamento</p>
                  <p className='font-medium text-sm'>{batch.department.name}</p>
                </div>
              </div>
            )}

            {batch.invoiceNumber && (
              <div>
                <p className='text-xs text-muted-foreground'>Nº Factura</p>
                <p className='font-medium text-sm font-mono'>{batch.invoiceNumber}</p>
              </div>
            )}

            {batch.purchaseOrderNumber && (
              <div>
                <p className='text-xs text-muted-foreground'>Orden de Compra</p>
                <p className='font-medium text-sm font-mono'>{batch.purchaseOrderNumber}</p>
              </div>
            )}

            {!hasContractLink && batch.renewalDate && (
              <div>
                <p className='text-xs text-muted-foreground'>Próxima renovación</p>
                <p className='font-medium text-sm'>
                  {format(new Date(batch.renewalDate), 'PPP', { locale: es })}
                  {batch.renewalFrequency &&
                    ` · ${LICENSE_RENEWAL_FREQUENCY_LABELS[batch.renewalFrequency] ?? batch.renewalFrequency}`}
                </p>
              </div>
            )}

            {batch.notes && (
              <div className='sm:col-span-2 lg:col-span-3'>
                <p className='text-xs text-muted-foreground'>Notas</p>
                <p className='text-sm'>{batch.notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Licencias del lote */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Licencias del lote ({licenses.length})</CardTitle>
        </CardHeader>
        <CardContent className='p-0'>
          <div className='divide-y'>
            {licenses.map(license => {
              const isAssigned = Boolean(
                license.assignedToUser ||
                license.assignedToDepartment ||
                license.assignedToEquipment
              )
              return (
                <Link
                  key={license.id}
                  href={`/inventory/license/${license.id}`}
                  className='flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition-colors'
                >
                  <div className='flex items-center gap-2 min-w-0'>
                    <span className='font-mono text-sm shrink-0'>{license.code}</span>
                    <span className='text-sm text-muted-foreground truncate'>{license.name}</span>
                  </div>
                  <div className='flex items-center gap-2 shrink-0'>
                    {isAssigned ? (
                      <Badge variant='secondary' className='gap-1 text-xs'>
                        <UserCheck className='h-3 w-3' />
                        Asignada
                      </Badge>
                    ) : (
                      <Badge
                        variant='outline'
                        className='gap-1 text-xs text-green-600 border-green-600/30'
                      >
                        <CheckCircle className='h-3 w-3' />
                        Disponible
                      </Badge>
                    )}
                    <ExternalLink className='h-3.5 w-3.5 text-muted-foreground' />
                  </div>
                </Link>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {!hasContractLink && (
        <RenewLicenseBatchDialog
          open={showRenewDialog}
          onOpenChange={setShowRenewDialog}
          batchId={batch.id}
          batchCode={batch.batchCode}
          linkedCount={metrics.total}
          currentRenewalDate={batch.renewalDate}
          currentRenewalCost={batch.renewalCost}
          currentRenewalFrequency={batch.renewalFrequency}
          currentCustomFrequencyMonths={batch.customFrequencyMonths}
          onRenewed={() => void load()}
        />
      )}
    </div>
  )
}
