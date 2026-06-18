'use client'

/**
 * QuickContractForm — formulario simplificado de contrato
 *
 * Se usa dentro del ContractPicker al crear un contrato desde la creación de activos.
 * Solo pide los campos esenciales para un contrato de arrendamiento/préstamo.
 * Las líneas detalladas se pueden agregar después desde la gestión completa de contratos.
 */

import { useState } from 'react'
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

interface QuickContractFormProps {
  /** Proveedor pre-seleccionado desde el formulario de activo */
  supplierId?: string | null
  /** Familia del activo */
  familyId?: string | null
  onSuccess: (contract: Contract) => void
  onCancel: () => void
}

export function QuickContractForm({
  supplierId,
  familyId,
  onSuccess,
  onCancel,
}: QuickContractFormProps) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)

  const [name, setName] = useState('')
  const [contractNumber, setContractNumber] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [monthlyCost, setMonthlyCost] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [billingCycle, setBillingCycle] = useState('MONTHLY')
  const [autoRenew, setAutoRenew] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast({ title: 'El nombre del contrato es obligatorio', variant: 'destructive' })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          contractNumber: contractNumber.trim() || undefined,
          category: 'LEASE',
          supplierId: supplierId || undefined,
          familyId: familyId || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          monthlyCost: monthlyCost ? parseFloat(monthlyCost) : undefined,
          currency,
          billingCycle,
          autoRenew,
          renewalNoticeDays: 30,
          lines: [],
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Error al crear contrato')
      }

      const saved = await res.json()
      toast({ title: 'Contrato creado exitosamente' })
      onSuccess(saved)
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <p className='text-sm text-muted-foreground'>
        Crea un contrato de arrendamiento rápidamente. Podrás agregar más detalles después desde la
        sección de Contratos.
      </p>

      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <div className='sm:col-span-2 space-y-1'>
          <Label>
            Nombre del contrato <span className='text-destructive'>*</span>
          </Label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder='Ej: Arrendamiento laptops 2026'
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
          <Label>Costo mensual</Label>
          <Input
            type='number'
            min='0'
            step='0.01'
            value={monthlyCost}
            onChange={e => setMonthlyCost(e.target.value)}
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
          <Select value={billingCycle} onValueChange={setBillingCycle}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='MONTHLY'>Mensual</SelectItem>
              <SelectItem value='QUARTERLY'>Trimestral</SelectItem>
              <SelectItem value='SEMIANNUAL'>Semestral</SelectItem>
              <SelectItem value='ANNUAL'>Anual</SelectItem>
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
          Crear contrato
        </Button>
      </div>
    </form>
  )
}
