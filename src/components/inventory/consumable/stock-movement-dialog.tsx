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
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setType(defaultType)
    setQuantity('')
    setReason('')
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

    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/consumables/${consumableId}/movements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          quantity: qty,
          reason: reason.trim() || undefined,
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
          <DialogTitle>Movimiento de stock</DialogTitle>
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
            <Label>{type === 'ADJUSTMENT' ? 'Nuevo stock' : 'Cantidad'}</Label>
            <Input
              type='number'
              min={0}
              step='any'
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder={type === 'ADJUSTMENT' ? `Ej. ${currentStock}` : 'Ej. 5'}
            />
            <p className='text-xs text-muted-foreground'>
              Quedará en{' '}
              <span className='font-medium tabular-nums'>
                {Number.isFinite(previewStock) ? previewStock : '—'} {unit}
              </span>
            </p>
          </div>

          <div className='space-y-2'>
            <Label>Motivo (opcional)</Label>
            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              placeholder='Ej. Uso en mantenimiento, compra proveedor…'
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
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
