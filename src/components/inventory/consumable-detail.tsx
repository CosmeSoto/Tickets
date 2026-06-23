'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TransferFamilyDialog } from './transfer-family-dialog'
import { useToast } from '@/hooks/use-toast'

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
  customValues?: Array<{ fieldName: string; fieldValue: string }> | null
  consumableType?: {
    id: string
    name: string
    familyId?: string | null
    family?: { id: string; name: string } | null
  } | null
  unitOfMeasure?: { name: string; symbol?: string | null } | null
  supplier?: { id: string; name: string } | null
  movements?: StockMovement[]
}

interface Props {
  consumableId: string
  userRole: string
  userId: string
  isSuperAdmin?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function fmtCurrency(n: number | null | undefined) {
  if (n == null) return '—'
  return `$${new Intl.NumberFormat('es-CL').format(n)}`
}

const MOVEMENT_LABELS: Record<string, string> = {
  ENTRY: 'Entrada',
  EXIT: 'Salida',
  ADJUSTMENT: 'Ajuste',
  RETURN: 'Devolución',
  TRANSFER: 'Transferencia',
}

const MOVEMENT_COLORS: Record<string, string> = {
  ENTRY: 'text-green-600',
  EXIT: 'text-red-600',
  ADJUSTMENT: 'text-blue-600',
  RETURN: 'text-amber-600',
  TRANSFER: 'text-purple-600',
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className='flex flex-col gap-0.5'>
      <p className='text-xs text-muted-foreground uppercase tracking-wide font-medium'>{label}</p>
      <p className='text-sm text-foreground'>{value ?? '—'}</p>
    </div>
  )
}

