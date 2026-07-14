'use client'

/**
 * QuickContractForm — creación mínima de contrato desde picker de activos/licencias.
 */

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import type { Contract } from '@/types/contracts'
import {
  buildContractPrefill,
  defaultCategoryForContext,
  type ContractPickerContext,
  type ContractPickerPrefill,
} from '@/lib/contracts/contract-picker-prefill'

interface QuickContractFormProps {
  supplierId?: string | null
  familyId?: string | null
  context?: ContractPickerContext
  prefill?: ContractPickerPrefill | null
  onSuccess: (contract: Contract) => void
  onCancel: () => void
}

export function QuickContractForm({
  supplierId,
  familyId,
  context = 'license',
  prefill = null,
  onSuccess,
  onCancel,
}: QuickContractFormProps) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)

  const resolved = buildContractPrefill(
    { ...prefill, supplierId: prefill?.supplierId ?? supplierId, familyId: prefill?.familyId ?? familyId },
    context
  )

  const [name, setName] = useState(resolved.name ?? '')
  const [contractNumber, setContractNumber] = useState('')
  const [startDate, setStartDate] = useState(resolved.startDate ?? '')
  const [endDate, setEndDate] = useState(resolved.endDate ?? '')
  const [monthlyCost, setMonthlyCost] = useState(
    resolved.monthlyCost != null ? String(resolved.monthlyCost) : ''
  )
  const [totalValue, setTotalValue] = useState(
    resolved.totalValue != null ? String(resolved.totalValue) : ''
  )
  const [currency, setCurrency] = useState('USD')
  const [billingCycle, setBillingCycle] = useState(resolved.billingCycle ?? 'MONTHLY')
  const [autoRenew, setAutoRenew] = useState(false)

  const isRecurring = billingCycle !== 'ONE_TIME'

  useEffect(() => {
    setName(resolved.name ?? '')
    setStartDate(resolved.startDate ?? '')
    setEndDate(resolved.endDate ?? '')
    setBillingCycle(resolved.billingCycle ?? 'MONTHLY')
    if (resolved.monthlyCost != null) setMonthlyCost(String(resolved.monthlyCost))
    if (resolved.totalValue != null) setTotalValue(String(resolved.totalValue))
  }, [resolved])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast({ title: 'El nombre del contrato es obligatorio', variant: 'destructive' })
      return
    }

    setSubmitting(true)
    try {
      const lines =
        resolved.suggestedLineDescription
          ? [
              {
                type: resolved.suggestedLineType ?? 'SOFTWARE',
                description: resolved.suggestedLineDescription,
                quantity: 1,
                unitPrice: isRecurring
                  ? monthlyCost
                    ? parseFloat(monthlyCost)
                    : undefined
                  : totalValue
                    ? parseFloat(totalValue)
                    : undefined,
                order: 0,
              },
            ]
          : []

      const res = await fetch('/api/inventory/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          contractNumber: contractNumber.trim() || undefined,
          category: resolved.category ?? defaultCategoryForContext(context),
          supplierId: supplierId || undefined,
          familyId: familyId || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          monthlyCost: isRecurring && monthlyCost ? parseFloat(monthlyCost) : undefined,
          totalValue: !isRecurring && totalValue ? parseFloat(totalValue) : undefined,
          currency,
          billingCycle,
          autoRenew,
          renewalNoticeDays: 30,
          lines,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Error al crear contrato')
      }

      const saved = await res.json()
      toast({ title: 'Contrato creado exitosamente' })
      onSuccess(saved)
    } catch (err: unknown) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al crear',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <p className='text-sm text-muted-foreground'>
        Creación rápida con datos heredados del formulario de{' '}
        {context === 'license' ? 'licencia' : 'equipo'}. Para facturación, custodio, líneas
        detalladas o adjuntos, usa la pestaña <strong>Formulario completo</strong>.
      </p>

      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <div className='sm:col-span-2 space-y-1'>
          <Label>
            Nombre del contrato <span className='text-destructive'>*</span>
          </Label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={
              context === 'license'
                ? 'Ej: Microsoft 365 Empresa'
                : 'Ej: Arrendamiento laptops 2026'
            }
            required
          />
        </div>

        <div className='space-y-1'>
          <Label>N° de contrato (opcional)</Label>
          <Input
            value={contractNumber}
            onChange={e => setContractNumber(e.target.value)}
            placeholder='Ej: CONT-2026-001'
          />
        </div>

        <div className='space-y-1'>
          <Label>{isRecurring ? 'Costo recurrente' : 'Valor total'}</Label>
          <Input
            type='number'
            min='0'
            step='0.01'
            value={isRecurring ? monthlyCost : totalValue}
            onChange={e =>
              isRecurring ? setMonthlyCost(e.target.value) : setTotalValue(e.target.value)
            }
            placeholder='0.00'
          />
        </div>

        <div className='space-y-1'>
          <Label>Fecha de inicio</Label>
          <Input type='date' value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>

        <div className='space-y-1'>
          <Label>Fecha de vencimiento</Label>
          <Input type='date' value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>

        <div className='space-y-1'>
          <Label>Ciclo de facturación</Label>
          <Select value={billingCycle} onValueChange={v => setBillingCycle(v as typeof billingCycle)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='MONTHLY'>Mensual</SelectItem>
              <SelectItem value='QUARTERLY'>Trimestral</SelectItem>
              <SelectItem value='SEMIANNUAL'>Semestral</SelectItem>
              <SelectItem value='ANNUAL'>Anual</SelectItem>
              <SelectItem value='ONE_TIME'>Pago único</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className='space-y-1'>
          <Label>Moneda</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='USD'>USD — Dólar</SelectItem>
              <SelectItem value='EUR'>EUR — Euro</SelectItem>
              <SelectItem value='CLP'>CLP — Peso chileno</SelectItem>
              <SelectItem value='MXN'>MXN — Peso mexicano</SelectItem>
              <SelectItem value='COP'>COP — Peso colombiano</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className='flex items-center justify-between rounded-lg border p-3'>
        <div>
          <p className='text-sm font-medium'>Renovación automática</p>
          <p className='text-xs text-muted-foreground'>Se renueva al vencer</p>
        </div>
        <Switch checked={autoRenew} onCheckedChange={setAutoRenew} />
      </div>

      <div className='flex justify-end gap-2 pt-2'>
        <Button type='button' variant='outline' onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type='submit' disabled={submitting}>
          {submitting && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
          Crear y vincular
        </Button>
      </div>
    </form>
  )
}
