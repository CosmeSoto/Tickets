'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Package,
  Calendar,
  DollarSign,
  CheckCircle,
  UserCheck,
  Wrench,
  Archive,
  Layers,
  Plus,
  RefreshCw,
  AlertCircle,
  KeyRound,
  FileText,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { resolveBrandName } from '@/lib/utils/equipment-display'
import { BatchUtilizationAlerts } from '@/components/inventory/batch/BatchUtilizationAlerts'
import { BatchUtilizationDashboard } from '@/components/inventory/batch/BatchUtilizationDashboard'

interface EquipmentBatchMetrics {
  total: number
  available: number
  assigned: number
  maintenance: number
  retired: number
  utilizationRate: number
}

interface EquipmentBatchItem {
  kind: 'EQUIPMENT'
  id: string
  batchCode: string
  description: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
  purchaseDate: string
  status: string
  metrics: EquipmentBatchMetrics
  model: { brand: string | { name?: string }; model: string; type?: { name: string } | null }
  supplier?: { name: string } | null
  department?: { name: string } | null
}

interface LicenseBatchMetrics {
  total: number
  available: number
  assigned: number
  utilizationRate: number
}

interface LicenseBatchItem {
  kind: 'LICENSE'
  id: string
  batchCode: string
  quantity: number
  unitCost: number
  totalCost: number
  purchaseDate: string
  metrics: LicenseBatchMetrics
  hasContractLink: boolean
  licenseType: { name: string }
  supplier?: { name: string } | null
  department?: { name: string } | null
}

type BatchItem = EquipmentBatchItem | LicenseBatchItem

interface BatchesTabProps {
  canCreate?: boolean
  /** En pestaña de inventario: el CTA principal vive en el header de la página */
  embedded?: boolean
}

