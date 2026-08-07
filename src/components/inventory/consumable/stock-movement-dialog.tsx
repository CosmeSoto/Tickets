'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DateInput } from '@/components/ui/date-input'
import { SimpleSelect } from '@/components/ui/simple-select'
import { Loader2 } from 'lucide-react'

type MovementKind = 'ENTRY' | 'EXIT' | 'ADJUSTMENT'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  consumableId: string
  consumableName: string
  currentStock: number
  unit: string
  defaultType?: MovementKind
  onSaved: () => void
}

const TYPE_OPTIONS = [
  { value: 'ENTRY', label: 'Entrada (compra / ingreso)' },
  { value: 'EXIT', label: 'Salida (consumo / uso)' },
  { value: 'ADJUSTMENT', label: 'Ajuste (dejar stock en…)' },
]

const EXIT_REASON_PRESETS = [
  'Consumo diario personal',
  'Consumo semanal',
  'Evento / reunión',
  'Otro uso',
]

function todayYmd() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function daysAgoYmd(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function StockMovementDialog({
  open,
  onOpenChange,
  consumableId,
  consumableName,
  currentStock,
  unit,
  defaultType = 'EXIT',
  onSaved,
}: Props) {
  const [type, setType] = useState<MovementKind>(defaultType)
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [occurredAt, setOccurredAt] = useState(todayYmd())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setType(defaultType)
    setQuantity('')
    setReason(defaultType === 'EXIT' ? 'Consumo diario personal' : '')
    setOccurredAt(todayYmd())
    setError(null)
  }, [open, defaultType])

  const qty = Number(quantity)
  const previewStock =
    type === 'ENTRY'
      ? currentStock + (Number.isFinite(qty) ? qty : 0)
      : type === 'EXIT'
        ? currentStock - (Number.isFinite(qty) ? qty : 0)
        : Number.isFinite(qty)
          ? qty
          : currentStock

  const handleSubmit = async () => {
    setError(null)
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Ingresa una cantidad mayor a 0.')
      return
    }
    if (type === 'EXIT' && qty > currentStock) {
      setError(`Stock insuficiente (disponible: ${currentStock} ${unit}).`)
      return
    }
    if (!occurredAt) {
      setError('Selecciona la fecha del movimiento.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/consumables/${consumableId}/movements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          quantity: qty,
          reason: reason.trim() || undefined,
          occurredAt,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'No se pudo registrar el movimiento')
      onSaved()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{type === 'EXIT' ? 'Registrar consumo' : 'Movimiento de stock'}</DialogTitle>
          <DialogDescription>
            {consumableName} · Actual: {currentStock} {unit}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-1'>
          <div className='space-y-2'>
            <Label>Tipo</Label>
            <SimpleSelect
              value={type}
              onChange={e => setType(e.target.value as MovementKind)}
              options={TYPE_OPTIONS}
            />
          </div>

          <div className='space-y-2'>
            <Label>Fecha</Label>
            <DateInput
              value={occurredAt}
              onChange={e => setOccurredAt(e.target.value)}
              max={todayYmd()}
              min={daysAgoYmd(90)}
            />
            <p className='text-xs text-muted-foreground'>
              Puedes registrar un consumo de días anteriores (hasta 90 días) si se olvidó anotar.
            </p>
          </div>

          <div className='space-y-2'>
            <Label>{type === 'ADJUSTMENT' ? 'Nuevo stock' : 'Cantidad'}</Label>
            <Input
              type='number'
              min={0}
              step='any'
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder={
                type === 'ADJUSTMENT'
                  ? `Ej. ${currentStock}`
                  : type === 'EXIT'
                    ? 'Ej. 1 (botellón del día)'
                    : 'Ej. 10'
              }
            />
            <p className='text-xs text-muted-foreground'>
              Quedará en{' '}
              <span className='font-medium tabular-nums'>
                {Number.isFinite(previewStock) ? previewStock : '—'} {unit}
              </span>
            </p>
          </div>

          <div className='space-y-2'>
            <Label>Motivo {type === 'EXIT' ? '' : '(opcional)'}</Label>
            {type === 'EXIT' && (
              <div className='flex flex-wrap gap-1.5'>
                {EXIT_REASON_PRESETS.map(preset => (
                  <button
                    key={preset}
                    type='button'
                    onClick={() => setReason(preset)}
                    className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                      reason === preset
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            )}
            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              placeholder={
                type === 'EXIT'
                  ? 'Ej. Consumo diario personal administración…'
                  : 'Ej. Compra proveedor…'
              }
              maxLength={500}
            />
          </div>

          {error && <p className='text-sm text-destructive'>{error}</p>}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting && <Loader2 className='h-4 w-4 mr-1.5 animate-spin' />}
            {type === 'EXIT' ? 'Registrar consumo' : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
