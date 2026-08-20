'use client'

/**
 * ContractPaymentsPanel — Vista de calendario de cuotas dentro del contrato.
 *
 * PROPÓSITO: Configuración y generación del calendario de pagos.
 * OPERACIÓN (registrar pagos): exclusivamente en /inventory/payments.
 *
 * El panel NO tiene botón "Pagar" — eso evita duplicar la operación financiera
 * en dos lugares. El enlace "Ir a Pagos" lleva al gestor al punto centralizado.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  CalendarClock,
  ExternalLink,
  RefreshCw,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'

// ── Tipos ─────────────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  SCHEDULED: {
    label: 'Programado',
    cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    icon: Clock,
  },
  DUE: {
    label: 'Vence hoy',
    cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    icon: AlertCircle,
  },
  OVERDUE: {
    label: 'Vencido',
    cls: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    icon: AlertCircle,
  },
  PAID: {
    label: 'Pagado',
    cls: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    icon: CheckCircle2,
  },
  CANCELLED: { label: 'Cancelado', cls: 'bg-muted text-muted-foreground', icon: XCircle },
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

// ── Componente ────────────────────────────────────────────────────────────────

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
  const [recalculating, setRecalculating] = useState(false)

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
        description: `Se crearon ${json.paymentsGenerated ?? 0} cuota(s) en el calendario.`,
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

  const handleRecalculate = async () => {
    setRecalculating(true)
    try {
      const res = await fetch(`/api/inventory/contracts/${contractId}/payments/recalculate`, {
        method: 'POST',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'No se pudo recalcular')
      toast({
        title: 'Cuotas actualizadas',
        description: `Ajustadas: ${json.updated ?? 0}. Sin renta activa (canceladas): ${json.cancelled ?? 0}.`,
      })
      await load()
    } catch (err: unknown) {
      toast({
        title: 'Error al recalcular',
        description: err instanceof Error ? err.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setRecalculating(false)
    }
  }

  // Cuotas con acción pendiente (para resaltar en la vista)
  const pendingCount = stats ? stats.overdue + stats.due : 0

  return (
    <Card>
      <CardHeader className='pb-3'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          {/* Título + descripción */}
          <div className='min-w-0'>
            <CardTitle className='text-base flex items-center gap-2'>
              <CalendarClock className='h-4 w-4 shrink-0' />
              Calendario de pagos
              {pendingCount > 0 && (
                <Badge variant='destructive' className='text-xs'>
                  {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
                </Badge>
              )}
            </CardTitle>
            <p className='text-xs text-muted-foreground mt-1 max-w-lg'>
              Cada cuota cobra solo los equipos en renta esa fecha. Para{' '}
              <strong>registrar un pago</strong> ve a{' '}
              <Link
                href='/inventory/payments'
                className='inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-foreground transition-colors'
              >
                Pagos
                <ExternalLink className='h-3 w-3 ml-0.5' />
              </Link>
              .
            </p>
          </div>

          {/* Acciones */}
          <div className='flex flex-wrap gap-2 shrink-0'>
            <Button type='button' variant='outline' size='sm' onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className='sr-only sm:not-sr-only sm:ml-1.5'>Actualizar</span>
            </Button>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={handleRecalculate}
              disabled={recalculating || loading || payments.length === 0}
              title='Ajusta los montos de cuotas pendientes según los activos aún en renta'
            >
              {recalculating ? <RefreshCw className='h-3.5 w-3.5 animate-spin mr-1.5' /> : null}
              Recalcular
            </Button>
            <Button
              type='button'
              size='sm'
              onClick={handleGenerate}
              disabled={generating || !hasBillingDates}
              title={
                !hasBillingDates
                  ? 'El contrato necesita fechas de inicio y fin'
                  : 'Genera el calendario automático de cuotas'
              }
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
        {/* Stats de cuotas */}
        {stats && (
          <div className='grid grid-cols-2 sm:grid-cols-5 gap-2 text-center'>
            {(
              [
                ['Total', stats.total, ''],
                ['Programados', stats.scheduled, ''],
                ['Hoy', stats.due, stats.due > 0 ? 'text-amber-600 dark:text-amber-400' : ''],
                [
                  'Vencidos',
                  stats.overdue,
                  stats.overdue > 0 ? 'text-red-600 dark:text-red-400' : '',
                ],
                ['Pagados', stats.paid, stats.paid > 0 ? 'text-green-600 dark:text-green-400' : ''],
              ] as [string, number, string][]
            ).map(([label, value, cls]) => (
              <div key={label} className='rounded-md border px-2 py-2'>
                <p className={`text-lg font-semibold tabular-nums ${cls}`}>{value}</p>
                <p className='text-[10px] uppercase tracking-wide text-muted-foreground'>{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Aviso de acción pendiente */}
        {!loading && pendingCount > 0 && (
          <div className='flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/20 px-3 py-2.5 text-sm'>
            <AlertCircle className='h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5' />
            <div className='min-w-0'>
              <p className='font-medium text-amber-800 dark:text-amber-300'>
                {pendingCount} cuota{pendingCount !== 1 ? 's' : ''} requieren atención
              </p>
              <p className='text-xs text-amber-700 dark:text-amber-400 mt-0.5'>
                Regístralas desde{' '}
                <Link
                  href='/inventory/payments'
                  className='underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-200 inline-flex items-center gap-0.5'
                >
                  Inventario → Pagos <ExternalLink className='h-3 w-3' />
                </Link>
              </p>
            </div>
          </div>
        )}

        {/* Lista de cuotas (solo calendario, sin acción de pago) */}
        {loading ? (
          <div className='flex items-center gap-2 text-sm text-muted-foreground py-4'>
            <RefreshCw className='h-3.5 w-3.5 animate-spin' />
            Cargando calendario…
          </div>
        ) : payments.length === 0 ? (
          <div className='rounded-md border border-dashed py-6 text-center'>
            <CalendarClock className='h-8 w-8 mx-auto mb-2 text-muted-foreground/40' />
            <p className='text-sm text-muted-foreground'>Sin cuotas generadas.</p>
            <p className='text-xs text-muted-foreground mt-1'>
              {hasBillingDates
                ? 'Usa "Generar pagos" para crear el calendario automático.'
                : 'Configura las fechas del contrato para poder generar cuotas.'}
            </p>
          </div>
        ) : (
          <ul className='space-y-1.5'>
            {payments.map(p => {
              const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.SCHEDULED
              const Icon = cfg.icon
              return (
                <li
                  key={p.id}
                  className='flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm hover:bg-muted/30 transition-colors'
                >
                  <div className='min-w-0 flex-1'>
                    <span className='font-medium tabular-nums'>
                      {fmtCurrency(p.amount, p.currency)}
                    </span>
                    <span className='text-xs text-muted-foreground ml-2'>
                      Vence: {fmtDate(p.dueDate)}
                    </span>
                    {p.paidDate && (
                      <span className='text-xs text-green-600 dark:text-green-400 ml-2'>
                        · Pagado: {fmtDate(p.paidDate)}
                      </span>
                    )}
                  </div>
                  <Badge variant='outline' className={`shrink-0 gap-1 text-xs ${cfg.cls}`}>
                    <Icon className='h-3 w-3' />
                    {cfg.label}
                  </Badge>
                </li>
              )
            })}
          </ul>
        )}

        {/* Pie: enlace a la vista global si hay más cuotas */}
        {stats && stats.total > payments.length && (
          <p className='text-xs text-muted-foreground text-right'>
            Mostrando {payments.length} de {stats.total} cuotas.{' '}
            <Link
              href='/inventory/payments'
              className='underline underline-offset-2 hover:text-foreground inline-flex items-center gap-0.5'
            >
              Ver todas <ExternalLink className='h-3 w-3' />
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  )
}