export function BatchesTab({ canCreate = false, embedded = false }: BatchesTabProps) {
  const router = useRouter()
  const [batches, setBatches] = useState<BatchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [equipmentRes, licenseRes] = await Promise.all([
        fetch('/api/inventory/batches?limit=100'),
        fetch('/api/inventory/license-batches?limit=100'),
      ])
      if (!equipmentRes.ok) {
        const data = await equipmentRes.json().catch(() => ({}))
        throw new Error(data.error || 'Error al cargar lotes de equipos')
      }
      const equipmentData = await equipmentRes.json()
      const equipmentList: EquipmentBatchItem[] = (
        Array.isArray(equipmentData) ? equipmentData : (equipmentData.batches ?? [])
      ).map((b: Omit<EquipmentBatchItem, 'kind'>) => ({ ...b, kind: 'EQUIPMENT' as const }))

      // Sin acceso a licencias (rol restringido a familias sin licencias) no
      // debe tumbar la pestaña entera — se listan igual los lotes de equipos.
      let licenseList: LicenseBatchItem[] = []
      if (licenseRes.ok) {
        const licenseData = await licenseRes.json()
        licenseList = (licenseData.batches ?? []).map((b: Omit<LicenseBatchItem, 'kind'>) => ({
          ...b,
          kind: 'LICENSE' as const,
        }))
      }

      const merged = [...equipmentList, ...licenseList].sort(
        (a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()
      )
      setBatches(merged)
    } catch (err) {
      setBatches([])
      setError(err instanceof Error ? err.message : 'Error al cargar lotes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className='space-y-4'>
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className='h-32 w-full rounded-lg' />
        ))}
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between gap-3'>
        <p className='text-sm text-muted-foreground'>
          Lotes agrupan equipos o licencias de la misma compra o ingreso masivo.
        </p>
        <div className='flex items-center gap-2 shrink-0'>
          <Button variant='outline' size='sm' onClick={load} className='gap-1.5'>
            <RefreshCw className='h-3.5 w-3.5' />
            Recargar
          </Button>
          {batches.length > 0 && (
            <Button variant='outline' size='sm' asChild>
              {/* Vista completa con filtros/paginación — solo equipos por ahora */}
              <Link href='/inventory/batches'>Ver todos (equipos)</Link>
            </Button>
          )}
          {canCreate && !embedded && (
            <Button size='sm' asChild className='gap-1.5'>
              <Link href='/inventory/new?mode=bulk'>
                <Plus className='h-3.5 w-3.5' />
                Nuevo lote
              </Link>
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant='destructive'>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Resumen rápido */}
      {batches.length > 0 && (
        <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
          <div className='rounded-lg border bg-card p-3 text-center'>
            <p className='text-2xl font-bold'>{batches.length}</p>
            <p className='text-xs text-muted-foreground'>Lotes registrados</p>
          </div>
          <div className='rounded-lg border bg-card p-3 text-center'>
            <p className='text-2xl font-bold text-green-600'>
              {batches.reduce((s, b) => s + (b.metrics?.available ?? 0), 0)}
            </p>
            <p className='text-xs text-muted-foreground'>Disponibles</p>
          </div>
          <div className='rounded-lg border bg-card p-3 text-center'>
            <p className='text-2xl font-bold text-blue-600'>
              {batches.reduce((s, b) => s + (b.metrics?.assigned ?? 0), 0)}
            </p>
            <p className='text-xs text-muted-foreground'>Asignados</p>
          </div>
          <div className='rounded-lg border bg-card p-3 text-center'>
            <p className='text-2xl font-bold'>{batches.reduce((s, b) => s + b.quantity, 0)}</p>
            <p className='text-xs text-muted-foreground'>Total ingresados</p>
          </div>
        </div>
      )}

      <BatchUtilizationDashboard />

      {/* Lista de lotes — equipos y licencias mezclados, distinguidos por ícono/badge */}
      {batches.length === 0 ? (
        <div className='text-center py-16 text-muted-foreground'>
          <div className='space-y-3'>
            <Layers className='h-12 w-12 mx-auto opacity-30' />
            <p className='font-medium'>No hay lotes registrados</p>
            <p className='text-sm'>
              Un lote agrupa varias unidades idénticas de la misma compra — equipos o licencias.
              {canCreate && embedded && ' Usa el botón «Nuevo Lote» en la parte superior.'}
            </p>
          </div>
        </div>
      ) : (
        <div className='space-y-3'>
          {batches.map(batch => {
            const isLicense = batch.kind === 'LICENSE'
            const unitPrice = isLicense ? batch.unitCost : batch.unitPrice
            const totalPrice = isLicense ? batch.totalCost : batch.totalPrice
            const title = isLicense ? batch.licenseType.name : undefined
            const detailHref = isLicense
              ? `/inventory/batches/license/${batch.id}`
              : `/inventory/batches/${batch.id}`
            const metrics = isLicense
              ? { ...batch.metrics, maintenance: 0, retired: 0 }
              : batch.metrics

            return (
              <Card
                key={`${batch.kind}-${batch.id}`}
                className='cursor-pointer hover:shadow-md transition-all hover:border-primary/30'
                onClick={() => router.push(detailHref)}
              >
                <CardContent className='p-5'>
                  <div className='flex items-start justify-between gap-4'>
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-2 flex-wrap mb-1'>
                        {isLicense ? (
                          <KeyRound className='h-4 w-4 text-primary shrink-0' />
                        ) : (
                          <Package className='h-4 w-4 text-primary shrink-0' />
                        )}
                        <span className='font-semibold font-mono'>{batch.batchCode}</span>
                        <Badge variant='secondary' className='text-xs'>
                          {batch.quantity} {isLicense ? 'licencias' : 'unidades'}
                        </Badge>
                        {!isLicense && batch.model.type?.name && (
                          <Badge variant='outline' className='text-xs'>
                            {batch.model.type.name}
                          </Badge>
                        )}
                        {isLicense && batch.hasContractLink && (
                          <Badge variant='outline' className='text-xs gap-1'>
                            <FileText className='h-3 w-3' />
                            Con contrato
                          </Badge>
                        )}
                      </div>

                      <p className='text-sm font-medium text-foreground mb-1'>
                        {isLicense
                          ? title
                          : `${resolveBrandName(batch.model.brand)} ${batch.model.model}`}
                      </p>

                      <div className='flex items-center gap-4 text-xs text-muted-foreground flex-wrap'>
                        {batch.supplier?.name && <span>{batch.supplier.name}</span>}
                        {batch.department?.name && <span>· {batch.department.name}</span>}
                        <span className='flex items-center gap-1'>
                          <Calendar className='h-3 w-3' />
                          {format(new Date(batch.purchaseDate), 'dd MMM yyyy', { locale: es })}
                        </span>
                        {unitPrice > 0 && (
                          <span className='flex items-center gap-1'>
                            <DollarSign className='h-3 w-3' />${unitPrice.toFixed(2)} c/u
                            {batch.quantity > 1 && (
                              <span className='text-muted-foreground/70'>
                                · Total ${totalPrice.toFixed(2)}
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className='shrink-0 flex items-center gap-3 text-xs'>
                      <div className='flex items-center gap-1 text-green-600' title='Disponibles'>
                        <CheckCircle className='h-3.5 w-3.5' />
                        <span className='font-semibold'>{batch.metrics?.available ?? 0}</span>
                      </div>
                      <div className='flex items-center gap-1 text-blue-600' title='Asignados'>
                        <UserCheck className='h-3.5 w-3.5' />
                        <span className='font-semibold'>{batch.metrics?.assigned ?? 0}</span>
                      </div>
                      {!isLicense && batch.metrics.maintenance > 0 && (
                        <div
                          className='flex items-center gap-1 text-yellow-600'
                          title='Mantenimiento'
                        >
                          <Wrench className='h-3.5 w-3.5' />
                          <span className='font-semibold'>{batch.metrics.maintenance}</span>
                        </div>
                      )}
                      {!isLicense && batch.metrics.retired > 0 && (
                        <div
                          className='flex items-center gap-1 text-muted-foreground'
                          title='Retirados'
                        >
                          <Archive className='h-3.5 w-3.5' />
                          <span className='font-semibold'>{batch.metrics.retired}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {isLicense && batch.hasContractLink && (
                    <p className='mt-2 text-xs text-muted-foreground'>
                      Renovación gestionada por el contrato vinculado — no aplica «Renovar lote».
                    </p>
                  )}

                  {metrics.total > 0 && (
                    <div className='mt-3 space-y-3'>
                      <div>
                        <div className='flex justify-between text-xs text-muted-foreground mb-1'>
                          <span>Utilización</span>
                          <span>{metrics.utilizationRate.toFixed(0)}%</span>
                        </div>
                        <div className='h-1.5 bg-muted rounded-full overflow-hidden'>
                          <div
                            className={`h-full rounded-full transition-all ${
                              metrics.utilizationRate > 90
                                ? 'bg-red-500'
                                : metrics.utilizationRate > 70
                                  ? 'bg-yellow-500'
                                  : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(metrics.utilizationRate, 100)}%` }}
                          />
                        </div>
                      </div>
                      <BatchUtilizationAlerts metrics={metrics} />
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
