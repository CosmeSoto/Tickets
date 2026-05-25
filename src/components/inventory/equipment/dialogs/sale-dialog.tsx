'use client'

import { useState } from 'react'
import { DollarSign, Loader2, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { getEquipmentDisplayName } from '@/lib/utils/equipment-display'

interface SaleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipmentId: string
  equipmentCode: string
  equipmentTypeName?: string
  equipmentBrandName?: string
  equipmentModelName?: string
  defaultAccessories?: string[]
  /** Si es true (SUPER_ADMIN), registra y aprueba en un solo paso sin solicitud */
  isSuperAdmin?: boolean
  onSuccess: () => void
}

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'DISCOUNT', label: 'Descuento de rol' },
]

export function SaleDialog({
  open,
  onOpenChange,
  equipmentId,
  equipmentCode,
  equipmentTypeName,
  equipmentBrandName,
  equipmentModelName,
  defaultAccessories = [],
  isSuperAdmin = false,
  onSuccess,
}: SaleDialogProps) {
  const displayName = getEquipmentDisplayName({
    equipmentCode,
    equipmentTypeName,
    equipmentBrandName,
    equipmentModelName,
  })
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)

  const [buyerName, setBuyerName] = useState('')
  const [buyerCompany, setBuyerCompany] = useState('')
  const [buyerIdNumber, setBuyerIdNumber] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().split('T')[0])
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [accessories, setAccessories] = useState<string[]>(defaultAccessories)
  const [accessoryInput, setAccessoryInput] = useState('')
  const [notes, setNotes] = useState('')

  const addAccessory = () => {
    const v = accessoryInput.trim()
    if (v && !accessories.includes(v)) {
      setAccessories(p => [...p, v])
      setAccessoryInput('')
    }
  }

  const removeAccessory = (acc: string) => setAccessories(p => p.filter(a => a !== acc))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!buyerName.trim() || !salePrice || !saleDate) {
      toast({
        title: 'Faltan campos',
        description: 'Comprador, precio y fecha son obligatorios',
        variant: 'destructive',
      })
      return
    }

    try {
      setSubmitting(true)

      // 1. Crear la solicitud
      const res = await fetch('/api/inventory/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentId,
          buyerName: buyerName.trim(),
          buyerCompany: buyerCompany.trim() || null,
          buyerIdNumber: buyerIdNumber.trim() || null,
          salePrice: parseFloat(salePrice),
          saleDate,
          invoiceNumber: invoiceNumber.trim() || null,
          paymentMethod,
          accessories,
          notes: notes.trim() || null,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al crear solicitud')
      }

      const sale = await res.json()

      // 2. SUPER_ADMIN aprueba inmediatamente — sin flujo de solicitud
      if (isSuperAdmin) {
        const approveRes = await fetch(`/api/inventory/sales/${sale.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'approve' }),
        })
        if (!approveRes.ok) {
          const err = await approveRes.json()
          throw new Error(err.error || 'Error al aprobar la venta')
        }
        toast({ title: 'Venta registrada', description: `${displayName} marcado como vendido` })
      } else {
        toast({
          title: 'Solicitud enviada',
          description: `La venta de ${displayName} está pendiente de aprobación`,
        })
      }

      onOpenChange(false)
      onSuccess()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo procesar la venta',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-lg max-h-[90vh]' aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <DollarSign className='h-5 w-5' />
            {isSuperAdmin ? 'Registrar Venta' : 'Solicitar Venta de Activo'}
          </DialogTitle>
          <DialogDescription>
            {displayName} · {equipmentCode}
            {isSuperAdmin && (
              <span className='block mt-1 text-emerald-600 dark:text-emerald-400 text-xs font-medium'>
                Como Super Admin, la venta se registrará y aprobará de inmediato.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className='space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]'
        >
          {/* Comprador */}
          <div className='space-y-3'>
            <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
              Datos del Comprador
            </p>
            <div className='grid grid-cols-2 gap-3'>
              <div className='col-span-2 space-y-1'>
                <Label>
                  Nombre del comprador <span className='text-destructive'>*</span>
                </Label>
                <Input
                  value={buyerName}
                  onChange={e => setBuyerName(e.target.value)}
                  placeholder='Juan Pérez'
                />
              </div>
              <div className='space-y-1'>
                <Label>Empresa / Organización</Label>
                <Input
                  value={buyerCompany}
                  onChange={e => setBuyerCompany(e.target.value)}
                  placeholder='Opcional'
                />
              </div>
              <div className='space-y-1'>
                <Label>RUC / Cédula</Label>
                <Input
                  value={buyerIdNumber}
                  onChange={e => setBuyerIdNumber(e.target.value)}
                  placeholder='Opcional'
                />
              </div>
            </div>
          </div>

          {/* Datos financieros */}
          <div className='space-y-3'>
            <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
              Datos de la Venta
            </p>
            <div className='grid grid-cols-2 gap-3'>
              <div className='space-y-1'>
                <Label>
                  Precio de venta (USD) <span className='text-destructive'>*</span>
                </Label>
                <Input
                  type='number'
                  min='0'
                  step='0.01'
                  value={salePrice}
                  onChange={e => setSalePrice(e.target.value)}
                  placeholder='0.00'
                />
              </div>
              <div className='space-y-1'>
                <Label>
                  Fecha de venta <span className='text-destructive'>*</span>
                </Label>
                <Input type='date' value={saleDate} onChange={e => setSaleDate(e.target.value)} />
              </div>
              <div className='space-y-1'>
                <Label>N° de Factura</Label>
                <Input
                  value={invoiceNumber}
                  onChange={e => setInvoiceNumber(e.target.value)}
                  placeholder='FAC-2026-001'
                />
              </div>
              <div className='space-y-1'>
                <Label>Forma de pago</Label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className='flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
                >
                  {PAYMENT_METHODS.map(m => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Accesorios */}
          <div className='space-y-2'>
            <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
              Accesorios incluidos en la venta
            </p>
            <div className='flex gap-2'>
              <Input
                value={accessoryInput}
                onChange={e => setAccessoryInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addAccessory()
                  }
                }}
                placeholder='Ej: Cargador, Mouse...'
              />
              <Button type='button' variant='outline' size='sm' onClick={addAccessory}>
                +
              </Button>
            </div>
            {accessories.length > 0 && (
              <div className='flex flex-wrap gap-1.5'>
                {accessories.map(acc => (
                  <span
                    key={acc}
                    className='inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs'
                  >
                    {acc}
                    <button
                      type='button'
                      onClick={() => removeAccessory(acc)}
                      className='hover:text-destructive'
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Notas */}
          <div className='space-y-1'>
            <Label>Notas internas</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder='Observaciones sobre la venta...'
            />
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type='submit' disabled={submitting}>
              {submitting ? (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              ) : isSuperAdmin ? (
                <CheckCircle className='mr-2 h-4 w-4' />
              ) : (
                <DollarSign className='mr-2 h-4 w-4' />
              )}
              {isSuperAdmin ? 'Registrar venta' : 'Enviar solicitud'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
