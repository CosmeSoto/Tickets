'use client'

/**
 * AcquisitionPaymentDialog — el único modal de "pagar / abonar" una factura
 * de adquisición (equipo o licencia) en toda la app.
 *
 * Antes había dos implementaciones separadas de este mismo modal: una en la
 * ficha del activo (AcquisitionInvoicesCard) y otra reescrita a mano en la
 * página global de Pagos — con campos que fueron divergiendo (una tenía N°
 * de referencia, la otra no) y comportamientos ligeramente distintos para la
 * misma acción. Este componente reemplaza a ambas.
 *
 * Es controlado por el padre: recibe la factura completa y avisa con
 * `onChanged` para que el padre refresque su lista. Al registrar un pago o
 * abono, el modal se cierra solo (como cualquier formulario que ya cumplió
 * su propósito); al deshacer un abono, en cambio, se queda abierto — el
 * padre debe pasarle de vuelta la factura ya recalculada (mismo patrón que
 * usaba AcquisitionInvoicesCard) para mostrar el saldo actualizado.
 */

import { useEffect, useState } from 'react'
import { CheckCircle2, Receipt, Loader2, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
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
import { DateInput } from '@/components/ui/date-input'
import { BankEntitySelect } from '@/components/inventory/shared/BankEntitySelect'
import { inventoryToast as toast } from '@/lib/utils/inventory-toast'
import { PAYMENT_METHOD_TYPE_LABELS, type PaymentMethodType } from '@/types/contracts'
import {
  ACQUISITION_INVOICE_API,
  fmtAcquisitionCurrency,
  fmtAcquisitionDate,
  todayISO,
  acquisitionAssetLabel,
  type AcquisitionAssetType,
  type AcquisitionInvoice,
  type InvoiceInstallment,
} from './acquisition-invoices'

// Label/placeholder de "N° Referencia" según el método elegido — cada medio
// de pago deja un rastro distinto (cheque, transferencia, PayPal, cripto...)
// y pedir siempre "REF-12345" no orienta a qué anotar ahí. Mismo criterio
// que ya usa el formulario de contrato para paymentAccountRef.
const REFERENCE_FIELD_BY_METHOD: Partial<
  Record<PaymentMethodType, { label: string; placeholder: string }>
> = {
  CHECK: { label: 'N° de cheque', placeholder: 'Nº 000123' },
  BANK_TRANSFER: { label: 'N° de operación / transferencia', placeholder: 'OP-12345' },
  PAYPAL: { label: 'Email o ID de transacción PayPal', placeholder: 'cuenta@empresa.com' },
  CRYPTO: { label: 'Hash de transacción / wallet', placeholder: '0x… o hash de tx' },
  CORPORATE_CARD: { label: 'N° de autorización / comprobante', placeholder: 'AUTH-12345' },
}
const DEFAULT_REFERENCE_FIELD = { label: 'N° Referencia', placeholder: 'REF-12345' }
// Banco/Entidad no aplica a medios sin cuenta bancaria de por medio.
const METHODS_WITHOUT_BANK: PaymentMethodType[] = ['PAYPAL', 'CRYPTO']

/** Resume método + referencia + tarjeta/banco de un abono, para el tooltip
 * de "Abonos anteriores" — la lista es compacta y no tiene espacio para
 * mostrar todo el detalle en línea. */
function installmentDetail(ins: InvoiceInstallment): string {
  const parts: string[] = []
  if (ins.paymentMethod) {
    parts.push(
      PAYMENT_METHOD_TYPE_LABELS[ins.paymentMethod as PaymentMethodType] ?? ins.paymentMethod
    )
  }
  if (ins.referenceNumber) parts.push(`Ref: ${ins.referenceNumber}`)
  if (ins.cardLast4) parts.push(`Tarjeta •••• ${ins.cardLast4}`)
  if (ins.bankEntity) parts.push(`Banco: ${ins.bankEntity}`)
  return parts.join(' · ') || 'Sin detalle adicional'
}

interface AcquisitionPaymentDialogProps {
  assetType: AcquisitionAssetType
  /** Factura a pagar/abonar — null cierra el modal. */
  invoice: AcquisitionInvoice | null
  onOpenChange: (open: boolean) => void
  /** Se llama después de registrar un pago o deshacer un abono, para que el
   * padre refresque su lista (y, si sigue mostrando este modal, le pase la
   * factura ya recalculada). */
  onChanged: () => void | Promise<void>
}

export function AcquisitionPaymentDialog({
  assetType,
  invoice,
  onOpenChange,
  onChanged,
}: AcquisitionPaymentDialogProps) {
  const endpoints = ACQUISITION_INVOICE_API[assetType]

  const [saving, setSaving] = useState(false)
  const [paidDate, setPaidDate] = useState(todayISO())
  const [paidMethod, setPaidMethod] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [bankEntity, setBankEntity] = useState('')
  const [cardLast4, setCardLast4] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [undoing, setUndoing] = useState<InvoiceInstallment | null>(null)

  // Resetea el formulario solo cuando cambia DE factura (por id) — no en
  // cada actualización de la misma factura (p. ej. tras registrar un abono,
  // que recalcula paidAmount/installments pero no debe pisar lo que el
  // usuario esté por escribir en el formulario).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!invoice) return
    setPaidDate(todayISO())
    setPaidMethod(invoice.paymentMethod ?? '')
    setReferenceNumber('')
    setBankEntity('')
    setCardLast4('')
    setPayAmount((invoice.amount - invoice.paidAmount).toFixed(2))
  }, [invoice?.id])

  async function handleRegisterPayment() {
    if (!invoice) return
    if (!referenceNumber.trim()) {
      toast.error('El N° de referencia es obligatorio')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`${endpoints.item(invoice.id)}/installments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: payAmount ? Number(payAmount) : undefined,
          paidDate,
          paymentMethod: paidMethod || null,
          referenceNumber: referenceNumber.trim(),
          bankEntity: bankEntity || null,
          cardLast4: cardLast4 || null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'No se pudo registrar')
      toast.success('Pago registrado correctamente')
      onOpenChange(false)
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al registrar pago')
    } finally {
      setSaving(false)
    }
  }

  async function handleUndoInstallment() {
    if (!undoing) return
    setSaving(true)
    try {
      const res = await fetch(endpoints.installmentItem(undoing.id), { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'No se pudo deshacer el abono')
      toast.success('Abono deshecho')
      setUndoing(null)
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al deshacer abono')
    } finally {
      setSaving(false)
    }
  }

  const assetLabel = invoice ? acquisitionAssetLabel(invoice) : null
  const referenceField =
    REFERENCE_FIELD_BY_METHOD[paidMethod as PaymentMethodType] ?? DEFAULT_REFERENCE_FIELD
  const showBankField = !METHODS_WITHOUT_BANK.includes(paidMethod as PaymentMethodType)

  return (
    <>
      <Dialog open={!!invoice} onOpenChange={open => !open && onOpenChange(false)}>
        <DialogContent className='max-w-sm'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <Receipt className='h-4 w-4' />
              {invoice?.status === 'PAID' ? 'Abonos registrados' : 'Registrar pago'}
            </DialogTitle>
          </DialogHeader>
          {invoice && (
            <div className='space-y-3'>
              <div className='rounded-md bg-muted/50 px-3 py-2 text-sm space-y-0.5'>
                {assetLabel && <p className='font-medium font-mono text-xs'>{assetLabel}</p>}
                <p className={assetLabel ? 'text-muted-foreground text-xs' : 'font-medium'}>
                  {invoice.invoiceNumber ?? 'Factura'}
                </p>
                <p className='text-muted-foreground text-xs'>
                  Monto total: {fmtAcquisitionCurrency(invoice.amount, invoice.currency)}
                </p>
                {invoice.paidAmount > 0 && (
                  <p className='text-muted-foreground text-xs'>
                    Abonado: {fmtAcquisitionCurrency(invoice.paidAmount, invoice.currency)}
                  </p>
                )}
                <p className='font-semibold'>
                  Saldo pendiente:{' '}
                  {fmtAcquisitionCurrency(invoice.amount - invoice.paidAmount, invoice.currency)}
                </p>
              </div>

              {invoice.installments.length > 0 && (
                <div className='space-y-1'>
                  <Label className='text-xs text-muted-foreground'>
                    Abonos anteriores ({invoice.installments.length})
                  </Label>
                  <ul className='rounded-md border divide-y text-xs max-h-24 overflow-y-auto'>
                    {invoice.installments.map(ins => (
                      <li
                        key={ins.id}
                        className='flex items-center justify-between px-2 py-1'
                        title={installmentDetail(ins)}
                      >
                        <span className='text-muted-foreground'>
                          {fmtAcquisitionDate(ins.paidDate)}
                        </span>
                        <span className='font-medium'>
                          {fmtAcquisitionCurrency(ins.amount, invoice.currency)}
                        </span>
                        <button
                          type='button'
                          onClick={() => setUndoing(ins)}
                          className='p-0.5 rounded text-muted-foreground hover:text-destructive transition-colors'
                          title='Deshacer este abono'
                        >
                          <Undo2 className='h-3 w-3' />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {invoice.status !== 'PAID' && (
                <>
                  <div className='space-y-1'>
                    <Label>Monto a abonar</Label>
                    <Input
                      type='number'
                      min='0.01'
                      step='0.01'
                      max={invoice.amount - invoice.paidAmount}
                      value={payAmount}
                      onChange={e => setPayAmount(e.target.value)}
                    />
                    <p className='text-xs text-muted-foreground'>
                      Deja el monto completo para saldar, o redúcelo para abonar parcialmente.
                    </p>
                  </div>
                  <div className='space-y-1'>
                    <Label>Fecha de pago</Label>
                    <DateInput value={paidDate} onChange={e => setPaidDate(e.target.value)} />
                  </div>
                  <div className='space-y-1'>
                    <Label>Método de pago</Label>
                    <Select
                      value={paidMethod || '__none__'}
                      onValueChange={v => {
                        const next = v === '__none__' ? '' : v
                        setPaidMethod(next)
                        // Limpia campos que dejan de aplicar al cambiar de método,
                        // para no enviar de arrastre un valor que ya no corresponde.
                        if (METHODS_WITHOUT_BANK.includes(next as PaymentMethodType)) {
                          setBankEntity('')
                        }
                        if (next !== 'CORPORATE_CARD') {
                          setCardLast4('')
                        }
                      }}
                    >
                      <SelectTrigger>
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
                      <Label>
                        {referenceField.label} <span className='text-destructive'>*</span>
                      </Label>
                      <Input
                        placeholder={referenceField.placeholder}
                        value={referenceNumber}
                        onChange={e => setReferenceNumber(e.target.value)}
                        maxLength={200}
                      />
                    </div>
                    {showBankField && (
                      <div className='space-y-1'>
                        <Label>Banco / Entidad</Label>
                        <BankEntitySelect value={bankEntity} onChange={setBankEntity} />
                      </div>
                    )}
                  </div>

                  {paidMethod === 'CORPORATE_CARD' && (
                    <div className='space-y-1'>
                      <Label>Últimos 4 dígitos tarjeta</Label>
                      <Input
                        placeholder='1234'
                        value={cardLast4}
                        onChange={e => setCardLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        maxLength={4}
                        className='w-24'
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          <DialogFooter>
            {invoice?.status === 'PAID' ? (
              <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
            ) : (
              <>
                <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button
                  type='button'
                  onClick={handleRegisterPayment}
                  disabled={saving || !referenceNumber.trim()}
                >
                  {saving ? (
                    <Loader2 className='h-4 w-4 animate-spin' />
                  ) : invoice && Number(payAmount) >= invoice.amount - invoice.paidAmount - 0.01 ? (
                    <>
                      <CheckCircle2 className='h-4 w-4 mr-1.5' />
                      Confirmar pago
                    </>
                  ) : (
                    'Registrar abono'
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirmar deshacer abono ─────────────────────────────────────── */}
      <AlertDialog open={!!undoing} onOpenChange={open => !open && setUndoing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Deshacer este abono?</AlertDialogTitle>
            <AlertDialogDescription>
              {undoing &&
                `Se eliminará el abono de ${fmtAcquisitionCurrency(undoing.amount, invoice?.currency)} del ${fmtAcquisitionDate(undoing.paidDate)}. El saldo y el estado de la factura se recalculan al instante.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUndoInstallment}
              disabled={saving}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {saving ? 'Deshaciendo…' : 'Deshacer abono'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
