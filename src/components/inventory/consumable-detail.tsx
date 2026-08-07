'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  ArrowLeft,
  Package,
  BarChart3,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ArrowRightLeft,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  MoreHorizontal,
  Building2,
  StickyNote,
  Tag,
  Warehouse,
  ArrowDownUp,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TransferFamilyDialog } from './transfer-family-dialog'
import { StockMovementDialog } from './consumable/stock-movement-dialog'
import { inventoryToast as toast } from '@/lib/utils/inventory-toast'
import { CONSUMABLE_STATUS_ES } from '@/lib/inventory/report-format'
import { getInventoryAssetPath } from '@/lib/utils/inventory-utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StockMovement {
  id: string
  type: string
  quantity: number
  reason?: string | null
  createdAt: string
  user?: { name?: string | null; email: string } | null
  assignedToUser?: { name?: string | null; email: string } | null
  assignedToEquipment?: { code: string; brand: string } | null
}

interface ConsumableData {
  id: string
  name: string
  currentStock: number
  minStock: number
  maxStock: number
  costPerUnit?: number | null
  totalStockValue?: number | null
  location?: string | null
  notes?: string | null
  status: string
  expirationDate?: string | null
  customValues?: Array<{ fieldName: string; fieldValue: string }> | null
  consumableType?: {
    id: string
    name: string
    familyId?: string | null
    family?: { id: string; name: string } | null
  } | null
  unitOfMeasure?: { name: string; symbol?: string | null } | null
  supplier?: { id: string; name: string } | null
  warehouse?: { id: string; name: string } | null
  assignedEquipment?: {
    id: string
    code: string
    brand: string
    model?: string | null
  } | null
  movements?: StockMovement[]
}

interface Props {
  consumableId: string
  userRole: string
  userId: string
  isSuperAdmin?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function fmtCurrency(n: number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(n)
}

const MOVEMENT_LABELS: Record<string, string> = {
  ENTRY: 'Entrada',
  EXIT: 'Salida',
  ADJUSTMENT: 'Ajuste',
}

const MOVEMENT_COLORS: Record<string, string> = {
  ENTRY: 'text-emerald-600 dark:text-emerald-400',
  EXIT: 'text-red-600 dark:text-red-400',
  ADJUSTMENT: 'text-blue-600 dark:text-blue-400',
}

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  LOW_STOCK: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  OUT_OF_STOCK: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
  EXPIRED: 'bg-muted text-muted-foreground border-border',
  RETIRED: 'bg-muted text-muted-foreground border-border',
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className='text-xs text-muted-foreground'>{label}</p>
      <div className='mt-0.5 text-sm font-medium'>{value ?? '—'}</div>
    </div>
  )
}

