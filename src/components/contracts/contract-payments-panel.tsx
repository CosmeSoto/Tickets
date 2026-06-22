'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, RefreshCw, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'

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

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [paymentsRes, statsRes] = await Promise.all([
        fetch(`/api/inventory/contracts/${contractId}/payments?pageSize=12`),
        fetch(`/api/inventory/contracts/payments/stats?contractId=${contractId}`),
      ])
      if (paymentsRes.ok) {
        const data = await paymentsRes.json()
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

  return (
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
            {[
              ['Total', stats.total],
              ['Programados', stats.scheduled],
              ['Hoy', stats.due],
              ['Vencidos', stats.overdue],
              ['Pagados', stats.paid],
            ].map(([label, value]) => (
              <div key={label as string} className='rounded-md border px-2 py-2'>
                <p className='text-lg font-semibold'>{value as number}</p>
                <p className='text-[10px] uppercase tracking-wide text-muted-foreground'>
                  {label as string}
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
                <div>
                  <p className='font-medium'>{fmtCurrency(p.amount, p.currency)}</p>
                  <p className='text-xs text-muted-foreground'>Vence: {fmtDate(p.dueDate)}</p>
                </div>
                <Badge variant='outline' className={STATUS_CLS[p.status] ?? ''}>
                  {STATUS_LABELS[p.status] ?? p.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
