'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, DollarSign } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SupplierSelect } from '@/components/inventory/suppliers/SupplierSelect'
import { DateInput } from '@/components/ui/date-input'
import { sanitizeInvoiceNumberInput } from '@/lib/inventory/invoice-number'

type FinancialField =
  | 'supplier'
  | 'purchasePrice'
  | 'purchaseDate'
  | 'expirationDate'
  | 'invoiceNumber'
  | 'purchaseOrderNumber'
  | 'renewalCost'
  | 'renewalDate'

interface FinancialInfoSectionProps {
  // Valores actuales
  supplierId?: string | null
  /** Nombre del proveedor, solo para el modo readOnly (evita otro round-trip
   * al catálogo — el nombre ya viene incluido en el detalle del activo). */
  supplierName?: string | null
  invoiceNumber?: string | null
  purchaseOrderNumber?: string | null
  purchasePrice?: number | null
  purchaseDate?: string | null
  expirationDate?: string | null
  renewalCost?: number | null
  renewalDate?: string | null
  // Modo
  readOnly?: boolean
  showRenewal?: boolean
  /** Muestra "Fecha de Vencimiento" (licencias con expiración propia). */
  showExpiration?: boolean
  familyId?: string
  // Callbacks
  onChange?: (field: string, value: any) => void
  /** Oculta subcampos puntuales — p. ej. 'supplier' cuando el formulario ya
   * tiene su propio selector de proveedor arriba, o 'purchasePrice'/
   * 'renewalDate' cuando el dato viene de un contrato vinculado. */
  hiddenFields?: FinancialField[]
  /** Título del bloque. Por defecto "Información Financiera". */
  title?: string
  /** Si es false, el bloque no es plegable — siempre visible (para
   * creación/edición, donde ocultar campos obligatorios tras un acordeón
   * confunde). Por defecto plegable (para la ficha de solo lectura). */
  collapsible?: boolean
  /** Marca el bloque (y Costo de adquisición) como obligatorio. */
  required?: boolean
  /** Error a mostrar bajo el campo de costo de adquisición. */
  priceError?: string
}