function StockGauge({
  current,
  min,
  max,
  unit,
}: {
  current: number
  min: number
  max: number
  unit: string
}) {
  const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0
  const isCritical = current <= min
  const barColor = isCritical ? 'bg-red-500' : pct > 60 ? 'bg-emerald-500' : 'bg-amber-500'

  return (
    <div className='space-y-2'>
      <div className='flex items-end justify-between'>
        <div>
          <p className='text-2xl font-bold tabular-nums'>
            {current}
            <span className='text-sm font-normal text-muted-foreground ml-1'>{unit}</span>
          </p>
          {isCritical && (
            <p className='text-xs text-red-600 dark:text-red-400 flex items-center gap-1 mt-0.5'>
              <AlertTriangle className='h-3 w-3' />
              Bajo el mínimo ({min} {unit})
            </p>
          )}
        </div>
        <p className='text-sm text-muted-foreground'>{pct}% del máximo</p>
      </div>
      <div className='h-2 rounded-full bg-muted overflow-hidden'>
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className='flex justify-between text-xs text-muted-foreground'>
        <span>
          Mín: {min} {unit}
        </span>
        <span>
          Máx: {max} {unit}
        </span>
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ConsumableDetail({ consumableId, userRole, isSuperAdmin = false }: Props) {
  const router = useRouter()
  const { data: session } = useSession()

  const [consumable, setConsumable] = useState<ConsumableData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showTransferDialog, setShowTransferDialog] = useState(false)
  const [showMovementDialog, setShowMovementDialog] = useState(false)
  const [movementDefault, setMovementDefault] = useState<'ENTRY' | 'EXIT' | 'ADJUSTMENT'>('EXIT')

  const canManageInventory =
    (session?.user as { canManageInventory?: boolean })?.canManageInventory === true
  const isAdmin = userRole === 'ADMIN' || isSuperAdmin
  const canEdit = isAdmin || userRole === 'TECHNICIAN' || canManageInventory
  const canDelete = isAdmin || canManageInventory
  const canTransfer = isAdmin
  const hasSecondaryActions = canEdit || canTransfer || canDelete

  const loadConsumable = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/inventory/consumables/${consumableId}`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'No se pudo cargar el suministro')
      }
      setConsumable(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [consumableId])

  useEffect(() => {
    void loadConsumable()
  }, [loadConsumable])

  if (loading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  if (error || !consumable) {
    return (
      <div className='flex flex-col items-center justify-center h-64 gap-3 text-center'>
        <AlertTriangle className='h-8 w-8 text-destructive' />
        <p className='text-sm text-muted-foreground'>{error ?? 'Suministro no encontrado'}</p>
        <Button variant='outline' size='sm' onClick={() => void loadConsumable()}>
          <RefreshCw className='h-3.5 w-3.5 mr-1.5' />
          Reintentar
        </Button>
      </div>
    )
  }

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar el suministro «${consumable.name}»? Esta acción no se puede deshacer.`))
      return
    try {
      const res = await fetch(`/api/inventory/consumables/${consumableId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error al eliminar')
      toast({ title: 'Suministro eliminado' })
      router.push('/inventory')
    } catch (err) {
      toast({
        title: 'Error al eliminar',
        description: err instanceof Error ? err.message : 'Error desconocido',
        variant: 'destructive',
      })
    }
  }

  const openMovement = (type: 'ENTRY' | 'EXIT' | 'ADJUSTMENT') => {
    setMovementDefault(type)
    setShowMovementDialog(true)
  }

  const unit = consumable.unitOfMeasure?.symbol ?? consumable.unitOfMeasure?.name ?? 'u'
  const currentFamilyId = consumable.consumableType?.familyId ?? null
  const currentFamilyName = consumable.consumableType?.family?.name ?? null
  const statusLabel = CONSUMABLE_STATUS_ES[consumable.status] ?? consumable.status
  const statusClass = STATUS_BADGE[consumable.status] ?? 'border-border'
  const isLow =
    consumable.status === 'LOW_STOCK' ||
    consumable.status === 'OUT_OF_STOCK' ||
    consumable.currentStock <= consumable.minStock
  const isExpired = consumable.status === 'EXPIRED'

  return (
    <div className='space-y-6'>
      <button
        type='button'
        onClick={() => router.push('/inventory')}
        className='flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors'
      >
        <ArrowLeft className='h-4 w-4' />
        Regresar a Inventario
      </button>

      {/* Header — mismo patrón que equipo / licencia */}
      <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div className='flex items-center gap-3 min-w-0'>
          <Package className='h-6 w-6 shrink-0 text-muted-foreground' />
          <div className='min-w-0'>
            <h1 className='text-lg font-bold truncate'>{consumable.name}</h1>
            <p className='text-xs text-muted-foreground truncate'>
              {[consumable.consumableType?.name, currentFamilyName].filter(Boolean).join(' · ') ||
                'Suministro'}
            </p>
            <div className='flex flex-wrap items-center gap-1.5 mt-1.5'>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${statusClass}`}
              >
                {statusLabel}
              </span>
              {unit && (
                <Badge variant='outline' className='text-xs'>
                  {unit}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className='flex items-center gap-2 shrink-0'>
          {canEdit && (
            <Button size='sm' onClick={() => openMovement('EXIT')} disabled={isExpired}>
              <ArrowDownUp className='h-4 w-4 mr-1.5' />
              Movimiento
            </Button>
          )}
          {hasSecondaryActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size='sm' variant='outline'>
                  <MoreHorizontal className='h-4 w-4' />
                  <span className='sr-only'>Más acciones</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-52'>
                {canEdit && (
                  <>
                    <DropdownMenuItem onClick={() => openMovement('ENTRY')}>
                      <TrendingUp className='h-4 w-4 mr-2' />
                      Entrada de stock
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openMovement('EXIT')} disabled={isExpired}>
                      <TrendingDown className='h-4 w-4 mr-2' />
                      Salida / consumo
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openMovement('ADJUSTMENT')}>
                      <BarChart3 className='h-4 w-4 mr-2' />
                      Ajustar stock
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() =>
                        router.push(getInventoryAssetPath('MRO', consumableId, 'edit'))
                      }
                    >
                      <Pencil className='h-4 w-4 mr-2' />
                      Editar
                    </DropdownMenuItem>
                  </>
                )}
                {canTransfer && (
                  <DropdownMenuItem onClick={() => setShowTransferDialog(true)}>
                    <ArrowRightLeft className='h-4 w-4 mr-2' />
                    Transferir área
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => void handleDelete()}
                      className='text-destructive focus:text-destructive'
                    >
                      <Trash2 className='h-4 w-4 mr-2' />
                      Eliminar
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {(isLow || isExpired) && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm flex items-start gap-2 ${
            isExpired
              ? 'bg-muted text-muted-foreground border-border'
              : 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30'
          }`}
        >
          <AlertTriangle className='h-4 w-4 shrink-0 mt-0.5' />
          <div>
            <p className='font-medium'>
              {isExpired
                ? 'Material caducado'
                : consumable.status === 'OUT_OF_STOCK'
                  ? 'Sin stock'
                  : 'Stock bajo el mínimo'}
            </p>
            <p className='text-xs opacity-90 mt-0.5'>
              {isExpired
                ? 'No se pueden registrar salidas hasta revisar o dar de baja el lote.'
                : `Actual ${consumable.currentStock} ${unit} · mínimo ${consumable.minStock} ${unit}. Usa «Entrada de stock» para reponer.`}
            </p>
          </div>
        </div>
      )}

      <div className='grid gap-6 lg:grid-cols-3'>
        <div className='lg:col-span-2 space-y-6'>
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='flex items-center gap-2 text-base'>
                <BarChart3 className='h-4 w-4' />
                Stock actual
              </CardTitle>
            </CardHeader>
            <CardContent>
              <StockGauge
                current={consumable.currentStock}
                min={consumable.minStock}
                max={consumable.maxStock}
                unit={unit}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='flex items-center gap-2 text-base'>
                <FileText className='h-4 w-4' />
                Información del suministro
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-5'>
              <div className='grid grid-cols-2 gap-x-6 gap-y-3'>
                <InfoRow label='Tipo' value={consumable.consumableType?.name || '—'} />
                <InfoRow label='Área / Familia' value={currentFamilyName || '—'} />
                <InfoRow label='Unidad de medida' value={consumable.unitOfMeasure?.name || '—'} />
                <InfoRow label='Proveedor' value={consumable.supplier?.name || '—'} />
                <InfoRow
                  label='Bodega'
                  value={
                    consumable.warehouse?.name ? (
                      <span className='inline-flex items-center gap-1'>
                        <Warehouse className='h-3.5 w-3.5 text-muted-foreground' />
                        {consumable.warehouse.name}
                      </span>
                    ) : (
                      '—'
                    )
                  }
                />
                <InfoRow label='Ubicación' value={consumable.location || '—'} />
                <InfoRow label='Costo por unidad' value={fmtCurrency(consumable.costPerUnit)} />
                <InfoRow
                  label='Valor total stock'
                  value={fmtCurrency(consumable.totalStockValue)}
                />
                <InfoRow label='Caducidad' value={fmtDate(consumable.expirationDate)} />
                {consumable.assignedEquipment && (
                  <InfoRow
                    label='Equipo vinculado'
                    value={`${consumable.assignedEquipment.brand || 'Equipo'} (${consumable.assignedEquipment.code})`}
                  />
                )}
              </div>

              {consumable.customValues && consumable.customValues.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className='text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-3'>
                      <Tag className='h-3.5 w-3.5' />
                      Atributos del tipo
                    </p>
                    <div className='grid grid-cols-2 gap-x-6 gap-y-3'>
                      {consumable.customValues.map(v => (
                        <InfoRow key={v.fieldName} label={v.fieldName} value={v.fieldValue} />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {consumable.notes && (
                <>
                  <Separator />
                  <div>
                    <p className='text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-2'>
                      <StickyNote className='h-3.5 w-3.5' />
                      Observaciones
                    </p>
                    <p className='text-sm whitespace-pre-wrap'>{consumable.notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='pb-2'>
              <div className='flex items-center justify-between gap-2'>
                <CardTitle className='text-base flex items-center gap-2'>
                  <ArrowDownUp className='h-4 w-4' />
                  Últimos movimientos
                </CardTitle>
                {canEdit && (
                  <Button variant='ghost' size='sm' onClick={() => openMovement('EXIT')}>
                    Registrar
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!consumable.movements?.length ? (
                <p className='text-sm text-muted-foreground'>
                  Sin movimientos aún. Usa «Movimiento» para registrar entradas o salidas.
                </p>
              ) : (
                <div className='space-y-0'>
                  {consumable.movements.slice(0, 12).map(m => (
                    <div
                      key={m.id}
                      className='flex items-center justify-between text-sm py-2.5 border-b border-border last:border-0'
                    >
                      <div className='flex items-center gap-3 min-w-0'>
                        {m.type === 'ENTRY' ? (
                          <TrendingUp className={`h-4 w-4 shrink-0 ${MOVEMENT_COLORS[m.type]}`} />
                        ) : (
                          <TrendingDown
                            className={`h-4 w-4 shrink-0 ${MOVEMENT_COLORS[m.type] ?? 'text-muted-foreground'}`}
                          />
                        )}
                        <div className='min-w-0'>
                          <p className='font-medium'>
                            {MOVEMENT_LABELS[m.type] ?? m.type}
                            <span
                              className={`ml-2 font-semibold tabular-nums ${MOVEMENT_COLORS[m.type] ?? ''}`}
                            >
                              {m.type === 'EXIT' ? '−' : m.type === 'ADJUSTMENT' ? '→' : '+'}
                              {m.quantity} {unit}
                            </span>
                          </p>
                          {m.reason && (
                            <p className='text-xs text-muted-foreground truncate'>{m.reason}</p>
                          )}
                        </div>
                      </div>
                      <div className='text-right text-xs text-muted-foreground shrink-0 ml-3'>
                        <p>{fmtDate(m.createdAt)}</p>
                        <p className='truncate max-w-[140px]'>
                          {m.user?.name ?? m.user?.email ?? '—'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className='space-y-6'>
          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-base flex items-center gap-2'>
                <Building2 className='h-4 w-4' />
                Área
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <InfoRow label='Familia' value={currentFamilyName || '—'} />
              <InfoRow label='Tipo' value={consumable.consumableType?.name || '—'} />
              <p className='text-xs text-muted-foreground'>
                El área la define el tipo de suministro. Para cambiarla usa «Transferir área».
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='pb-2'>
              <CardTitle className='text-base'>Resumen de stock</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <InfoRow
                label='Disponible'
                value={
                  <span className='tabular-nums'>
                    {consumable.currentStock} {unit}
                  </span>
                }
              />
              <InfoRow
                label='Mínimo / Máximo'
                value={
                  <span className='tabular-nums'>
                    {consumable.minStock} / {consumable.maxStock} {unit}
                  </span>
                }
              />
              <InfoRow
                label='Valor en inventario'
                value={fmtCurrency(consumable.totalStockValue)}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <StockMovementDialog
        open={showMovementDialog}
        onOpenChange={setShowMovementDialog}
        consumableId={consumableId}
        consumableName={consumable.name}
        currentStock={consumable.currentStock}
        unit={unit}
        defaultType={movementDefault}
        onSaved={() => {
          toast({ title: 'Movimiento registrado' })
          void loadConsumable()
        }}
      />

      <TransferFamilyDialog
        open={showTransferDialog}
        onOpenChange={setShowTransferDialog}
        assetId={consumableId}
        assetKind='MRO'
        assetLabel={consumable.name}
        currentFamilyId={currentFamilyId}
        currentFamilyName={currentFamilyName}
        onSuccess={loadConsumable}
      />
    </div>
  )
}
