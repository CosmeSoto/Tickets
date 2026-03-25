'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SupplierSelect } from '@/components/inventory/suppliers/SupplierSelect'

interface FinancialInfoSectionProps {
  // Valores actuales
  supplierId?: string | null
  invoiceNumber?: string | null
  purchaseOrderNumber?: string | null
  purchasePrice?: number | null
  purchaseDate?: string | null
  renewalCost?: number | null
  renewalDate?: string | null
  // Modo
  readOnly?: boolean
  showRenewal?: boolean
  // Callbacks
  onChange?: (field: string, value: any) => void
}

export function FinancialInfoSection({
  supplierId, invoiceNumber, purchaseOrderNumber, purchasePrice, purchaseDate,
  renewalCost, renewalDate, readOnly = false, showRenewal = false, onChange,
}: FinancialInfoSectionProps) {
  const [expanded, setExpanded] = useState(false)

  const hasData = !!(supplierId || invoiceNumber || purchaseOrderNumber || purchasePrice || purchaseDate || renewalCost || renewalDate)

  return (
    <div className="rounded-md border">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          Información Financiera
          {hasData && <span className="ml-1 h-2 w-2 rounded-full bg-primary" title="Tiene datos" />}
        </span>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {expanded && (
        <div className="border-t px-4 py-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Proveedor</Label>
              {readOnly ? (
                <p className="mt-1 text-sm">{supplierId ? '(proveedor asociado)' : '—'}</p>
              ) : (
                <SupplierSelect
                  value={supplierId}
                  onChange={v => onChange?.('supplierId', v)}
                />
              )}
            </div>

            <div>
              <Label htmlFor="purchasePrice">Costo de adquisición</Label>
              {readOnly ? (
                <p className="mt-1 text-sm">{purchasePrice != null ? `$${purchasePrice}` : '—'}</p>
              ) : (
                <Input
                  id="purchasePrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={purchasePrice ?? ''}
                  onChange={e => onChange?.('purchasePrice', e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="0.00"
                />
              )}
            </div>

            <div>
              <Label htmlFor="purchaseDate">Fecha de compra</Label>
              {readOnly ? (
                <p className="mt-1 text-sm">{purchaseDate ? new Date(purchaseDate).toLocaleDateString('es-EC') : '—'}</p>
              ) : (
                <Input
                  id="purchaseDate"
                  type="date"
                  value={purchaseDate ? purchaseDate.substring(0, 10) : ''}
                  onChange={e => onChange?.('purchaseDate', e.target.value || null)}
                />
              )}
            </div>

            <div>
              <Label htmlFor="invoiceNumber">N° Factura</Label>
              {readOnly ? (
                <p className="mt-1 text-sm">{invoiceNumber || '—'}</p>
              ) : (
                <Input
                  id="invoiceNumber"
                  value={invoiceNumber ?? ''}
                  onChange={e => onChange?.('invoiceNumber', e.target.value || null)}
                  placeholder="FAC-001"
                  maxLength={100}
                />
              )}
            </div>

            <div>
              <Label htmlFor="purchaseOrderNumber">N° Orden de Compra</Label>
              {readOnly ? (
                <p className="mt-1 text-sm">{purchaseOrderNumber || '—'}</p>
              ) : (
                <Input
                  id="purchaseOrderNumber"
                  value={purchaseOrderNumber ?? ''}
                  onChange={e => onChange?.('purchaseOrderNumber', e.target.value || null)}
                  placeholder="OC-001"
                  maxLength={100}
                />
              )}
            </div>

            {showRenewal && (
              <>
                <div>
                  <Label htmlFor="renewalCost">Costo de renovación</Label>
                  {readOnly ? (
                    <p className="mt-1 text-sm">{renewalCost != null ? `$${renewalCost}` : '—'}</p>
                  ) : (
                    <Input
                      id="renewalCost"
                      type="number"
                      min="0"
                      step="0.01"
                      value={renewalCost ?? ''}
                      onChange={e => onChange?.('renewalCost', e.target.value ? parseFloat(e.target.value) : null)}
                      placeholder="0.00"
                    />
                  )}
                </div>

                <div>
                  <Label htmlFor="renewalDate">Fecha de próxima renovación</Label>
                  {readOnly ? (
                    <p className="mt-1 text-sm">{renewalDate ? new Date(renewalDate).toLocaleDateString('es-EC') : '—'}</p>
                  ) : (
                    <Input
                      id="renewalDate"
                      type="date"
                      value={renewalDate ? renewalDate.substring(0, 10) : ''}
                      onChange={e => onChange?.('renewalDate', e.target.value || null)}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
