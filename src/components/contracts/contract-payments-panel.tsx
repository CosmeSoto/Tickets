'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, CheckCircle, RefreshCw, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { PAYMENT_METHOD_TYPE_LABELS, type PaymentMethodType } from '@/types/contracts'

interface ContractPayment {
  id: string
  amount: number
  currency: string
  dueDate: string
  status: string
  paidDate?: string | null
}

interface PaymentStats {
  total: number
  scheduled: number
  due: number
  overdue: number
  paid: number
}

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Programado',
  DUE: 'Por vencer hoy',
  OVERDUE: 'Vencido',
  PAID: 'Pagado',
  CANCELLED: 'Cancelado',
}

const STATUS_CLS: Record<string, string> = {
  SCHEDULED: 'bg-slate-100 text-slate-700',
  DUE: 'bg-amber-100 text-amber-800',
  OVERDUE: 'bg-red-100 text-red-800',
  PAID: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-muted text-muted-foreground',
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function fmtCurrency(n: number, currency = 'USD') {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(n)
}

/** Devuelve la fecha de hoy en formato YYYY-MM-DD para el input[type=date] */
function todayISO() {
  return new Date().toISOString().split('T')[0]
}

interface Props {
  contractId: string
  hasBillingDates: boolean
}

export function ContractPaymentsPanel({ contractId, hasBillingDates }: Props) {
  const { toast } = useToast()
  const [payments, setPayments] = useState<ContractPayment[]>([])
  const [stats, setStats] = useState<PaymentStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  // Estado del modal "Marcar como pagado"
  const [markingPayment, setMarkingPayment] = useState<ContractPayment | null>(null)
  const [paidDate, setPaidDate] = useState(todayISO())
  const [paymentMethod, setPaymentMethod] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [transactionId, setTransactionId] = useState('')
  const [cardLast4, setCardLast4] = useState('')
  const [cardBrand, setCardBrand] = useState('')
  const [bankEntity, setBankEntity] = useState('')
  const [chargeSource, setChargeSource] = useState<PaymentMethodType>('CORPORATE_CARD')
  const [marking, setMarking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [paymentsRes, statsRes] = await Promise.all([
        fetch(`/api/inventory/contracts/${contractId}/payments?pageSize=12`),
        // Ruta correcta: /api/inventory/contracts/payments/stats?contractId=...
        fetch(`/api/inventory/contracts/payments/stats?contractId=${contractId}`),
      ])
      if (paymentsRes.ok) {
        const data = await paymentsRes.json()
        // El endpoint devuelve { payments, total, ... }
        setPayments(data.payments ?? [])
      }
      if (statsRes.ok) {
        setStats(await statsRes.json())
      }
    } finally {
      setLoading(false)
    }
  }, [contractId])

  useEffect(() => {
    load()
  }, [load])

  const handleGenerate = async () => {
    if (!hasBillingDates) {
      toast({
        title: 'Fechas incompletas',
        description: 'El contrato debe tener fecha de inicio y fin para generar pagos.',
        variant: 'destructive',
      })
      return
    }

    setGenerating(true)
    try {
      const res = await fetch(`/api/inventory/contracts/${contractId}/payments/generate`, {
        method: 'POST',
      })
      const json = await res.json().catch(() => ({}))

      if (res.status === 409 || json.code === 'PAYMENTS_ALREADY_EXIST') {
        toast({
          title: 'Pagos ya existentes',
          description:
            json.error ??
            'Este contrato ya tiene pagos programados. Elimínalos o cancélalos antes de regenerar.',
          variant: 'destructive',
        })
        return
      }

      if (!res.ok) throw new Error(json.error ?? 'No se pudieron generar los pagos')

      toast({
        title: 'Pagos generados',
        description: `Se crearon ${json.paymentsGenerated ?? 0} pagos programados.`,
      })
      await load()
    } catch (err: unknown) {
      toast({
        title: 'Error al generar pagos',
        description: err instanceof Error ? err.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setGenerating(false)
    }
  }

  const openMarkModal = (p: ContractPayment) => {
    setMarkingPayment(p)
    setPaidDate(todayISO())
    setPaymentMethod('')
    setReferenceNumber('')
    setTransactionId('')
    setCardLast4('')
    setCardBrand('')
    setBankEntity('')
    setChargeSource('CORPORATE_CARD')
  }

  const handleMarkAsPaid = async () => {
    if (!markingPayment) return
    if (!paidDate) {
      toast({
        title: 'Fecha requerida',
        description: 'Ingresa la fecha de pago.',
        variant: 'destructive',
      })
      return
    }

    setMarking(true)
    try {
      const res = await fetch(`/api/inventory/contracts/payments/${markingPayment.id}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paidDate,
          paymentMethod: paymentMethod || undefined,
          referenceNumber: referenceNumber || undefined,
          transactionId: transactionId || undefined,
          cardLast4: cardLast4 || undefined,
          cardBrand: cardBrand || undefined,
          bankEntity: bankEntity || undefined,
          chargeSource,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'No se pudo registrar el pago')

      toast({
        title: 'Pago registrado',
        description: `El pago de ${fmtCurrency(markingPayment.amount, markingPayment.currency)} fue marcado como pagado.`,
      })
      setMarkingPayment(null)
      await load()
    } catch (err: unknown) {
      toast({
        title: 'Error al registrar pago',
        description: err instanceof Error ? err.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setMarking(false)
    }
  }

  const canMarkAsPaid = (status: string) =>
    status === 'SCHEDULED' || status === 'DUE' || status === 'OVERDUE'

  return (
    <>
      <Card>
        <CardHeader className='pb-3'>
          <div className='flex items-start justify-between gap-3'>
            <div>
              <CardTitle className='text-base flex items-center gap-2'>
                <CalendarClock className='h-4 w-4' />
                Pagos programados
              </CardTitle>
              <p className='text-xs text-muted-foreground mt-1'>
                Genera cuotas según el ciclo de facturación del contrato.
              </p>
            </div>
            <div className='flex gap-2'>
              <Button type='button' variant='outline' size='sm' onClick={load} disabled={loading}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
              <Button
                type='button'
                size='sm'
                onClick={handleGenerate}
                disabled={generating || !hasBillingDates}
              >
                {generating ? (
                  <RefreshCw className='h-3.5 w-3.5 mr-1.5 animate-spin' />
                ) : (
                  <Sparkles className='h-3.5 w-3.5 mr-1.5' />
                )}
                Generar pagos
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          {stats && (
            <div className='grid grid-cols-2 sm:grid-cols-5 gap-2 text-center'>
              {(
                [
                  ['Total', stats.total],
                  ['Programados', stats.scheduled],
                  ['Hoy', stats.due],
                  ['Vencidos', stats.overdue],
                  ['Pagados', stats.paid],
                ] as [string, number][]
              ).map(([label, value]) => (
                <div key={label} className='rounded-md border px-2 py-2'>
                  <p className='text-lg font-semibold'>{value}</p>
                  <p className='text-[10px] uppercase tracking-wide text-muted-foreground'>
                    {label}
                  </p>
                </div>
              ))}
            </div>
          )}

          {loading ? (
            <p className='text-sm text-muted-foreground'>Cargando pagos...</p>
          ) : payments.length === 0 ? (
            <p className='text-sm text-muted-foreground'>
              No hay pagos registrados. Usa &quot;Generar pagos&quot; para crear el calendario
              automático.
            </p>
          ) : (
            <ul className='space-y-2'>
              {payments.map(p => (
                <li
                  key={p.id}
                  className='flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm'
                >
                  <div className='min-w-0'>
                    <p className='font-medium'>{fmtCurrency(p.amount, p.currency)}</p>
                    <p className='text-xs text-muted-foreground'>
                      Vence: {fmtDate(p.dueDate)}
                      {p.paidDate && (
                        <span className='ml-2 text-green-600'>· Pagado: {fmtDate(p.paidDate)}</span>
                      )}
                    </p>
                  </div>
                  <div className='flex items-center gap-2 shrink-0'>
                    <Badge variant='outline' className={STATUS_CLS[p.status] ?? ''}>
                      {STATUS_LABELS[p.status] ?? p.status}
                    </Badge>
                    {canMarkAsPaid(p.status) && (
                      <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        className='h-7 px-2 text-xs text-green-700 border-green-200 hover:bg-green-50'
                        onClick={() => openMarkModal(p)}
                      >
                        <CheckCircle className='h-3.5 w-3.5 mr-1' />
                        Pagar
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Modal: Marcar como pagado */}
      <Dialog
        open={!!markingPayment}
        onOpenChange={open => {
          if (!open) setMarkingPayment(null)
        }}
      >
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <CheckCircle className='h-4 w-4 text-green-600' />
              Registrar pago
            </DialogTitle>
          </DialogHeader>

          {markingPayment && (
            <div className='space-y-4 py-2'>
              <div className='rounded-md bg-muted/50 px-3 py-2 text-sm'>
                <p className='font-medium'>
                  {fmtCurrency(markingPayment.amount, markingPayment.currency)}
                </p>
                <p className='text-xs text-muted-foreground'>
                  Vencimiento: {fmtDate(markingPayment.dueDate)}
                </p>
              </div>

              <div className='space-y-1'>
                <Label htmlFor='paid-date'>
                  Fecha de pago <span className='text-destructive'>*</span>
                </Label>
                <DateInput
                  id='paid-date'
                  value={paidDate}
                  onChange={e => setPaidDate(e.target.value)}
                />
              </div>

              <div className='space-y-1'>
                <Label htmlFor='payment-method'>
                  Método de pago <span className='text-xs text-muted-foreground'>(opcional)</span>
                </Label>
                <Input
                  id='payment-method'
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  placeholder='Ej: Transferencia, Cheque...'
                />
              </div>

              <div className='space-y-1'>
                <Label htmlFor='reference-number'>
                  N° de referencia <span className='text-xs text-muted-foreground'>(opcional)</span>
                </Label>
                <Input
                  id='reference-number'
                  value={referenceNumber}
                  onChange={e => setReferenceNumber(e.target.value)}
                  placeholder='Ej: TRF-20260622-001'
                />
              </div>

              <div className='space-y-1'>
                <Label htmlFor='transaction-id'>ID transacción bancaria</Label>
                <Input
                  id='transaction-id'
                  value={transactionId}
                  onChange={e => setTransactionId(e.target.value)}
                  placeholder='Para kit de cancelación'
                />
              </div>

              <div className='space-y-1'>
                <Label htmlFor='charge-source'>Método de cobro</Label>
                <select
                  id='charge-source'
                  className='flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm'
                  value={chargeSource}
                  onChange={e => setChargeSource(e.target.value as PaymentMethodType)}
                >
                  {Object.entries(PAYMENT_METHOD_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div className='grid grid-cols-3 gap-2'>
                <div className='space-y-1'>
                  <Label htmlFor='card-last4'>Tarjeta ·4</Label>
                  <Input
                    id='card-last4'
                    maxLength={4}
                    value={cardLast4}
                    onChange={e => setCardLast4(e.target.value)}
                    placeholder='1234'
                  />
                </div>
                <div className='space-y-1'>
                  <Label htmlFor='card-brand'>Marca</Label>
                  <Input
                    id='card-brand'
                    value={cardBrand}
                    onChange={e => setCardBrand(e.target.value)}
                    placeholder='VISA'
                  />
                </div>
                <div className='space-y-1'>
                  <Label htmlFor='bank-entity'>Banco</Label>
                  <Input
                    id='bank-entity'
                    value={bankEntity}
                    onChange={e => setBankEntity(e.target.value)}
                    placeholder='Entidad'
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className='gap-2'>
            <Button
              type='button'
              variant='outline'
              onClick={() => setMarkingPayment(null)}
              disabled={marking}
            >
              Cancelar
            </Button>
            <Button
              type='button'
              onClick={handleMarkAsPaid}
              disabled={marking || !paidDate}
              className='bg-green-600 hover:bg-green-700 text-white'
            >
              {marking ? (
                <RefreshCw className='h-3.5 w-3.5 mr-1.5 animate-spin' />
              ) : (
                <CheckCircle className='h-3.5 w-3.5 mr-1.5' />
              )}
              Confirmar pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
