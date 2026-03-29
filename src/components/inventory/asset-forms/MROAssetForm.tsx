'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { SimpleSelect } from '@/components/ui/simple-select'
import { FileUploadZone } from '@/components/ui/file-upload-zone'
import type { FamilyConfig } from '@/lib/inventory/family-config-types'
import { X } from 'lucide-react'

interface MROAssetFormProps {
  familyId: string
  familyConfig: FamilyConfig
  onSubmit: (payload: Record<string, unknown>) => void
  onBack: () => void
  submitting: boolean
  submitError: string | null
  maxFileSizeMB?: number
}

const ACQUISITION_MODES = [
  { value: 'FIXED_ASSET', label: 'Compra directa',        help: 'Lo adquiriste — es propiedad de la empresa.' },
  { value: 'RENTAL',      label: 'Suministro por proveedor', help: 'El proveedor lo suministra periódicamente.' },
]

export function MROAssetForm({
  familyId, familyConfig, onSubmit, onBack, submitting, submitError, maxFileSizeMB = 10,
}: MROAssetFormProps) {
  const [name, setName] = useState('')
  const [consumableTypeId, setConsumableTypeId] = useState('')
  const [consumableTypes, setConsumableTypes] = useState<SelectOption[]>([])
  const [unitOfMeasureId, setUnitOfMeasureId] = useState('')
  const [unitsOfMeasure, setUnitsOfMeasure] = useState<SelectOption[]>([])
  const [acquisitionMode, setAcquisitionMode] = useState<'FIXED_ASSET' | 'RENTAL'>('FIXED_ASSET')
  const [supplierId, setSupplierId] = useState('')
  const [suppliers, setSuppliers] = useState<SelectOption[]>([])
  const [initialStock, setInitialStock] = useState('')
  const [minStock, setMinStock] = useState('')
  const [maxStock, setMaxStock] = useState('')
  const [costPerUnit, setCostPerUnit] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [warehouses, setWarehouses] = useState<SelectOption[]>([])
  const [notes, setNotes] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])

  const isVisible = (s: string) => familyConfig.visibleSections.includes(s as never)

  useEffect(() => {
    fetch(`/api/inventory/consumable-types?familyId=${familyId}`)
      .then(r => r.json()).then(d => setConsumableTypes(d.types ?? d ?? []))
    fetch('/api/inventory/units-of-measure')
      .then(r => r.json()).then(d => {
        const units = Array.isArray(d) ? d : (d.units ?? [])
        setUnitsOfMeasure(units.map((u: { id: string; name: string; symbol: string }) => ({
          id: u.id,
          name: `${u.name} (${u.symbol})`,
        })))
      })
    fetch('/api/inventory/warehouses')
      .then(r => r.json()).then(d => setWarehouses(d.warehouses ?? d ?? []))
  }, [familyId])

  useEffect(() => {
    if (acquisitionMode === 'RENTAL') {
      fetch('/api/inventory/suppliers').then(r => r.json()).then(d => setSuppliers(d.suppliers ?? []))
    }
  }, [acquisitionMode])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload: Record<string, unknown> = {
      name,
      typeId: consumableTypeId || undefined,
      unitOfMeasureId: unitOfMeasureId || undefined,
      acquisitionMode,
      supplierId: supplierId || undefined,
      initialStock: initialStock ? parseFloat(initialStock) : undefined,
      minStock: minStock ? parseFloat(minStock) : undefined,
      maxStock: maxStock ? parseFloat(maxStock) : undefined,
      costPerUnit: costPerUnit ? parseFloat(costPerUnit) : undefined,
      warehouseId: warehouseId || undefined,
      notes: notes || undefined,
    }
    onSubmit(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Botón atrás superior */}
      <button type="button" onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">← Atrás</button>

      {/* Modalidad */}
      <div className="space-y-1">
        <Label>¿Cómo se obtiene este material?</Label>
        <SimpleSelect
          value={acquisitionMode}
          onChange={e => setAcquisitionMode(e.target.value as typeof acquisitionMode)}
          options={ACQUISITION_MODES}
        />
        <p className="text-xs text-muted-foreground">{ACQUISITION_MODES.find(m => m.value === acquisitionMode)?.help}</p>
      </div>

      {/* Nombre */}
      <div className="space-y-1">
        <Label>Nombre del material <span className="text-destructive">*</span></Label>
        <Input value={name} onChange={e => setName(e.target.value)} required placeholder="Ej: Tornillo M6, Tóner HP 85A, Papel A4..." />
      </div>

      {/* Tipo de material */}
      <div className="space-y-1">
        <Label>Categoría <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
        <SearchableSelect options={consumableTypes} value={consumableTypeId} onChange={setConsumableTypeId} placeholder="Ej: Lubricante, Herramienta, Papel..." />
        <p className="text-xs text-muted-foreground">Agrupa el material con otros del mismo tipo para facilitar búsquedas y reportes.</p>
      </div>

      {/* Unidad de medida */}
      <div className="space-y-1">
        <Label>¿En qué se mide? <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
        <SearchableSelect options={unitsOfMeasure} value={unitOfMeasureId} onChange={setUnitOfMeasureId} placeholder="Ej: Unidad, Litro, Kg, Metro..." />
      </div>

      {/* Proveedor — solo suministro */}
      {acquisitionMode === 'RENTAL' && (
        <div className="space-y-1">
          <Label>Proveedor <span className="text-destructive">*</span></Label>
          <SearchableSelect options={suppliers} value={supplierId} onChange={setSupplierId} placeholder="Buscar proveedor..." />
        </div>
      )}

      {/* Sección STOCK_MRO */}
      {isVisible('STOCK_MRO') && (
        <fieldset className="rounded-lg border border-border p-4 space-y-3">
          <legend className="px-2 text-sm font-semibold text-foreground">Cantidades en stock</legend>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Cantidad inicial</Label>
              <Input type="number" min="0" value={initialStock} onChange={e => setInitialStock(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label>Alerta cuando baje de</Label>
              <Input type="number" min="0" value={minStock} onChange={e => setMinStock(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label>Máximo a mantener</Label>
              <Input type="number" min="0" value={maxStock} onChange={e => setMaxStock(e.target.value)} placeholder="0" />
            </div>
          </div>
        </fieldset>
      )}

      {/* Sección FINANCIAL */}
      {isVisible('FINANCIAL') && (
        <div className="space-y-1">
          <Label>Precio por unidad <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
          <Input type="number" min="0" step="0.01" value={costPerUnit} onChange={e => setCostPerUnit(e.target.value)} placeholder="0.00" />
        </div>
      )}

      {/* Sección WAREHOUSE */}
      {isVisible('WAREHOUSE') && (
        <div className="space-y-1">
          <Label>Bodega</Label>
          <SearchableSelect options={warehouses} value={warehouseId} onChange={setWarehouseId} placeholder="Buscar bodega..." />
        </div>
      )}

      {/* Observaciones */}
      <div className="space-y-1">
        <Label>Observaciones</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Notas adicionales..." />
      </div>

      {/* Adjuntos */}
      <FileUploadZone files={attachments} onChange={setAttachments} maxFileSizeMB={maxFileSizeMB} label="Adjuntos" />

      {submitError && <p className="text-sm text-destructive">{submitError}</p>}

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onBack} disabled={submitting}>← Atrás</Button>
        <Button type="submit" disabled={submitting} className="flex-1">
          {submitting ? 'Guardando...' : 'Crear Material'}
        </Button>
      </div>
    </form>
  )
}
