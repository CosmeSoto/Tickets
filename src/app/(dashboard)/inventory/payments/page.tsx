'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { CheckCircle, RefreshCw, Wallet } from 'lucide-react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { DateInput } from '@/components/ui/date-input'
import { FamilyCombobox } from '@/components/ui/family-combobox'
import { useFamilyOptions } from '@/hooks/use-family-options'
import { useFetch } from '@/hooks/common/use-fetch'
import { useInventoryPermissions } from '@/hooks/use-inventory-permissions'
import { inventoryToast as toast } from '@/lib/utils/inventory-toast'
import { PAYMENT_METHOD_TYPE_LABELS, type PaymentMethodType } from '@/types/contracts'

type PaymentRow = {
  id: string
  amount: number
  currency: string
  dueDate: string
  status: string
  paidDate?: string | null
  contract: {
    id: string
    name: string
    contractNumber?: string | null
    billingCycle?: string | null
    supplier?: { name: string } | null
    family?: { name: string; color?: string | null } | null
  }
}

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Programado',
  DUE: 'Vence hoy',
  OVERDUE: 'Vencido',
  PAID: 'Pagado',
  CANCELLED: 'Cancelado',
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

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

const TABS: { id: string; label: string; status?: string }[] = [
  { id: 'overdue', label: 'Vencidos', status: 'OVERDUE' },
  { id: 'due', label: 'Hoy', status: 'DUE' },
  { id: 'upcoming', label: 'Próximos', status: 'SCHEDULED' },
  { id: 'paid', label: 'Pagados', status: 'PAID' },
  { id: 'all', label: 'Todos' },
]

export default function InventoryPaymentsPage() {
  const { canManageContracts } = useInventoryPermissions()
  const { families } = useFamilyOptions()
  const [tab, setTab] = useState('overdue')
  const [familyFilter, setFamilyFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [marking, setMarking] = useState<PaymentRow | null>(null)
  const [paidDate, setPaidDate] = useState(todayISO())
  const [saving, setSaving] = useState(false)

  const activeTab = TABS.find(t => t.id === tab) ?? TABS[0]

  const buildUrl = useCallback(() => {
    const p = new URLSearchParams({ pageSize: '100' })
    if (activeTab.status) p.set('status', activeTab.status)
    if (familyFilter !== 'all') p.set('familyId', familyFilter)
    if (search.trim()) p.set('search', search.trim())
    return `/api/inventory/payments?${p}`
  }, [activeTab.status, familyFilter, search])

  const {
    data: payments,
    loading,
    reload,
  } = useFetch<PaymentRow>(buildUrl(), {
    transform: d => d.payments ?? [],
    enabled: canManageContracts,
  })

  const markPaid = async () => {
    if (!marking) return
    setSaving(true)
    try {
      const res = await fetch(`/api/inventory/contracts/payments/${marking.id}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paidDate,
          paymentMethod: 'BANK_TRANSFER' as PaymentMethodType,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'No se pudo registrar')
      toast({ title: 'Pago registrado' })
      setMarking(null)
      await reload()
    } catch (err: unknown) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (!canManageContracts) {
    return (
      <ModuleLayout title='Pagos' subtitle='Solo gestores de inventario pueden operar cuotas.'>
        <p className='text-sm text-muted-foreground'>No tienes permiso para esta sección.</p>
      </ModuleLayout>
    )
  }

  return (
    <ModuleLayout
      title='Pagos de contratos'
      subtitle='Cuotas mensuales de equipos que siguen en renta. Cada fecha cobra solo los activos vigentes ese día.'
      headerActions={
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() => reload()}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      }
    >
      <div className='space-y-4'>
        <div className='flex flex-wrap gap-2'>
          {TABS.map(t => (
            <Button
              key={t.id}
              type='button'
              size='sm'
              variant={tab === t.id ? 'default' : 'outline'}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </Button>
          ))}
        </div>

        <div className='flex flex-col sm:flex-row gap-3'>
          <Input
            placeholder='Buscar contrato o proveedor…'
            value={search}
            onChange={e => setSearch(e.target.value)}
            className='sm:max-w-xs'
          />
          <FamilyCombobox
            families={families}
            value={familyFilter}
            onValueChange={v => setFamilyFilter(v || 'all')}
            allowAll
            allowClear
            placeholder='Todas las áreas'
          />
        </div>

        <p className='text-xs text-muted-foreground flex items-center gap-1.5'>
          <Wallet className='h-3.5 w-3.5' />
          {payments.length} cuota(s) en esta vista. Las alertas de vencimiento salen por la app,
          correo y Telegram (si están activos). Tras agregar o devolver un equipo, abre el contrato
          y recalcula las cuotas pendientes.
        </p>

        <div className='rounded-lg border overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead className='bg-muted/50 text-left'>
              <tr>
                <th className='px-3 py-2 font-medium'>Vencimiento</th>
                <th className='px-3 py-2 font-medium'>Contrato</th>
                <th className='px-3 py-2 font-medium'>Proveedor</th>
                <th className='px-3 py-2 font-medium'>Monto</th>
                <th className='px-3 py-2 font-medium'>Estado</th>
                <th className='px-3 py-2 font-medium' />
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className='px-3 py-8 text-center text-muted-foreground'>
                    No hay cuotas en esta vista.
                  </td>
                </tr>
              )}
              {payments.map(p => (
                <tr key={p.id} className='border-t'>
                  <td className='px-3 py-2 whitespace-nowrap'>{fmtDate(p.dueDate)}</td>
                  <td className='px-3 py-2'>
                    <Link href='/inventory/contracts' className='font-medium hover:underline'>
                      {p.contract.name}
                    </Link>
                    {p.contract.contractNumber && (
                      <span className='block text-xs text-muted-foreground'>
                        {p.contract.contractNumber}
                      </span>
                    )}
                  </td>
                  <td className='px-3 py-2'>{p.contract.supplier?.name ?? '—'}</td>
                  <td className='px-3 py-2 whitespace-nowrap'>
                    {fmtCurrency(Number(p.amount), p.currency)}
                  </td>
                  <td className='px-3 py-2'>
                    <Badge variant='secondary'>{STATUS_LABELS[p.status] ?? p.status}</Badge>
                  </td>
                  <td className='px-3 py-2 text-right'>
                    {(p.status === 'SCHEDULED' || p.status === 'DUE' || p.status === 'OVERDUE') && (
                      <Button
                        type='button'
                        size='sm'
                        variant='outline'
                        onClick={() => {
                          setPaidDate(todayISO())
                          setMarking(p)
                        }}
                      >
                        <CheckCircle className='h-3.5 w-3.5 mr-1' />
                        Registrar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!marking} onOpenChange={open => !open && setMarking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
          </DialogHeader>
          {marking && (
            <div className='space-y-3'>
              <p className='text-sm text-muted-foreground'>
                {marking.contract.name} · {fmtCurrency(Number(marking.amount), marking.currency)}
              </p>
              <div className='space-y-1'>
                <Label>Fecha de pago</Label>
                <DateInput value={paidDate} onChange={e => setPaidDate(e.target.value)} />
              </div>
              <p className='text-xs text-muted-foreground'>
                Método por defecto: {PAYMENT_METHOD_TYPE_LABELS.BANK_TRANSFER}. Puedes detallar
                tarjeta o cheque desde el contrato.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button type='button' variant='outline' onClick={() => setMarking(null)}>
              Cancelar
            </Button>
            <Button type='button' onClick={markPaid} disabled={saving}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleLayout>
  )
}
