'use client'

import { useCallback, useEffect, useState } from 'react'
import { FilePenLine, Plus, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { inventoryToast as toast } from '@/lib/utils/inventory-toast'
import {
  BILLING_CYCLE_LABELS,
  CONTRACT_AMENDMENT_TYPE_LABELS,
  type ContractAmendment,
  type ContractAmendmentType,
  type BillingCycle,
} from '@/types/contracts'

interface Props {
  contractId: string
  canManage?: boolean
  onContractUpdated?: () => void
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CL')
}

function fmtMoney(n?: number | null) {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'USD' }).format(n)
}

export function ContractAmendmentsPanel({
  contractId,
  canManage = true,
  onContractUpdated,
}: Props) {
  const [items, setItems] = useState<ContractAmendment[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<ContractAmendmentType>('PRICE_CHANGE')
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10))
  const [applyToContract, setApplyToContract] = useState(true)
  const [newMonthlyCost, setNewMonthlyCost] = useState('')
  const [newTotalValue, setNewTotalValue] = useState('')
  const [newEndDate, setNewEndDate] = useState('')
  const [newBillingCycle, setNewBillingCycle] = useState<BillingCycle | ''>('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/inventory/contracts/${contractId}/amendments`)
      if (res.ok) {
        const data = await res.json()
        setItems(data.amendments ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [contractId])

  useEffect(() => {
    load()
  }, [load])

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setType('PRICE_CHANGE')
    setEffectiveDate(new Date().toISOString().slice(0, 10))
    setApplyToContract(true)
    setNewMonthlyCost('')
    setNewTotalValue('')
    setNewEndDate('')
    setNewBillingCycle('')
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Título requerido')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/contracts/${contractId}/amendments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          type,
          effectiveDate,
          applyToContract,
          newMonthlyCost: newMonthlyCost ? parseFloat(newMonthlyCost) : undefined,
          newTotalValue: newTotalValue ? parseFloat(newTotalValue) : undefined,
          newEndDate: newEndDate || undefined,
          newBillingCycle: newBillingCycle || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al guardar')

      toast.success('Adendum registrado', json.folio)
      setOpen(false)
      resetForm()
      await load()
      onContractUpdated?.()
    } catch (err: unknown) {
      toast.error('Error', err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className='pb-3'>
          <div className='flex items-start justify-between gap-3'>
            <div>
              <CardTitle className='text-base flex items-center gap-2'>
                <FilePenLine className='h-4 w-4' />
                Adendums / modificaciones
              </CardTitle>
              <p className='text-xs text-muted-foreground mt-1'>
                Registro formal de cambios (precio, vigencia, alcance). Folio ADN-*. Al aplicar,
                actualiza el contrato y sincroniza licencias vinculadas.
              </p>
            </div>
            {canManage && (
              <Button type='button' size='sm' onClick={() => setOpen(true)}>
                <Plus className='h-3.5 w-3.5 mr-1' />
                Nuevo adendum
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
              <RefreshCw className='h-4 w-4 animate-spin' />
              Cargando...
            </div>
          ) : items.length === 0 ? (
            <p className='text-sm text-muted-foreground'>
              Sin adendums. Las renovaciones completas siguen en el historial; los cambios parciales
              (precio, plazo) se registran aquí.
            </p>
          ) : (
            <ul className='space-y-3'>
              {items.map(a => (
                <li key={a.id} className='rounded-lg border p-3 space-y-2'>
                  <div className='flex flex-wrap items-center justify-between gap-2'>
                    <div>
                      <p className='text-sm font-medium'>
                        #{a.amendmentNumber} — {a.title}
                      </p>
                      <p className='text-xs text-muted-foreground font-mono'>{a.folio}</p>
                    </div>
                    <div className='flex items-center gap-2'>
                      <Badge variant='outline'>
                        {CONTRACT_AMENDMENT_TYPE_LABELS[a.type] ?? a.type}
                      </Badge>
                      {a.applyToContract && (
                        <Badge variant='secondary' className='text-xs'>
                          Aplicado
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Vigente desde {fmtDate(a.effectiveDate)}
                    {a.creator ? ` · ${a.creator.name}` : ''}
                  </p>
                  {a.description && (
                    <p className='text-xs text-muted-foreground'>{a.description}</p>
                  )}
                  <div className='grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs'>
                    {a.previousMonthlyCost != null || a.newMonthlyCost != null ? (
                      <p>
                        Costo mensual: {fmtMoney(a.previousMonthlyCost)} →{' '}
                        <strong>{fmtMoney(a.newMonthlyCost)}</strong>
                      </p>
                    ) : null}
                    {a.previousTotalValue != null || a.newTotalValue != null ? (
                      <p>
                        Valor total: {fmtMoney(a.previousTotalValue)} →{' '}
                        <strong>{fmtMoney(a.newTotalValue)}</strong>
                      </p>
                    ) : null}
                    {a.previousEndDate != null || a.newEndDate != null ? (
                      <p>
                        Vencimiento: {fmtDate(a.previousEndDate)} →{' '}
                        <strong>{fmtDate(a.newEndDate)}</strong>
                      </p>
                    ) : null}
                    {a.previousBillingCycle != null || a.newBillingCycle != null ? (
                      <p>
                        Ciclo:{' '}
                        {a.previousBillingCycle
                          ? BILLING_CYCLE_LABELS[a.previousBillingCycle]
                          : '—'}{' '}
                        →{' '}
                        <strong>
                          {a.newBillingCycle ? BILLING_CYCLE_LABELS[a.newBillingCycle] : '—'}
                        </strong>
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='max-w-lg max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>Registrar adendum</DialogTitle>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-1'>
              <Label>
                Título <span className='text-destructive'>*</span>
              </Label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder='Ej: Ajuste precio por inflación 2026'
              />
            </div>
            <div className='space-y-1'>
              <Label>Tipo</Label>
              <Select value={type} onValueChange={v => setType(v as ContractAmendmentType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTRACT_AMENDMENT_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1'>
              <Label>Fecha efectiva</Label>
              <DateInput value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} />
            </div>
            <div className='space-y-1'>
              <Label>Descripción / alcance del cambio</Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                placeholder='Detalle de cláusulas modificadas...'
              />
            </div>
            <div className='grid grid-cols-2 gap-3'>
              <div className='space-y-1'>
                <Label>Nuevo costo mensual</Label>
                <Input
                  type='number'
                  min='0'
                  step='0.01'
                  value={newMonthlyCost}
                  onChange={e => setNewMonthlyCost(e.target.value)}
                  placeholder='Opcional'
                />
              </div>
              <div className='space-y-1'>
                <Label>Nuevo valor total</Label>
                <Input
                  type='number'
                  min='0'
                  step='0.01'
                  value={newTotalValue}
                  onChange={e => setNewTotalValue(e.target.value)}
                  placeholder='Opcional'
                />
              </div>
              <div className='space-y-1'>
                <Label>Nueva fecha fin</Label>
                <DateInput
                  value={newEndDate}
                  onChange={e => setNewEndDate(e.target.value)}
                  clearable
                />
              </div>
              <div className='space-y-1'>
                <Label>Nuevo ciclo</Label>
                <Select
                  value={newBillingCycle || 'none'}
                  onValueChange={v => setNewBillingCycle(v === 'none' ? '' : (v as BillingCycle))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Sin cambio' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='none'>Sin cambio</SelectItem>
                    {Object.entries(BILLING_CYCLE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className='flex items-center justify-between rounded-lg border p-3'>
              <div>
                <p className='text-sm font-medium'>Aplicar al contrato</p>
                <p className='text-xs text-muted-foreground'>
                  Actualiza montos/vigencia y sincroniza licencias vinculadas
                </p>
              </div>
              <Switch checked={applyToContract} onCheckedChange={setApplyToContract} />
            </div>
          </div>
          <DialogFooter>
            <Button type='button' variant='outline' onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type='button' onClick={handleSubmit} disabled={submitting}>
              {submitting && <RefreshCw className='h-4 w-4 mr-2 animate-spin' />}
              Registrar adendum
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
