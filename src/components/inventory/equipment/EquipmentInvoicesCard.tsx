'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Receipt,
  Plus,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CurrencySelect } from '@/components/ui/currency-select'
import { DateInput } from '@/components/ui/date-input'
import { SupplierSelect } from '@/components/inventory/suppliers/SupplierSelect'
import { inventoryToast as toast } from '@/lib/utils/inventory-toast'
import { PAYMENT_METHOD_TYPE_LABELS, type PaymentMethodType } from '@/types/contracts'

// ── Tipos ─────────────────────────────────────────────────────────────────────

type InvoiceStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'

interface EquipmentInvoice {
  id: string
  invoiceNumber?: string | null
  purchaseOrderNumber?: string | null
  amount: number
  currency: string
  dueDate?: string | null
  paidDate?: string | null
  status: InvoiceStatus
  paymentMethod?: string | null
  supplierId?: string | null
  supplierName?: string | null
  referenceNumber?: string | null
  bankEntity?: string | null
  cardLast4?: string | null
  cardBrand?: string | null
  transactionId?: string | null
  notes?: string | null
  createdAt: string
  supplier?: { id: string; name: string } | null
  creator?: { id: string; name: string } | null
}

interface FormState {
  invoiceNumber: string
  purchaseOrderNumber: string
  amount: string
  currency: string
  dueDate: string
  paidDate: string
  paymentMethod: string
  supplierId: string
  supplierName: string
  referenceNumber: string
  bankEntity: string
  cardLast4: string
  notes: string
}

