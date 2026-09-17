'use client'

/**
 * RenewLicenseBatchDialog — "Renovar lote completo" desde la ficha de
 * cualquier licencia que pertenezca a un lote. Actualiza la fecha/costo/
 * frecuencia de renovación del lote y las propaga a todas sus licencias
 * hijas cuyo batchRenewalLinked siga en true (ver license-batches.service.ts).
 * Mismo patrón de diálogo liviano que LicenseReturnDialog — sin pantalla aparte.
 */

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { SimpleSelect } from '@/components/ui/simple-select'
import { Loader2, RefreshCw } from 'lucide-react'
import { LICENSE_RENEWAL_FREQUENCY_OPTIONS } from '@/lib/inventory/license-labels'
import { toLocalDateInputValue } from '@/lib/forms/form-date'

type RenewLicenseBatchDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  batchId: string
  batchCode: string
  linkedCount: number
  currentRenewalDate?: string | null
  currentRenewalCost?: number | null
  currentRenewalFrequency?: string | null
  currentCustomFrequencyMonths?: number | null
  onRenewed: () => void
}

export function RenewLicenseBatchDialog({
  open,
  onOpenChange,
  batchId,
  batchCode,
  linkedCount,
  currentRenewalDate,
  currentRenewalCost,
  currentRenewalFrequency,
  currentCustomFrequencyMonths,
  onRenewed,
}: RenewLicenseBatchDialogProps) {
  const [renewalDate, setRenewalDate] = useState(toLocalDateInputValue(currentRenewalDate))
  const [renewalCost, setRenewalCost] = useState(
    currentRenewalCost != null ? String(currentRenewalCost) : ''
  )
  const [renewalFrequency, setRenewalFrequency] = useState(currentRenewalFrequency ?? '')
  const [customFrequencyMonths, setCustomFrequencyMonths] = useState(
    currentCustomFrequencyMonths != null ? String(currentCustomFrequencyMonths) : ''
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/inventory/license-batches/${batchId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          renewalDate: renewalDate || null,
          renewalCost: renewalCost ? parseFloat(renewalCost) : null,
          renewalFrequency: renewalFrequency || null,
          customFrequencyMonths:
            renewalFrequency === 'CUSTOM' && customFrequencyMonths
              ? parseInt(customFrequencyMonths, 10)
              : null,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'No se pudo renovar el lote')
      }
      onRenewed()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Renovar lote completo</DialogTitle>
          <DialogDescription>
            Se actualizarán las <span className='font-medium text-foreground'>{linkedCount}</span>{' '}
            licencias del lote <span className='font-medium text-foreground'>{batchCode}</span> que
            siguen enganchadas a su renovación (las que se editaron individualmente no se tocan).
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-3'>
          <div className='space-y-1'>
            <Label>Fecha de vencimiento / próxima renovación</Label>
            <Input type='date' value={renewalDate} onChange={e => setRenewalDate(e.target.value)} />
          </div>
          <div className='space-y-1'>
            <Label>Costo de renovación</Label>
            <Input
              type='number'
              min={0}
              step='0.01'
              value={renewalCost}
              onChange={e => setRenewalCost(e.target.value)}
              placeholder='0.00'
            />
          </div>
          <div className='space-y-1'>
            <Label>Frecuencia de renovación</Label>
            <SimpleSelect
              value={renewalFrequency}
              onChange={e => setRenewalFrequency(e.target.value)}
            >
              <option value=''>Sin especificar</option>
              {LICENSE_RENEWAL_FREQUENCY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </SimpleSelect>
          </div>
          {renewalFrequency === 'CUSTOM' && (
            <div className='space-y-1'>
              <Label>Cada cuántos meses</Label>
              <Input
                type='number'
                min={1}
                value={customFrequencyMonths}
                onChange={e => setCustomFrequencyMonths(e.target.value)}
                placeholder='Ej. 24'
              />
            </div>
          )}
        </div>

        {error && <p className='text-sm text-destructive'>{error}</p>}

        <DialogFooter className='gap-2 sm:gap-2'>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type='button' disabled={submitting} onClick={() => void handleConfirm()}>
            {submitting ? (
              <Loader2 className='h-4 w-4 mr-1.5 animate-spin' />
            ) : (
              <RefreshCw className='h-4 w-4 mr-1.5' />
            )}
            Renovar lote
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
