'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DateInput } from '@/components/ui/date-input'
import { SimpleSelect } from '@/components/ui/simple-select'
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CurrencySelect } from '@/components/ui/currency-select'
import { AssignableUserSelect } from '@/components/inventory/shared/AssignableUserSelect'
import { SupplierSelect } from '@/components/inventory/suppliers/SupplierSelect'
import { BankEntitySelect } from '@/components/inventory/shared/BankEntitySelect'
import { useFetch } from '@/hooks/common/use-fetch'
import { Loader2 } from 'lucide-react'
import { PAYMENT_METHOD_TYPE_LABELS, type PaymentMethodType } from '@/types/contracts'

type MovementKind = 'ENTRY' | 'EXIT' | 'ADJUSTMENT'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  consumableId: string
  consumableName: string
  currentStock: number
  unit: string
  defaultType?: MovementKind
  /** familyId del suministro — filtra usuarios/equipos del destinatario. */
  familyId?: string | null
  /** Equipo ya vinculado al suministro (assignedEquipmentId), si existe — se preselecciona
   * como destinatario por ser el caso más común (p. ej. tóner ya ligado a una impresora). */
  defaultEquipment?: { id: string; code: string; brand?: string | null } | null
  onSaved: () => void
}

const TYPE_OPTIONS = [
  { value: 'ENTRY', label: 'Entrada (compra / ingreso)' },
  { value: 'EXIT', label: 'Salida (consumo / uso)' },
  { value: 'ADJUSTMENT', label: 'Ajuste (dejar stock en…)' },
]

const EXIT_REASON_PRESETS = [
  'Consumo diario personal',
  'Consumo semanal',
  'Evento / reunión',
  'Otro uso',
]

