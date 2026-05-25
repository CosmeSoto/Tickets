'use client'

/**
 * ConvertToPurchaseDialog
 *
 * Permite convertir un equipo arrendado (RENTAL) o de tercero (LOAN)
 * en activo propio (FIXED_ASSET) cuando la empresa decide comprarlo.
 *
 * Registra: precio de compra, fecha, factura, proveedor y depreciación.
 * Conserva el historial de arrendamiento en los campos rental_*.
 */

import { useState } from 'react'
import { Loader2, ShoppingCart, Info } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { getEquipmentDisplayName } from '@/lib/utils/equipment-display'

const DEPRECIATION_OPTIONS = [
  { value: 'LINEAR', label: 'Línea Recta — mismo monto cada año' },
  { value: 'DECLINING_BALANCE', label: 'Saldo Decreciente — más al inicio (tecnología)' },
  { value: 'UNITS_OF_PRODUCTION', label: 'Por Uso — según horas/km/ciclos' },
]

interface ConvertToPurchaseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipmentId: string
  equipmentCode: string
  equipmentTypeName?: string
  equipmentBrandName?: string
  equipmentModelName?: string
  /** 'RENTAL' | 'LOAN' */
  currentOwnershipType: string
  onSuccess: () => void
}

export function ConvertToPurchaseDialog({
  open,
  onOpenChange,
  equipmentId,
  equipmentCode,
  equipmentTypeName,
  equipmentBrandName,
  equipmentModelName,
  currentOwnershipType,
  onSuccess,
}: ConvertToPurchaseDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  // Campos obligatorios
  const [purchasePrice, setPurchasePrice] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split('T')[0])

  // Campos opcionales
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [usefulLifeYears, setUsefulLifeYears] = useState('')
  const [residualValue, setResidualValue] = useState('')
  const [depreciationMethod, setDepreciationMethod] = useState('LINEAR')
  const [notes, setNotes] = useState('')

  const [errors, setErrors] = useState<Record<string, string>>({})

  const isRental = currentOwnershipType === 'RENTAL'
  const assetName = getEquipmentDisplayName({
    equipmentCode,
    equipmentTypeName,
    equipmentBrandName,
    equipmentModelName,
  })

  const validate = () => {
    const e: Record<string, string> = {}
    if (!purchasePrice || parseFloat(purchasePrice) <= 0) {
      e.purchasePrice = 'El precio de compra es obligatorio'
    }
    if (!purchaseDate) {
      e.purchaseDate = 'La fecha de compra es obligatoria'
    }
    if (residualValue && purchasePrice && parseFloat(residualValue) > parseFloat(purchasePrice)) {
      e.residualValue = 'El valor residual no puede superar el precio de compra'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      const res = await fetch(`/api/inventory/equipment/${equipmentId}/convert-to-purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchasePrice: parseFloat(purchasePrice),
          purchaseDate,
          invoiceNumber: invoiceNumber || undefined,
          usefulLifeYears: usefulLifeYears ? parseFloat(usefulLifeYears) : undefined,
          residualValue: residualValue ? parseFloat(residualValue) : undefined,
          depreciationMethod,
          notes: notes || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al convertir el equipo')

      toast({
        title: 'Equipo adquirido',
        description: `${assetName} ahora es un activo propio de la empresa.`,
      })
      onOpenChange(false)
      onSuccess()
    } catch (err: unknown) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-lg max-h-[90vh]'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <ShoppingCart className='h-5 w-5' />
            Adquirir equipo en propiedad
          </DialogTitle>
          <DialogDescription>
            {isRental
              ? 'La empresa compra el equipo al proveedor arrendador. El historial de arrendamiento se conserva.'
              : 'La empresa adquiere el bien prestado. El historial del préstamo se conserva.'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className='space-y-4 pt-1 overflow-y-auto max-h-[calc(90vh-120px)]'
        >
          {/* Banner informativo */}
          <div className='rounded-md border border-border bg-muted/40 px-3 py-2.5 flex gap-2 text-sm text-muted-foreground'>
            <Info className='h-4 w-4 mt-0.5 shrink-0' />
            <span>
              Al confirmar, <strong className='text-foreground'>{assetName}</strong> pasará a ser
              propiedad de la empresa y comenzará a depreciarse desde la fecha de compra.
            </span>
          </div>

          {/* Precio de compra + Fecha */}
          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1'>
              <Label htmlFor='purchasePrice'>
                Precio de compra <span className='text-destructive'>*</span>
              </Label>
              <Input
                id='purchasePrice'
                type='number'
                min='0'
                step='0.01'
                value={purchasePrice}
                onChange={e => {
                  setPurchasePrice(e.target.value)
                  setErrors(p => ({ ...p, purchasePrice: '' }))
                }}
                placeholder='0.00'
              />
              {errors.purchasePrice && (
                <p className='text-xs text-destructive'>{errors.purchasePrice}</p>
              )}
            </div>
            <div className='space-y-1'>
              <Label htmlFor='purchaseDate'>
                Fecha de compra <span className='text-destructive'>*</span>
              </Label>
              <Input
                id='purchaseDate'
                type='date'
                value={purchaseDate}
                onChange={e => {
                  setPurchaseDate(e.target.value)
                  setErrors(p => ({ ...p, purchaseDate: '' }))
                }}
              />
              {errors.purchaseDate && (
                <p className='text-xs text-destructive'>{errors.purchaseDate}</p>
              )}
            </div>
          </div>

          {/* Factura */}
          <div className='space-y-1'>
            <Label htmlFor='invoiceNumber'>
              N° de Factura <span className='text-xs text-muted-foreground'>(opcional)</span>
            </Label>
            <Input
              id='invoiceNumber'
              value={invoiceNumber}
              onChange={e => setInvoiceNumber(e.target.value)}
              placeholder='Ej: FAC-2026-0123'
            />
          </div>

          {/* Depreciación */}
          <fieldset className='rounded-lg border border-border p-3 space-y-3'>
            <legend className='px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide'>
              Depreciación <span className='font-normal normal-case'>(opcional — recomendado)</span>
            </legend>

            <div className='space-y-1'>
              <Label htmlFor='depreciationMethod'>Método</Label>
              <select
                id='depreciationMethod'
                value={depreciationMethod}
                onChange={e => setDepreciationMethod(e.target.value)}
                className='flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
              >
                {DEPRECIATION_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className='grid grid-cols-2 gap-3'>
              <div className='space-y-1'>
                <Label htmlFor='usefulLifeYears'>Vida útil (años)</Label>
                <Input
                  id='usefulLifeYears'
                  type='number'
                  min='1'
                  value={usefulLifeYears}
                  onChange={e => setUsefulLifeYears(e.target.value)}
                  placeholder='Ej: 5'
                />
                <p className='text-xs text-muted-foreground'>
                  Laptops 3-5, servidores 5-7, mobiliario 10.
                </p>
              </div>
              <div className='space-y-1'>
                <Label htmlFor='residualValue'>Valor residual</Label>
                <Input
                  id='residualValue'
                  type='number'
                  min='0'
                  step='0.01'
                  value={residualValue}
                  onChange={e => {
                    setResidualValue(e.target.value)
                    setErrors(p => ({ ...p, residualValue: '' }))
                  }}
                  placeholder='0.00'
                />
                {errors.residualValue && (
                  <p className='text-xs text-destructive'>{errors.residualValue}</p>
                )}
                <p className='text-xs text-muted-foreground'>Valor al final de la vida útil.</p>
              </div>
            </div>
          </fieldset>

          {/* Notas */}
          <div className='space-y-1'>
            <Label htmlFor='notes'>
              Notas <span className='text-xs text-muted-foreground'>(opcional)</span>
            </Label>
            <Textarea
              id='notes'
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder={
                isRental
                  ? 'Ej: Compra ejercida al vencimiento del contrato de arrendamiento...'
                  : 'Ej: Adquisición acordada con el propietario original...'
              }
            />
          </div>

          <div className='flex justify-end gap-2 pt-1'>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type='submit' disabled={loading}>
              {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              <ShoppingCart className='mr-2 h-4 w-4' />
              Confirmar adquisición
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