export function FinancialInfoSection({
  supplierId,
  supplierName,
  invoiceNumber,
  purchaseOrderNumber,
  purchasePrice,
  purchaseDate,
  expirationDate,
  renewalCost,
  renewalDate,
  readOnly = false,
  showRenewal = false,
  showExpiration = false,
  familyId,
  onChange,
  hiddenFields = [],
  title = 'Información Financiera',
  collapsible = true,
  required = false,
  priceError,
}: FinancialInfoSectionProps) {
  const [expanded, setExpanded] = useState(!collapsible)
  const hidden = (field: FinancialField) => hiddenFields.includes(field)

  const hasData = !!(
    supplierId ||
    invoiceNumber ||
    purchaseOrderNumber ||
    purchasePrice ||
    purchaseDate ||
    expirationDate ||
    renewalCost ||
    renewalDate
  )

  const body = (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
      {!hidden('supplier') && (
        <div className='sm:col-span-2'>
          <Label>Proveedor</Label>
          {readOnly ? (
            <p className='mt-1 text-sm'>
              {supplierName || (supplierId ? '(proveedor asociado)' : '—')}
            </p>
          ) : (
            <SupplierSelect
              value={supplierId}
              onChange={v => onChange?.('supplierId', v)}
              familyId={familyId}
            />
          )}
        </div>
      )}

      {!hidden('purchasePrice') && (
        <div>
          <Label htmlFor='purchasePrice'>
            Costo de adquisición
            {required && <span className='text-destructive'> *</span>}
          </Label>
          {readOnly ? (
            <p className='mt-1 text-sm'>{purchasePrice != null ? `$${purchasePrice}` : '—'}</p>
          ) : (
            <>
              <Input
                id='purchasePrice'
                type='number'
                min='0'
                step='0.01'
                value={purchasePrice ?? ''}
                onChange={e =>
                  onChange?.('purchasePrice', e.target.value ? parseFloat(e.target.value) : null)
                }
                placeholder='0.00'
              />
              {priceError && <p className='text-xs text-destructive'>{priceError}</p>}
            </>
          )}
        </div>
      )}

      {!hidden('purchaseDate') && (
        <div>
          <Label htmlFor='purchaseDate'>Fecha de compra</Label>
          {readOnly ? (
            <p className='mt-1 text-sm'>
              {purchaseDate ? new Date(purchaseDate).toLocaleDateString('es-EC') : '—'}
            </p>
          ) : (
            <DateInput
              id='purchaseDate'
              value={purchaseDate ? purchaseDate.substring(0, 10) : ''}
              onChange={e => onChange?.('purchaseDate', e.target.value || null)}
              clearable
            />
          )}
        </div>
      )}

      {showExpiration && !hidden('expirationDate') && (
        <div>
          <Label htmlFor='expirationDate'>Fecha de Vencimiento</Label>
          {readOnly ? (
            <p className='mt-1 text-sm'>
              {expirationDate ? new Date(expirationDate).toLocaleDateString('es-EC') : '—'}
            </p>
          ) : (
            <DateInput
              id='expirationDate'
              value={expirationDate ? expirationDate.substring(0, 10) : ''}
              onChange={e => onChange?.('expirationDate', e.target.value || null)}
              min={purchaseDate || undefined}
              clearable
            />
          )}
        </div>
      )}

      {!hidden('invoiceNumber') && (
        <div>
          <Label htmlFor='invoiceNumber'>N° Factura</Label>
          {readOnly ? (
            <p className='mt-1 text-sm'>{invoiceNumber || '—'}</p>
          ) : (
            <Input
              id='invoiceNumber'
              value={invoiceNumber ?? ''}
              onChange={e =>
                onChange?.('invoiceNumber', sanitizeInvoiceNumberInput(e.target.value) || null)
              }
              placeholder='001-001-000000123'
              maxLength={100}
            />
          )}
        </div>
      )}

      {!hidden('purchaseOrderNumber') && (
        <div>
          <Label htmlFor='purchaseOrderNumber'>
            N° Orden de Compra{' '}
            <span className='text-xs text-muted-foreground font-normal'>(opcional)</span>
          </Label>
          {readOnly ? (
            <p className='mt-1 text-sm'>{purchaseOrderNumber || '—'}</p>
          ) : (
            <Input
              id='purchaseOrderNumber'
              value={purchaseOrderNumber ?? ''}
              onChange={e =>
                onChange?.(
                  'purchaseOrderNumber',
                  sanitizeInvoiceNumberInput(e.target.value) || null
                )
              }
              placeholder='001-001-000000123'
              maxLength={100}
            />
          )}
        </div>
      )}

      {showRenewal && !hidden('renewalCost') && (
        <div>
          <Label htmlFor='renewalCost'>Costo de renovación</Label>
          {readOnly ? (
            <p className='mt-1 text-sm'>{renewalCost != null ? `$${renewalCost}` : '—'}</p>
          ) : (
            <Input
              id='renewalCost'
              type='number'
              min='0'
              step='0.01'
              value={renewalCost ?? ''}
              onChange={e =>
                onChange?.('renewalCost', e.target.value ? parseFloat(e.target.value) : null)
              }
              placeholder='0.00'
            />
          )}
        </div>
      )}

      {showRenewal && !hidden('renewalDate') && (
        <div>
          <Label htmlFor='renewalDate'>Fecha de próxima renovación</Label>
          {readOnly ? (
            <p className='mt-1 text-sm'>
              {renewalDate ? new Date(renewalDate).toLocaleDateString('es-EC') : '—'}
            </p>
          ) : (
            <DateInput
              id='renewalDate'
              value={renewalDate ? renewalDate.substring(0, 10) : ''}
              onChange={e => onChange?.('renewalDate', e.target.value || null)}
              clearable
            />
          )}
        </div>
      )}
    </div>
  )

  if (!collapsible) {
    return (
      <fieldset className='rounded-lg border border-border p-4 space-y-3'>
        <legend className='px-2 text-sm font-semibold text-foreground'>
          {title}
          {required && <span className='text-destructive'> *</span>}
        </legend>
        {body}
      </fieldset>
    )
  }

  return (
    <div className='rounded-md border'>
      <button
        type='button'
        className='flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50'
        onClick={() => setExpanded(e => !e)}
      >
        <span className='flex items-center gap-2'>
          <DollarSign className='h-4 w-4 text-muted-foreground' />
          {title}
          {hasData && <span className='ml-1 h-2 w-2 rounded-full bg-primary' title='Tiene datos' />}
        </span>
        {expanded ? <ChevronUp className='h-4 w-4' /> : <ChevronDown className='h-4 w-4' />}
      </button>

      {expanded && <div className='border-t px-4 py-4'>{body}</div>}
    </div>
  )
}