function todayYmd() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function daysAgoYmd(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function StockMovementDialog({
  open,
  onOpenChange,
  consumableId,
  consumableName,
  currentStock,
  unit,
  defaultType = 'EXIT',
  familyId,
  defaultEquipment,
  onSaved,
}: Props) {
  const [type, setType] = useState<MovementKind>(defaultType)
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [occurredAt, setOccurredAt] = useState(todayYmd())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRecipient, setShowRecipient] = useState(false)
  const [recipientUserId, setRecipientUserId] = useState('')
  const [recipientEquipmentId, setRecipientEquipmentId] = useState('')

  // Datos de compra (opcional) — solo aplica a Entrada. Evita tener que
  // registrar la factura por separado: cantidad + costo + factura quedan en
  // una sola acción, y costPerUnit/proveedor del suministro se recalculan
  // solos desde acá.
  const [showPurchase, setShowPurchase] = useState(false)
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState('')
  const [purchaseSupplierId, setPurchaseSupplierId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [bankEntity, setBankEntity] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [cardLast4, setCardLast4] = useState('')

  useEffect(() => {
    if (!open) return
    setType(defaultType)
    setQuantity('')
    setReason(defaultType === 'EXIT' ? 'Consumo diario personal' : '')
    setOccurredAt(todayYmd())
    setError(null)
    setShowRecipient(false)
    setRecipientUserId('')
    // Preseleccionar el equipo ya vinculado al suministro — caso más común.
    setRecipientEquipmentId(defaultEquipment?.id ?? '')
    setShowPurchase(false)
    setAmount('')
    setCurrency('USD')
    setInvoiceNumber('')
    setPurchaseOrderNumber('')
    setPurchaseSupplierId('')
    setPaymentMethod('')
    setBankEntity('')
    setReferenceNumber('')
    setCardLast4('')
  }, [open, defaultType, defaultEquipment])

  const { data: equipmentRows, loading: loadingEquipment } = useFetch<{
    id: string
    code?: string
    brand?: string
  }>(
    familyId
      ? `/api/inventory/assets?familyId=${familyId}&subtype=EQUIPMENT&pageSize=100`
      : '/api/inventory/assets?subtype=EQUIPMENT&pageSize=100',
    {
      enabled: open && showRecipient && !!familyId,
      transform: d => d.items ?? d.assets ?? [],
      showErrorToast: false,
    }
  )
  const equipmentOptions: SearchableSelectOption[] = (() => {
    const rows = equipmentRows.map(e => ({
      id: e.id,
      name: [e.code, e.brand].filter(Boolean).join(' · ') || e.id,
    }))
    // El equipo por defecto puede no venir en la primera página del listado — se agrega
    // aparte para que siempre aparezca seleccionable aunque no calce en pageSize=100.
    if (defaultEquipment && !rows.some(r => r.id === defaultEquipment.id)) {
      rows.unshift({
        id: defaultEquipment.id,
        name: [defaultEquipment.code, defaultEquipment.brand].filter(Boolean).join(' · '),
      })
    }
    return rows
  })()

  const qty = Number(quantity)
  const previewStock =
    type === 'ENTRY'
      ? currentStock + (Number.isFinite(qty) ? qty : 0)
      : type === 'EXIT'
        ? currentStock - (Number.isFinite(qty) ? qty : 0)
        : Number.isFinite(qty)
          ? qty
          : currentStock

  const handleSubmit = async () => {
    setError(null)
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Ingresa una cantidad mayor a 0.')
      return
    }
    if (type === 'EXIT' && qty > currentStock) {
      setError(`Stock insuficiente (disponible: ${currentStock} ${unit}).`)
      return
    }
    if (!occurredAt) {
      setError('Selecciona la fecha del movimiento.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/consumables/${consumableId}/movements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          quantity: qty,
          reason: reason.trim() || undefined,
          occurredAt,
          assignedToUserId: showRecipient ? recipientUserId || undefined : undefined,
          assignedToEquipmentId: showRecipient ? recipientEquipmentId || undefined : undefined,
          ...(type === 'ENTRY' && showPurchase && amount
            ? {
                amount: Number(amount),
                currency: currency || 'USD',
                invoiceNumber: invoiceNumber || undefined,
                purchaseOrderNumber: purchaseOrderNumber || undefined,
                supplierId: purchaseSupplierId || undefined,
                paymentMethod: paymentMethod || undefined,
                bankEntity: bankEntity || undefined,
                referenceNumber: referenceNumber || undefined,
                cardLast4: cardLast4 || undefined,
              }
            : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'No se pudo registrar el movimiento')
      onSaved()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md max-h-[92vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>{type === 'EXIT' ? 'Registrar consumo' : 'Movimiento de stock'}</DialogTitle>
          <DialogDescription>
            {consumableName} · Actual: {currentStock} {unit}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-1'>
          <div className='space-y-2'>
            <Label>Tipo</Label>
            <SimpleSelect
              value={type}
              onChange={e => setType(e.target.value as MovementKind)}
              options={TYPE_OPTIONS}
            />
          </div>

          <div className='space-y-2'>
            <Label>Fecha</Label>
            <DateInput
              value={occurredAt}
              onChange={e => setOccurredAt(e.target.value)}
              max={todayYmd()}
              min={daysAgoYmd(90)}
            />
            <p className='text-xs text-muted-foreground'>
              Puedes registrar un consumo de días anteriores (hasta 90 días) si se olvidó anotar.
            </p>
          </div>

          <div className='space-y-2'>
            <Label>{type === 'ADJUSTMENT' ? 'Nuevo stock' : 'Cantidad'}</Label>
            <Input
              type='number'
              min={0}
              step='any'
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder={
                type === 'ADJUSTMENT'
                  ? `Ej. ${currentStock}`
                  : type === 'EXIT'
                    ? 'Ej. 1 (botellón del día)'
                    : 'Ej. 10'
              }
            />
            <p className='text-xs text-muted-foreground'>
              Quedará en{' '}
              <span className='font-medium tabular-nums'>
                {Number.isFinite(previewStock) ? previewStock : '—'} {unit}
              </span>
            </p>
          </div>

          <div className='space-y-2'>
            <Label>Motivo {type === 'EXIT' ? '' : '(opcional)'}</Label>
            {type === 'EXIT' && (
              <div className='flex flex-wrap gap-1.5'>
                {EXIT_REASON_PRESETS.map(preset => (
                  <button
                    key={preset}
                    type='button'
                    onClick={() => setReason(preset)}
                    className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                      reason === preset
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            )}
            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              placeholder={
                type === 'EXIT'
                  ? 'Ej. Consumo diario personal administración…'
                  : 'Ej. Compra proveedor…'
              }
              maxLength={500}
            />
          </div>

          {type === 'ENTRY' && (
            <div className='space-y-2'>
              {!showPurchase ? (
                <button
                  type='button'
                  onClick={() => setShowPurchase(true)}
                  className='text-xs text-primary hover:underline'
                >
                  + Agregar datos de compra (factura, proveedor…) (opcional)
                </button>
              ) : (
                <div className='space-y-3 rounded-md border border-dashed p-3'>
                  <div className='flex items-center justify-between'>
                    <Label className='text-xs text-muted-foreground'>
                      Datos de compra (opcional)
                    </Label>
                    <button
                      type='button'
                      onClick={() => {
                        setShowPurchase(false)
                        setAmount('')
                        setCurrency('USD')
                        setInvoiceNumber('')
                        setPurchaseOrderNumber('')
                        setPurchaseSupplierId('')
                        setPaymentMethod('')
                        setBankEntity('')
                        setReferenceNumber('')
                        setCardLast4('')
                      }}
                      className='text-xs text-muted-foreground hover:text-foreground'
                    >
                      Quitar
                    </button>
                  </div>

                  <div className='grid grid-cols-3 gap-2'>
                    <div className='col-span-2 space-y-1'>
                      <Label htmlFor='mov-amount'>Monto</Label>
                      <Input
                        id='mov-amount'
                        type='number'
                        min='0'
                        step='0.01'
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        placeholder='0.00'
                      />
                    </div>
                    <div className='space-y-1'>
                      <Label htmlFor='mov-currency'>Moneda</Label>
                      <CurrencySelect id='mov-currency' value={currency} onChange={setCurrency} />
                    </div>
                  </div>

                  <p className='text-xs text-muted-foreground'>
                    Con esto se actualiza también el costo por unidad del suministro.
                  </p>

                  <div className='space-y-1'>
                    <Label htmlFor='mov-invoice'>N° Factura</Label>
                    <Input
                      id='mov-invoice'
                      value={invoiceNumber}
                      onChange={e => setInvoiceNumber(e.target.value)}
                      placeholder='FAC-001'
                      maxLength={100}
                    />
                  </div>
                  <div className='space-y-1'>
                    <Label htmlFor='mov-po'>N° Orden de Compra</Label>
                    <Input
                      id='mov-po'
                      value={purchaseOrderNumber}
                      onChange={e => setPurchaseOrderNumber(e.target.value)}
                      placeholder='OC-001'
                      maxLength={100}
                    />
                  </div>
                  <div className='space-y-1'>
                    <Label>Proveedor</Label>
                    <SupplierSelect
                      value={purchaseSupplierId || null}
                      onChange={v => setPurchaseSupplierId(v ?? '')}
                    />
                  </div>
                  <div className='space-y-1'>
                    <Label htmlFor='mov-method'>Método de pago</Label>
                    <Select
                      value={paymentMethod || '__none__'}
                      onValueChange={v => setPaymentMethod(v === '__none__' ? '' : v)}
                    >
                      <SelectTrigger id='mov-method'>
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
                  <div className='space-y-1'>
                    <Label htmlFor='mov-ref'>N° Referencia / Transacción</Label>
                    <Input
                      id='mov-ref'
                      value={referenceNumber}
                      onChange={e => setReferenceNumber(e.target.value)}
                      placeholder='REF-12345'
                      maxLength={200}
                    />
                  </div>
                  <div className='space-y-1'>
                    <Label htmlFor='mov-bank'>Banco / Entidad</Label>
                    <BankEntitySelect value={bankEntity} onChange={setBankEntity} />
                  </div>
                  {paymentMethod === 'CORPORATE_CARD' && (
                    <div className='space-y-1'>
                      <Label htmlFor='mov-card4'>Últimos 4 dígitos tarjeta</Label>
                      <Input
                        id='mov-card4'
                        value={cardLast4}
                        onChange={e => setCardLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        placeholder='1234'
                        maxLength={4}
                        className='w-24'
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {type === 'EXIT' && (
            <div className='space-y-2'>
              {!showRecipient ? (
                <button
                  type='button'
                  onClick={() => setShowRecipient(true)}
                  className='text-xs text-primary hover:underline'
                >
                  + Registrar para quién fue (opcional)
                </button>
              ) : (
                <div className='space-y-3 rounded-md border border-dashed p-3'>
                  <div className='flex items-center justify-between'>
                    <Label className='text-xs text-muted-foreground'>Destinatario (opcional)</Label>
                    <button
                      type='button'
                      onClick={() => {
                        setShowRecipient(false)
                        setRecipientUserId('')
                        setRecipientEquipmentId('')
                      }}
                      className='text-xs text-muted-foreground hover:text-foreground'
                    >
                      Quitar
                    </button>
                  </div>
                  <AssignableUserSelect
                    familyId={familyId ?? undefined}
                    value={recipientUserId}
                    onChange={setRecipientUserId}
                    label='Usuario'
                  />
                  <div className='space-y-1.5'>
                    <Label>Equipo</Label>
                    {loadingEquipment ? (
                      <div className='flex items-center gap-2 text-sm text-muted-foreground py-2'>
                        <Loader2 className='h-4 w-4 animate-spin' />
                        Cargando equipos del área…
                      </div>
                    ) : (
                      <SearchableSelect
                        options={equipmentOptions}
                        value={recipientEquipmentId}
                        onChange={setRecipientEquipmentId}
                        placeholder='Buscar equipo del área…'
                        emptyLabel='Sin equipo'
                      />
                    )}
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Puedes indicar usuario, equipo, o ambos — es solo para el historial, no cambia a
                    quién está vinculado el suministro.
                  </p>
                </div>
              )}
            </div>
          )}

          {error && <p className='text-sm text-destructive'>{error}</p>}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting && <Loader2 className='h-4 w-4 mr-1.5 animate-spin' />}
            {type === 'EXIT' ? 'Registrar consumo' : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
