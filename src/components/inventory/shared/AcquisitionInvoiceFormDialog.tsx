'use client'

/**
 * AcquisitionInvoiceFormDialog — el único modal para "registrar factura" o
 * "editar factura" de adquisición (equipo o licencia) en toda la app.
 *
 * Reemplaza dos implementaciones que existían por separado: la de la ficha
 * del activo (AcquisitionInvoicesCard, con Pago único / Plan de cuotas) y la
 * versión reescrita a mano en la página global de Pagos (solo pago único, sin
 * proveedor editable). Acá conviven ambos casos de uso:
 *
 *  · Activo fijo (assetType + assetId dados) — ficha del equipo/licencia, no
 *    hace falta elegir el activo. Es el único caso que admite edición.
 *  · Activo a elegir (assetType/assetId omitidos) — página de Pagos: primero
 *    se busca y elige el equipo o licencia, y a partir de ahí es exactamente
 *    el mismo formulario (Plan de cuotas incluido, que antes solo existía
 *    entrando por la ficha del activo).
 */

import { useEffect, useState } from 'react'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { CurrencySelect } from '@/components/ui/currency-select'
import { DateInput } from '@/components/ui/date-input'
import { SupplierSelect } from '@/components/inventory/suppliers/SupplierSelect'
import { BankEntitySelect } from '@/components/inventory/shared/BankEntitySelect'
import { inventoryToast as toast } from '@/lib/utils/inventory-toast'
import { PAYMENT_METHOD_TYPE_LABELS, type PaymentMethodType } from '@/types/contracts'
import {
  ACQUISITION_INVOICE_API,
  fmtAcquisitionCurrency,
  type AcquisitionAssetType,
  type AcquisitionInvoice,
} from './acquisition-invoices'

interface CuotaRow {
  amount: string
  dueDate: string
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

const EMPTY_CUOTAS: CuotaRow[] = [
  { amount: '', dueDate: '' },
  { amount: '', dueDate: '' },
]

interface PickedAsset {
  id: string
  kind: AcquisitionAssetType
  label: string
}

interface AcquisitionInvoiceFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void | Promise<void>
  /** Activo fijo — cuando se dan, no se muestra el buscador. Omitirlos
   * muestra un paso previo para elegir equipo o licencia. */
  assetType?: AcquisitionAssetType
  assetId?: string
  defaultSupplierId?: string | null
  defaultSupplierName?: string | null
  /** Factura a editar — requiere assetType/assetId fijos. */
  editing?: AcquisitionInvoice | null
  /** Factura de pago único (sin abonos) a convertir en plan de cuotas —
   * requiere assetType/assetId fijos, y es excluyente con `editing`. El
   * formulario se reduce a elegir las cuotas: proveedor/moneda/N° de
   * factura/OC se heredan tal cual de la factura original, no se retipean
   * (evita que un dato "corregido" acá quede desincronizado del que de
   * verdad persiste el backend). */
  convertingInvoice?: AcquisitionInvoice | null
}