const EMPTY_FORM: FormState = {
  invoiceNumber: '',
  purchaseOrderNumber: '',
  amount: '',
  currency: 'USD',
  dueDate: '',
  paidDate: '',
  paymentMethod: '',
  supplierId: '',
  supplierName: '',
  referenceNumber: '',
  bankEntity: '',
  cardLast4: '',
  notes: '',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  InvoiceStatus,
  {
    label: string
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
    icon: React.ElementType
  }
> = {
  PENDING: { label: 'Pendiente', variant: 'secondary', icon: Clock },
  PAID: { label: 'Pagado', variant: 'default', icon: CheckCircle2 },
  OVERDUE: { label: 'Vencido', variant: 'destructive', icon: AlertCircle },
  CANCELLED: { label: 'Cancelado', variant: 'outline', icon: XCircle },
}

function fmtCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

// ── Componente principal ──────────────────────────────────────────────────────

interface EquipmentInvoicesCardProps {
  equipmentId: string
  canManage?: boolean
}

export function EquipmentInvoicesCard({
  equipmentId,
  canManage = false,
}: EquipmentInvoicesCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [invoices, setInvoices] = useState<EquipmentInvoice[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Dialogs
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<EquipmentInvoice | null>(null)
  const [markingPaid, setMarkingPaid] = useState<EquipmentInvoice | null>(null)
  const [deleting, setDeleting] = useState<EquipmentInvoice | null>(null)
  const [saving, setSaving] = useState(false)

  // Formulario
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  // ── Carga de datos ──────────────────────────────────────────────────────────

  const loadInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/inventory/equipment/${equipmentId}/invoices`)
      const data = await res.json()
      setInvoices(data.invoices ?? [])
    } catch {
      toast.error('Error al cargar facturas')
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }, [equipmentId])

  useEffect(() => {
    if (expanded && !loaded) loadInvoices()
  }, [expanded, loaded, loadInvoices])

  // ── Formulario ──────────────────────────────────────────────────────────────

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(inv: EquipmentInvoice) {
    setEditing(inv)
    setForm({
      invoiceNumber: inv.invoiceNumber ?? '',
      purchaseOrderNumber: inv.purchaseOrderNumber ?? '',
      amount: String(inv.amount),
      currency: inv.currency,
      dueDate: inv.dueDate ? inv.dueDate.substring(0, 10) : '',
      paidDate: inv.paidDate ? inv.paidDate.substring(0, 10) : '',
      paymentMethod: inv.paymentMethod ?? '',
      supplierId: inv.supplierId ?? '',
      supplierName: inv.supplierName ?? '',
      referenceNumber: inv.referenceNumber ?? '',
      bankEntity: inv.bankEntity ?? '',
      cardLast4: inv.cardLast4 ?? '',
      notes: inv.notes ?? '',
    })
    setShowForm(true)
  }

  function setField(k: keyof FormState, v: string) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function handleSave() {
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error('El monto debe ser mayor a 0')
      return
    }
    setSaving(true)
    try {
      const payload = {
        invoiceNumber: form.invoiceNumber || null,
        purchaseOrderNumber: form.purchaseOrderNumber || null,
        amount: Number(form.amount),
        currency: form.currency || 'USD',
        dueDate: form.dueDate || null,
        paidDate: form.paidDate || null,
        paymentMethod: form.paymentMethod || null,
        supplierId: form.supplierId || null,
        supplierName: form.supplierName || null,
        referenceNumber: form.referenceNumber || null,
        bankEntity: form.bankEntity || null,
        cardLast4: form.cardLast4 || null,
        notes: form.notes || null,
      }

      let res: Response
      if (editing) {
        res = await fetch(`/api/inventory/equipment/invoices/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch(`/api/inventory/equipment/${equipmentId}/invoices`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Error al guardar')

      toast.success(editing ? 'Factura actualizada' : 'Factura registrada')
      setShowForm(false)
      await loadInvoices()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  // ── Marcar como pagado ──────────────────────────────────────────────────────

  const [paidDate, setPaidDate] = useState(todayISO())
  const [paidMethod, setPaidMethod] = useState<string>('')

  function openMarkPaid(inv: EquipmentInvoice) {
    setPaidDate(todayISO())
    setPaidMethod(inv.paymentMethod ?? '')
    setMarkingPaid(inv)
  }

  async function handleMarkPaid() {
    if (!markingPaid) return
    setSaving(true)
    try {
      const res = await fetch(`/api/inventory/equipment/invoices/${markingPaid.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'markAsPaid',
          paidDate,
          paymentMethod: paidMethod || null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'No se pudo registrar')
      toast.success('Pago registrado correctamente')
      setMarkingPaid(null)
      await loadInvoices()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar pago')
    } finally {
      setSaving(false)
    }
  }

  // ── Eliminar ────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleting) return
    setSaving(true)
    try {
      const res = await fetch(`/api/inventory/equipment/invoices/${deleting.id}`, {
        method: 'DELETE',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'No se pudo eliminar')
      toast.success('Factura eliminada')
      setDeleting(null)
      await loadInvoices()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar')
    } finally {
      setSaving(false)
    }
  }

  // ── Estadísticas rápidas ────────────────────────────────────────────────────

  const totals = invoices.reduce(
    (acc, inv) => {
      if (inv.status !== 'CANCELLED') {
        acc.total += inv.amount
        if (inv.status === 'PAID') acc.paid += inv.amount
        if (inv.status === 'PENDING' || inv.status === 'OVERDUE') acc.pending += inv.amount
      }
      return acc
    },
    { total: 0, paid: 0, pending: 0 }
  )

  const currency = invoices[0]?.currency ?? 'USD'
  const hasInvoices = invoices.length > 0

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Acordeón ─────────────────────────────────────────────────────── */}
      <div className='rounded-md border border-border overflow-hidden'>
        <button
          type='button'
          className='flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors'
          onClick={() => setExpanded(p => !p)}
        >
          <span className='flex items-center gap-2'>
            <Receipt className='h-4 w-4 text-muted-foreground' />
            Facturas / Pagos de adquisición
            {hasInvoices && (
              <Badge variant='secondary' className='text-xs'>
                {invoices.filter(i => i.status !== 'CANCELLED').length}
              </Badge>
            )}
            {invoices.some(i => i.status === 'OVERDUE') && (
              <Badge variant='destructive' className='text-xs'>
                Vencido
              </Badge>
            )}
          </span>
          <div className='flex items-center gap-2'>
            {hasInvoices && (
              <span className='text-xs text-muted-foreground hidden sm:block'>
                {fmtCurrency(totals.paid, currency)} pagado
                {totals.pending > 0 && ` · ${fmtCurrency(totals.pending, currency)} pendiente`}
              </span>
            )}
            {expanded ? <ChevronUp className='h-4 w-4' /> : <ChevronDown className='h-4 w-4' />}
          </div>
        </button>

        {expanded && (
          <div className='border-t border-border px-4 py-4 space-y-4'>
            {/* Cabecera con acción */}
            <div className='flex items-center justify-between'>
              <p className='text-xs text-muted-foreground'>
                {hasInvoices
                  ? `${invoices.length} factura(s) registrada(s) — Total: ${fmtCurrency(totals.total, currency)}`
                  : 'Sin facturas registradas aún.'}
              </p>
              {canManage && (
                <Button type='button' size='sm' variant='outline' onClick={openCreate}>
                  <Plus className='h-3.5 w-3.5 mr-1.5' />
                  Registrar factura
                </Button>
              )}
            </div>

            {/* Lista */}
            {loading ? (
              <div className='flex items-center justify-center py-6 text-muted-foreground gap-2'>
                <Loader2 className='h-4 w-4 animate-spin' />
                <span className='text-sm'>Cargando facturas…</span>
              </div>
            ) : hasInvoices ? (
              <div className='rounded-md border overflow-hidden'>
                <table className='w-full text-sm'>
                  <thead className='bg-muted/50 text-left text-xs text-muted-foreground'>
                    <tr>
                      <th className='px-3 py-2 font-medium'>Factura / OC</th>
                      <th className='px-3 py-2 font-medium'>Proveedor</th>
                      <th className='px-3 py-2 font-medium'>Monto</th>
                      <th className='px-3 py-2 font-medium'>Vencimiento</th>
                      <th className='px-3 py-2 font-medium'>Estado</th>
                      {canManage && <th className='px-3 py-2 font-medium' />}
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(inv => {
                      const cfg = STATUS_CONFIG[inv.status]
                      const Icon = cfg.icon
                      return (
                        <tr key={inv.id} className='border-t hover:bg-muted/30 transition-colors'>
                          <td className='px-3 py-2'>
                            <p className='font-mono text-xs font-medium'>
                              {inv.invoiceNumber ?? '—'}
                            </p>
                            {inv.purchaseOrderNumber && (
                              <p className='text-xs text-muted-foreground'>
                                OC: {inv.purchaseOrderNumber}
                              </p>
                            )}
                          </td>
                          <td className='px-3 py-2 text-xs'>
                            {inv.supplier?.name ?? inv.supplierName ?? '—'}
                          </td>
                          <td className='px-3 py-2 whitespace-nowrap font-medium'>
                            {fmtCurrency(inv.amount, inv.currency)}
                          </td>
                          <td className='px-3 py-2 whitespace-nowrap text-xs'>
                            {inv.status === 'PAID' ? (
                              <span className='text-muted-foreground'>
                                Pagado: {fmtDate(inv.paidDate)}
                              </span>
                            ) : (
                              fmtDate(inv.dueDate)
                            )}
                          </td>
                          <td className='px-3 py-2'>
                            <Badge variant={cfg.variant} className='gap-1 text-xs'>
                              <Icon className='h-3 w-3' />
                              {cfg.label}
                            </Badge>
                          </td>
                          {canManage && (
                            <td className='px-3 py-2'>
                              <div className='flex items-center gap-1 justify-end'>
                                {(inv.status === 'PENDING' || inv.status === 'OVERDUE') && (
                                  <Button
                                    type='button'
                                    size='sm'
                                    variant='outline'
                                    className='h-7 text-xs'
                                    onClick={() => openMarkPaid(inv)}
                                  >
                                    <CheckCircle2 className='h-3 w-3 mr-1' />
                                    Pagar
                                  </Button>
                                )}
                                <button
                                  type='button'
                                  onClick={() => openEdit(inv)}
                                  className='p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors'
                                  title='Editar'
                                >
                                  <Pencil className='h-3.5 w-3.5' />
                                </button>
                                <button
                                  type='button'
                                  onClick={() => setDeleting(inv)}
                                  className='p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors'
                                  title='Eliminar'
                                >
                                  <Trash2 className='h-3.5 w-3.5' />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              canManage && (
                <button
                  type='button'
                  onClick={openCreate}
                  className='w-full rounded-md border border-dashed border-border py-6 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors'
                >
                  <Plus className='h-4 w-4 mx-auto mb-1' />
                  Registrar primera factura
                </button>
              )
            )}
          </div>
        )}
      </div>

      {/* ── Dialog: crear / editar factura ───────────────────────────────── */}
      <Dialog open={showForm} onOpenChange={open => !open && setShowForm(false)}>
        <DialogContent className='max-w-lg max-h-[92vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Editar factura' : 'Registrar factura / pago de adquisición'}
            </DialogTitle>
          </DialogHeader>

          <div className='space-y-4 py-1'>
            {/* Fila 1: Monto + Moneda */}
            <div className='grid grid-cols-3 gap-3'>
              <div className='col-span-2 space-y-1'>
                <Label htmlFor='inv-amount'>
                  Monto <span className='text-destructive'>*</span>
                </Label>
                <Input
                  id='inv-amount'
                  type='number'
                  min='0.01'
                  step='0.01'
                  placeholder='0.00'
                  value={form.amount}
                  onChange={e => setField('amount', e.target.value)}
                />
              </div>
              <div className='space-y-1'>
                <Label htmlFor='inv-currency'>Moneda</Label>
                <CurrencySelect
                  id='inv-currency'
                  value={form.currency}
                  onChange={v => setField('currency', v)}
                  labelStyle='code'
                />
              </div>
            </div>

            {/* Fila 2: N° Factura + N° OC */}
            <div className='grid grid-cols-2 gap-3'>
              <div className='space-y-1'>
                <Label htmlFor='inv-number'>N° Factura</Label>
                <Input
                  id='inv-number'
                  placeholder='FAC-001'
                  value={form.invoiceNumber}
                  onChange={e => setField('invoiceNumber', e.target.value)}
                  maxLength={100}
                />
              </div>
              <div className='space-y-1'>
                <Label htmlFor='inv-po'>N° Orden de Compra</Label>
                <Input
                  id='inv-po'
                  placeholder='OC-001'
                  value={form.purchaseOrderNumber}
                  onChange={e => setField('purchaseOrderNumber', e.target.value)}
                  maxLength={100}
                />
              </div>
            </div>

            {/* Fila 3: Fecha vencimiento + Fecha pago */}
            <div className='grid grid-cols-2 gap-3'>
              <div className='space-y-1'>
                <Label htmlFor='inv-due'>Fecha de vencimiento</Label>
                <DateInput
                  id='inv-due'
                  value={form.dueDate}
                  onChange={e => setField('dueDate', e.target.value)}
                  clearable
                />
              </div>
              <div className='space-y-1'>
                <Label htmlFor='inv-paid'>Fecha de pago</Label>
                <DateInput
                  id='inv-paid'
                  value={form.paidDate}
                  onChange={e => setField('paidDate', e.target.value)}
                  clearable
                />
                <p className='text-xs text-muted-foreground'>Dejar vacío si aún no se paga.</p>
              </div>
            </div>

            {/* Proveedor */}
            <div className='space-y-1'>
              <Label>Proveedor</Label>
              <SupplierSelect
                value={form.supplierId || null}
                onChange={v => setField('supplierId', v ?? '')}
              />
              <p className='text-xs text-muted-foreground'>
                O escribe el nombre si no está en el catálogo:
              </p>
              <Input
                placeholder='Nombre libre del proveedor'
                value={form.supplierName}
                onChange={e => setField('supplierName', e.target.value)}
                maxLength={200}
                disabled={!!form.supplierId}
              />
            </div>

            {/* Método de pago */}
            <div className='space-y-1'>
              <Label htmlFor='inv-method'>Método de pago</Label>
              <Select
                value={form.paymentMethod || '__none__'}
                onValueChange={v => setField('paymentMethod', v === '__none__' ? '' : v)}
              >
                <SelectTrigger id='inv-method'>
                  <SelectValue placeholder='Seleccionar método' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='__none__'>Sin especificar</SelectItem>
                  {(
                    Object.entries(PAYMENT_METHOD_TYPE_LABELS) as [PaymentMethodType, string][]
                  ).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Referencia + Banco (condicional) */}
            <div className='grid grid-cols-2 gap-3'>
              <div className='space-y-1'>
                <Label htmlFor='inv-ref'>N° Referencia / Transacción</Label>
                <Input
                  id='inv-ref'
                  placeholder='REF-12345'
                  value={form.referenceNumber}
                  onChange={e => setField('referenceNumber', e.target.value)}
                  maxLength={200}
                />
              </div>
              <div className='space-y-1'>
                <Label htmlFor='inv-bank'>Banco / Entidad</Label>
                <Input
                  id='inv-bank'
                  placeholder='Banco XYZ'
                  value={form.bankEntity}
                  onChange={e => setField('bankEntity', e.target.value)}
                  maxLength={100}
                />
              </div>
            </div>

            {/* Card last4 (si método es tarjeta) */}
            {form.paymentMethod === 'CORPORATE_CARD' && (
              <div className='space-y-1'>
                <Label htmlFor='inv-card4'>Últimos 4 dígitos tarjeta</Label>
                <Input
                  id='inv-card4'
                  placeholder='1234'
                  value={form.cardLast4}
                  onChange={e =>
                    setField('cardLast4', e.target.value.replace(/\D/g, '').slice(0, 4))
                  }
                  maxLength={4}
                  className='w-24'
                />
              </div>
            )}

            {/* Notas */}
            <div className='space-y-1'>
              <Label htmlFor='inv-notes'>Notas</Label>
              <Textarea
                id='inv-notes'
                rows={2}
                placeholder='Observaciones opcionales…'
                value={form.notes}
                onChange={e => setField('notes', e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type='button' variant='outline' onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button type='button' onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                  Guardando…
                </>
              ) : editing ? (
                'Actualizar'
              ) : (
                'Registrar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: marcar como pagado ────────────────────────────────────── */}
      <Dialog open={!!markingPaid} onOpenChange={open => !open && setMarkingPaid(null)}>
        <DialogContent className='max-w-sm'>
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
          </DialogHeader>
          {markingPaid && (
            <div className='space-y-3'>
              <p className='text-sm text-muted-foreground'>
                {markingPaid.invoiceNumber ?? 'Factura'} ·{' '}
                <span className='font-medium'>
                  {fmtCurrency(markingPaid.amount, markingPaid.currency)}
                </span>
              </p>
              <div className='space-y-1'>
                <Label>Fecha de pago</Label>
                <DateInput value={paidDate} onChange={e => setPaidDate(e.target.value)} />
              </div>
              <div className='space-y-1'>
                <Label>Método de pago</Label>
                <Select
                  value={paidMethod || '__none__'}
                  onValueChange={v => setPaidMethod(v === '__none__' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Seleccionar método' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='__none__'>Sin especificar</SelectItem>
                    {(
                      Object.entries(PAYMENT_METHOD_TYPE_LABELS) as [PaymentMethodType, string][]
                    ).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type='button' variant='outline' onClick={() => setMarkingPaid(null)}>
              Cancelar
            </Button>
            <Button type='button' onClick={handleMarkPaid} disabled={saving}>
              {saving ? <Loader2 className='h-4 w-4 animate-spin' /> : 'Confirmar pago'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── AlertDialog: confirmar eliminar ──────────────────────────────── */}
      <AlertDialog open={!!deleting} onOpenChange={open => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta factura?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.invoiceNumber
                ? `Se eliminará la factura ${deleting.invoiceNumber} por ${fmtCurrency(deleting.amount, deleting.currency)}.`
                : `Se eliminará el registro de ${fmtCurrency(deleting?.amount ?? 0, deleting?.currency ?? 'USD')}.`}{' '}
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={saving}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {saving ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