// ─── Stock gauge ──────────────────────────────────────────────────────────────

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
  const barColor = isCritical ? 'bg-red-500' : pct > 60 ? 'bg-green-500' : 'bg-amber-500'

  return (
    <div className='space-y-2'>
      <div className='flex items-end justify-between'>
        <div>
          <p className='text-2xl font-bold tabular-nums'>
            {current}
            <span className='text-sm font-normal text-muted-foreground ml-1'>{unit}</span>
          </p>
          {isCritical && (
            <p className='text-xs text-red-600 flex items-center gap-1 mt-0.5'>
              <AlertTriangle className='h-3 w-3' />
              Bajo el mínimo
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
        <span>Mín: {min} {unit}</span>
        <span>Máx: {max} {unit}</span>
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ConsumableDetail({ consumableId, userRole, isSuperAdmin = false }: Props) {
  const router = useRouter()
  const { toast } = useToast()

  const [consumable, setConsumable] = useState<ConsumableData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showTransferDialog, setShowTransferDialog] = useState(false)

  const isAdmin = userRole === 'ADMIN' || isSuperAdmin

  const loadConsumable = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/inventory/consumables/${consumableId}`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? 'No se pudo cargar el consumible')
      }
      setConsumable(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [consumableId])

  // Cargar al montar
  useEffect(() => { loadConsumable() }, [loadConsumable])

  // ── Loading / error ────────────────────────────────────────────────────────
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
        <p className='text-sm text-muted-foreground'>{error ?? 'Consumible no encontrado'}</p>
        <Button variant='outline' size='sm' onClick={loadConsumable}>
          <RefreshCw className='h-3.5 w-3.5 mr-1.5' />
          Reintentar
        </Button>
      </div>
    )
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!confirm(`¿Eliminar "${consumable.name}"? Esta acción no se puede deshacer.`)) return
    try {
      const res = await fetch(`/api/inventory/consumables/${consumableId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error al eliminar')
      toast({ title: 'Consumible eliminado' })
      router.push('/inventory')
    } catch (err) {
      toast({
        title: 'Error al eliminar',
        description: err instanceof Error ? err.message : 'Error desconocido',
        variant: 'destructive',
      })
    }
  }

  const unit = consumable.unitOfMeasure?.symbol ?? consumable.unitOfMeasure?.name ?? 'u'
  const currentFamilyId = consumable.consumableType?.familyId ?? null
  const currentFamilyName = consumable.consumableType?.family?.name ?? null

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className='space-y-6 max-w-4xl mx-auto'>

      {/* Header */}
      <div className='flex items-start justify-between gap-4'>
        <div className='flex items-start gap-3'>
          <Button variant='ghost' size='icon' onClick={() => router.back()} className='shrink-0 mt-0.5'>
            <ArrowLeft className='h-4 w-4' />
          </Button>
          <div>
            <h1 className='text-xl font-semibold flex items-center gap-2'>
              <Package className='h-5 w-5 text-muted-foreground' />
              {consumable.name}
            </h1>
            <div className='flex items-center gap-2 mt-1 flex-wrap'>
              {consumable.consumableType && (
                <Badge variant='secondary' className='text-xs'>
                  {consumable.consumableType.name}
                </Badge>
              )}
              {currentFamilyName && (
                <Badge variant='outline' className='text-xs'>
                  {currentFamilyName}
                </Badge>
              )}
              <Badge
                variant='outline'
                className={`text-xs ${
                  consumable.status === 'ACTIVE'
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-gray-200 text-gray-500'
                }`}
              >
                {consumable.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Acciones admin */}
        {isAdmin && (
          <div className='flex items-center gap-2 shrink-0'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => router.push(`/inventory/mro/${consumableId}/edit`)}
            >
              <Pencil className='h-3.5 w-3.5 mr-1.5' />
              Editar
            </Button>
            <Button
              variant='outline'
              size='sm'
              onClick={() => setShowTransferDialog(true)}
              className='gap-1.5'
            >
              <ArrowRightLeft className='h-3.5 w-3.5' />
              Transferir área
            </Button>
            <Button
              variant='outline'
              size='sm'
              onClick={handleDelete}
              className='text-destructive hover:text-destructive'
            >
              <Trash2 className='h-3.5 w-3.5' />
            </Button>
          </div>
        )}
      </div>

      {/* Stock gauge — card destacado */}
      <div className='rounded-lg border border-border p-5'>
        <h3 className='text-sm font-semibold flex items-center gap-2 mb-4'>
          <BarChart3 className='h-4 w-4 text-muted-foreground' />
          Stock actual
        </h3>
        <StockGauge
          current={consumable.currentStock}
          min={consumable.minStock}
          max={consumable.maxStock}
          unit={unit}
        />
      </div>

      {/* Cards de información */}
      <div className='grid gap-4 md:grid-cols-2'>

        {/* Datos generales */}
        <div className='rounded-lg border border-border p-4 space-y-4'>
          <h3 className='text-sm font-semibold'>Información general</h3>
          <div className='grid grid-cols-2 gap-4'>
            <InfoRow label='Proveedor' value={consumable.supplier?.name} />
            <InfoRow label='Ubicación' value={consumable.location} />
            <InfoRow label='Costo por unidad' value={fmtCurrency(consumable.costPerUnit)} />
            <InfoRow label='Valor total stock' value={fmtCurrency(consumable.totalStockValue)} />
          </div>
          {consumable.notes && (
            <div className='pt-1 border-t border-border'>
              <p className='text-xs text-muted-foreground mb-1 uppercase tracking-wide'>Notas</p>
              <p className='text-sm'>{consumable.notes}</p>
            </div>
          )}
        </div>

        {/* Área */}
        <div className='rounded-lg border border-border p-4 space-y-4'>
          <h3 className='text-sm font-semibold'>Área / Familia</h3>
          <div className='grid grid-cols-2 gap-4'>
            <InfoRow label='Tipo de consumible' value={consumable.consumableType?.name} />
            <InfoRow label='Área' value={currentFamilyName ?? '—'} />
            <InfoRow label='Unidad de medida' value={consumable.unitOfMeasure?.name} />
          </div>
        </div>
      </div>

      {/* Atributos personalizados */}
      {consumable.customValues && consumable.customValues.length > 0 && (
        <div className='rounded-lg border border-border p-4'>
          <h3 className='text-sm font-semibold mb-3'>Atributos personalizados</h3>
          <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
            {consumable.customValues.map(v => (
              <InfoRow key={v.fieldName} label={v.fieldName} value={v.fieldValue} />
            ))}
          </div>
        </div>
      )}

      {/* Historial de movimientos */}
      {consumable.movements && consumable.movements.length > 0 && (
        <div className='rounded-lg border border-border p-4'>
          <h3 className='text-sm font-semibold flex items-center gap-2 mb-3'>
            <ArrowRight className='h-4 w-4 text-muted-foreground' />
            Últimos movimientos
          </h3>
          <div className='space-y-2'>
            {consumable.movements.slice(0, 10).map(m => (
              <div
                key={m.id}
                className='flex items-center justify-between text-sm py-2 border-b border-border last:border-0'
              >
                <div className='flex items-center gap-3'>
                  {m.type === 'ENTRY' || m.type === 'RETURN' ? (
                    <TrendingUp className={`h-4 w-4 shrink-0 ${MOVEMENT_COLORS[m.type]}`} />
                  ) : (
                    <TrendingDown className={`h-4 w-4 shrink-0 ${MOVEMENT_COLORS[m.type] ?? 'text-muted-foreground'}`} />
                  )}
                  <div>
                    <p className='font-medium'>
                      {MOVEMENT_LABELS[m.type] ?? m.type}
                      <span className={`ml-2 font-semibold tabular-nums ${MOVEMENT_COLORS[m.type]}`}>
                        {m.type === 'EXIT' ? '-' : '+'}{m.quantity} {unit}
                      </span>
                    </p>
                    {m.reason && (
                      <p className='text-xs text-muted-foreground'>{m.reason}</p>
                    )}
                  </div>
                </div>
                <div className='text-right text-xs text-muted-foreground'>
                  <p>{fmtDate(m.createdAt)}</p>
                  <p>{m.user?.name ?? m.user?.email ?? '—'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TransferFamilyDialog */}
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