export function AcquisitionInvoiceFormDialog({
  open,
  onOpenChange,
  onSaved,
  assetType,
  assetId,
  defaultSupplierId = null,
  defaultSupplierName = null,
  editing = null,
  convertingInvoice = null,
}: AcquisitionInvoiceFormDialogProps) {
  const hasFixedAsset = !!assetType && !!assetId
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [createMode, setCreateMode] = useState<'single' | 'schedule'>('single')
  const [cuotas, setCuotas] = useState<CuotaRow[]>(EMPTY_CUOTAS)
  const [scheduleTotal, setScheduleTotal] = useState('')
  const [scheduleCount, setScheduleCount] = useState('')
  const [scheduleFirst, setScheduleFirst] = useState('')

  // ── Selección de activo (solo cuando no viene fijo) ──────────────────────
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerResults, setPickerResults] = useState<
    { id: string; kind: AcquisitionAssetType; label: string }[]
  >([])
  const [pickerSearching, setPickerSearching] = useState(false)
  const [pickedAsset, setPickedAsset] = useState<PickedAsset | null>(null)

  const effectiveAssetType = assetType ?? pickedAsset?.kind ?? null
  const effectiveAssetId = assetId ?? pickedAsset?.id ?? null

  // Reinicia el formulario cada vez que se abre.
  useEffect(() => {
    if (!open) return
    setCreateMode(convertingInvoice ? 'schedule' : 'single')
    setCuotas(EMPTY_CUOTAS)
    setScheduleTotal(convertingInvoice ? String(convertingInvoice.amount) : '')
    setScheduleCount('')
    setScheduleFirst('')
    setPickerQuery('')
    setPickerResults([])
    setPickedAsset(null)

    if (editing) {
      setForm({
        invoiceNumber: editing.invoiceNumber ?? '',
        purchaseOrderNumber: editing.purchaseOrderNumber ?? '',
        amount: String(editing.amount),
        currency: editing.currency,
        dueDate: editing.dueDate ? editing.dueDate.substring(0, 10) : '',
        paidDate: editing.paidDate ? editing.paidDate.substring(0, 10) : '',
        paymentMethod: editing.paymentMethod ?? '',
        supplierId: editing.supplierId ?? '',
        supplierName: editing.supplierName ?? '',
        referenceNumber: editing.referenceNumber ?? '',
        bankEntity: editing.bankEntity ?? '',
        cardLast4: editing.cardLast4 ?? '',
        notes: editing.notes ?? '',
      })
    } else if (convertingInvoice) {
      setForm({
        ...EMPTY_FORM,
        invoiceNumber: convertingInvoice.invoiceNumber ?? '',
        purchaseOrderNumber: convertingInvoice.purchaseOrderNumber ?? '',
        currency: convertingInvoice.currency,
        supplierId: convertingInvoice.supplierId ?? '',
        supplierName: convertingInvoice.supplierName ?? convertingInvoice.supplier?.name ?? '',
      })
    } else {
      setForm({
        ...EMPTY_FORM,
        supplierId: defaultSupplierId ?? '',
        supplierName: defaultSupplierName ?? '',
      })
    }
  }, [open, editing, convertingInvoice, defaultSupplierId, defaultSupplierName])

  // ── Buscador de activo (modo sin activo fijo) ────────────────────────────
  useEffect(() => {
    if (!open || hasFixedAsset || pickedAsset) return
    const q = pickerQuery.trim()
    if (q.length < 2) {
      setPickerResults([])
      return
    }
    const t = setTimeout(async () => {
      setPickerSearching(true)
      try {
        const res = await fetch(`/api/inventory/assets?search=${encodeURIComponent(q)}&pageSize=15`)
        const json = await res.json()
        const items = (json.items ?? []).filter(
          (i: { subtype: string }) => i.subtype === 'EQUIPMENT' || i.subtype === 'LICENSE'
        )
        setPickerResults(
          items.map((i: { id: string; subtype: string; code?: string; name: string }) => ({
            id: i.id,
            kind: i.subtype === 'LICENSE' ? ('license' as const) : ('equipment' as const),
            label: i.code ? `${i.code} — ${i.name}` : i.name,
          }))
        )
      } catch {
        setPickerResults([])
      } finally {
        setPickerSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [pickerQuery, open, hasFixedAsset, pickedAsset])

  async function selectAsset(item: { id: string; kind: AcquisitionAssetType; label: string }) {
    setPickedAsset(item)
    setPickerQuery(item.label)
    setPickerResults([])
    // Proveedor pre-llenado desde el activo — mismo criterio que el activo fijo.
    try {
      const res = await fetch(
        item.kind === 'license'
          ? `/api/inventory/licenses/${item.id}`
          : `/api/inventory/equipment/${item.id}`
      )
      const json = await res.json()
      const supplier = item.kind === 'license' ? json.supplier : json.equipment?.supplier
      const supplierId = item.kind === 'license' ? json.supplier?.id : json.equipment?.supplierId
      setForm(f => ({ ...f, supplierId: supplierId ?? '', supplierName: supplier?.name ?? '' }))
    } catch {
      // proveedor queda vacío — no bloquea el registro
    }
  }

  function setField(k: keyof FormState, v: string) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  function setCuotaField(idx: number, key: keyof CuotaRow, value: string) {
    setCuotas(prev => prev.map((c, i) => (i === idx ? { ...c, [key]: value } : c)))
  }

  function addCuotaRow() {
    setCuotas(prev => [...prev, { amount: '', dueDate: '' }])
  }

  function removeCuotaRow(idx: number) {
    setCuotas(prev => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== idx)))
  }

  /** Relleno rápido: no persiste como campo — solo pre-llena las filas de
   * cuotas de abajo, que siguen siendo editables a mano después. */
  function distributeSchedule() {
    const total = Number(scheduleTotal)
    if (!total || total <= 0) {
      toast.error('Ingresa un total mayor a 0 para distribuir')
      return
    }
    const n = Math.max(2, Math.round(Number(scheduleCount)) || cuotas.length)
    const first = scheduleFirst ? Number(scheduleFirst) : total / n
    const restCount = n - 1
    const restEach = restCount > 0 ? Math.round(((total - first) / restCount) * 100) / 100 : 0

    const rows: CuotaRow[] = []
    for (let i = 0; i < n; i++) {
      const due = new Date()
      due.setDate(1)
      due.setMonth(due.getMonth() + i + 1)
      let amount: number
      if (i === 0) amount = Math.round(first * 100) / 100
      else if (i === n - 1) {
        // La última cuota absorbe el redondeo de centavos de las anteriores.
        const sumSoFar = Math.round(first * 100) / 100 + restEach * (n - 2)
        amount = Math.round((total - sumSoFar) * 100) / 100
      } else {
        amount = restEach
      }
      rows.push({ amount: amount.toFixed(2), dueDate: due.toISOString().slice(0, 10) })
    }
    setCuotas(rows)
  }

  const scheduleSum = cuotas.reduce((s, c) => s + (Number(c.amount) || 0), 0)

  async function handleSave() {
    if (!effectiveAssetType || !effectiveAssetId) {
      toast.error('Elige un equipo o licencia')
      return
    }
    const endpoints = ACQUISITION_INVOICE_API[effectiveAssetType]

    // ── Validación común del plan de cuotas (crear o convertir) ───────────
    if (createMode === 'schedule' && !editing) {
      if (cuotas.length < 2) {
        toast.error('Un plan de cuotas necesita al menos 2 cuotas')
        return
      }
      for (const c of cuotas) {
        if (!c.amount || Number(c.amount) <= 0) {
          toast.error('Cada cuota debe tener un monto mayor a 0')
          return
        }
        if (!c.dueDate) {
          toast.error('Cada cuota debe tener una fecha de vencimiento')
          return
        }
      }
      setSaving(true)
      try {
        const res = convertingInvoice
          ? await fetch(endpoints.convertToSchedule(convertingInvoice.id), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                installments: cuotas.map(c => ({ amount: Number(c.amount), dueDate: c.dueDate })),
              }),
            })
          : await fetch(endpoints.list(effectiveAssetId), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                invoiceNumber: form.invoiceNumber || null,
                purchaseOrderNumber: form.purchaseOrderNumber || null,
                currency: form.currency || 'USD',
                supplierId: form.supplierId || null,
                supplierName: form.supplierName || null,
                notes: form.notes || null,
                installments: cuotas.map(c => ({ amount: Number(c.amount), dueDate: c.dueDate })),
              }),
            })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || 'Error al guardar')
        toast.success(
          convertingInvoice
            ? `Convertida a plan de ${cuotas.length} cuotas`
            : `Plan de ${cuotas.length} cuotas registrado`
        )
        onOpenChange(false)
        await onSaved()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Error al guardar')
      } finally {
        setSaving(false)
      }
      return
    }

    // ── Pago único (comportamiento de siempre) ───────────────────────────
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

      const res = editing
        ? await fetch(endpoints.item(editing.id), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch(endpoints.list(effectiveAssetId), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Error al guardar')

      toast.success(editing ? 'Factura actualizada' : 'Factura registrada')
      onOpenChange(false)
      await onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const needsPicker = !hasFixedAsset && !editing && !convertingInvoice
  const showForm = !needsPicker || !!pickedAsset

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='w-[min(95vw,42rem)] max-w-2xl max-h-[92vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>
            {convertingInvoice
              ? 'Convertir a plan de cuotas'
              : editing
                ? 'Editar factura'
                : 'Registrar factura'}
          </DialogTitle>
        </DialogHeader>

        <div className='space-y-4 py-1'>
          {needsPicker && (
            <div className='space-y-1'>
              <Label>
                Equipo o licencia <span className='text-destructive'>*</span>
              </Label>
              <Input
                placeholder='Buscar por código, marca o nombre…'
                value={pickerQuery}
                onChange={e => {
                  setPickerQuery(e.target.value)
                  setPickedAsset(null)
                }}
              />
              {pickerSearching && <p className='text-xs text-muted-foreground'>Buscando…</p>}
              {!pickedAsset && pickerResults.length > 0 && (
                <ul className='rounded-md border divide-y max-h-40 overflow-y-auto text-sm'>
                  {pickerResults.map(item => (
                    <li key={`${item.kind}-${item.id}`}>
                      <button
                        type='button'
                        onClick={() => selectAsset(item)}
                        className='w-full text-left px-3 py-1.5 hover:bg-muted transition-colors flex items-center justify-between gap-2'
                      >
                        <span>{item.label}</span>
                        <Badge variant='secondary' className='text-xs shrink-0'>
                          {item.kind === 'license' ? 'Licencia' : 'Equipo'}
                        </Badge>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {pickedAsset && (
                <p className='text-xs text-muted-foreground'>
                  Activo seleccionado — {pickedAsset.kind === 'license' ? 'Licencia' : 'Equipo'}
                  {form.supplierName && ` · Proveedor: ${form.supplierName}`}
                </p>
              )}
            </div>
          )}

          {showForm && (
            <>
              {!editing && !convertingInvoice && (
                <div className='flex rounded-md border p-1 gap-1'>
                  <button
                    type='button'
                    onClick={() => setCreateMode('single')}
                    className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                      createMode === 'single'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    Pago único
                  </button>
                  <button
                    type='button'
                    onClick={() => setCreateMode('schedule')}
                    className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                      createMode === 'schedule'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    Plan de cuotas
                  </button>
                </div>
              )}

              {convertingInvoice && (
                <div className='space-y-1'>
                  <div className='rounded-md bg-muted/50 px-3 py-2 text-sm space-y-0.5'>
                    <p className='font-medium font-mono text-xs'>
                      {convertingInvoice.invoiceNumber ?? 'Factura'}
                      {convertingInvoice.purchaseOrderNumber &&
                        ` · OC: ${convertingInvoice.purchaseOrderNumber}`}
                    </p>
                    <p className='text-muted-foreground text-xs'>
                      {convertingInvoice.supplier?.name ??
                        convertingInvoice.supplierName ??
                        'Sin proveedor'}
                    </p>
                    <p className='font-semibold'>
                      {fmtAcquisitionCurrency(convertingInvoice.amount, convertingInvoice.currency)}
                    </p>
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Se reemplaza esta factura de pago único por las cuotas de abajo — proveedor,
                    moneda, N° de factura y OC se mantienen igual.
                  </p>
                </div>
              )}

              {!convertingInvoice &&
                (editing || createMode === 'single' ? (
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
                      />
                    </div>
                  </div>
                ) : (
                  <div className='space-y-1 max-w-[10rem]'>
                    <Label htmlFor='inv-currency-schedule'>Moneda</Label>
                    <CurrencySelect
                      id='inv-currency-schedule'
                      value={form.currency}
                      onChange={v => setField('currency', v)}
                    />
                  </div>
                ))}

              {!convertingInvoice && (
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
              )}

              {editing ? (
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
              ) : createMode === 'single' ? (
                /* Sin fecha de pago al crear: toda factura nueva empieza
                 * PENDIENTE — pagarla es una acción aparte ("Pagar"). */
                <div className='space-y-1 max-w-[13rem]'>
                  <Label htmlFor='inv-due'>Fecha de vencimiento</Label>
                  <DateInput
                    id='inv-due'
                    value={form.dueDate}
                    onChange={e => setField('dueDate', e.target.value)}
                    clearable
                  />
                </div>
              ) : null}

              {!convertingInvoice && (
                <div className='space-y-1'>
                  <Label>Proveedor</Label>
                  <SupplierSelect
                    value={form.supplierId || null}
                    onChange={v => setField('supplierId', v ?? '')}
                  />
                </div>
              )}

              {editing && (
                <>
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
                          Object.entries(PAYMENT_METHOD_TYPE_LABELS) as [
                            PaymentMethodType,
                            string,
                          ][]
                        ).map(([key, label]) => (
                          <SelectItem key={key} value={key}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

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
                      <BankEntitySelect
                        value={form.bankEntity}
                        onChange={v => setField('bankEntity', v)}
                      />
                    </div>
                  </div>

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
                </>
              )}

              {!editing && createMode === 'schedule' && (
                /* Plan de cuotas: cada cuota empieza sin pagar — el método de
                 * pago se registra después, al abonar cada una. */
                <div className='space-y-3 rounded-md border p-3'>
                  <p className='text-sm font-medium'>Cuotas</p>

                  <div className='grid grid-cols-3 gap-2'>
                    <div className='space-y-1'>
                      <Label className='text-xs'>Total</Label>
                      <Input
                        type='number'
                        min='0.01'
                        step='0.01'
                        placeholder='0.00'
                        value={scheduleTotal}
                        onChange={e => setScheduleTotal(e.target.value)}
                      />
                    </div>
                    <div className='space-y-1'>
                      <Label className='text-xs'>N° de cuotas</Label>
                      <Input
                        type='number'
                        min='2'
                        step='1'
                        placeholder={String(cuotas.length)}
                        value={scheduleCount}
                        onChange={e => setScheduleCount(e.target.value)}
                      />
                    </div>
                    <div className='space-y-1'>
                      <Label className='text-xs'>Primera cuota (opcional)</Label>
                      <Input
                        type='number'
                        min='0.01'
                        step='0.01'
                        placeholder='Igual al resto'
                        value={scheduleFirst}
                        onChange={e => setScheduleFirst(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button type='button' size='sm' variant='outline' onClick={distributeSchedule}>
                    Distribuir
                  </Button>
                  <p className='text-xs text-muted-foreground'>
                    Pre-llena las filas de abajo — siguen siendo editables a mano.
                  </p>

                  <div className='space-y-2'>
                    {cuotas.map((c, idx) => (
                      <div key={idx} className='flex items-center gap-2'>
                        <span className='text-xs text-muted-foreground w-14 shrink-0'>
                          Cuota {idx + 1}
                        </span>
                        <Input
                          type='number'
                          min='0.01'
                          step='0.01'
                          placeholder='Monto'
                          value={c.amount}
                          onChange={e => setCuotaField(idx, 'amount', e.target.value)}
                        />
                        <DateInput
                          value={c.dueDate}
                          onChange={e => setCuotaField(idx, 'dueDate', e.target.value)}
                        />
                        <button
                          type='button'
                          onClick={() => removeCuotaRow(idx)}
                          disabled={cuotas.length <= 2}
                          className='p-1 rounded text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed transition-colors'
                          title='Quitar cuota'
                        >
                          <Trash2 className='h-3.5 w-3.5' />
                        </button>
                      </div>
                    ))}
                  </div>
                  <Button type='button' size='sm' variant='ghost' onClick={addCuotaRow}>
                    <Plus className='h-3.5 w-3.5 mr-1' />
                    Agregar cuota
                  </Button>

                  <p className='text-sm font-medium text-right'>
                    Total del plan: {fmtAcquisitionCurrency(scheduleSum, form.currency)} (
                    {cuotas.length} cuotas)
                  </p>
                </div>
              )}

              {!convertingInvoice && (
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
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type='button' onClick={handleSave} disabled={saving || !showForm}>
            {saving ? (
              <>
                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                Guardando…
              </>
            ) : editing ? (
              'Actualizar'
            ) : convertingInvoice ? (
              'Convertir'
            ) : createMode === 'schedule' ? (
              'Registrar plan'
            ) : (
              'Registrar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
