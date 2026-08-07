'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { InlineCreateSelect } from '@/components/ui/inline-create-select'
import { SimpleSelect } from '@/components/ui/simple-select'
import { FileUploadZone } from '@/components/ui/file-upload-zone'
import { SupplierSelect } from '@/components/inventory/suppliers/SupplierSelect'
import { CatalogTypeInlineForm } from '@/components/inventory/asset-forms/CatalogTypeInlineForm'
import { UnitOfMeasureInlineForm } from '@/components/inventory/asset-forms/UnitOfMeasureInlineForm'
import { WarehouseInlineForm } from '@/components/inventory/asset-forms/WarehouseInlineForm'
import { inlineSelectFeedback } from '@/lib/utils/inline-select-feedback'
import { isDirectFormSubmit } from '@/lib/utils/inline-form-guard'
import { TypeAttributesInput } from '@/components/inventory/custom-fields/type-attributes-input'
import type { FamilyConfig } from '@/lib/inventory/family-config-types'
import { toast } from 'sonner'

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
  {
    value: 'FIXED_ASSET',
    label: 'Compra directa',
    help: 'Lo adquiriste — es propiedad de la empresa.',
  },
  {
    value: 'RENTAL',
    label: 'Suministro por proveedor',
    help: 'El proveedor lo suministra periódicamente.',
  },
]

type SelectOption = { id: string; name: string; description?: string }

// ── Componente definido fuera del padre para evitar remount en cada render ───
// Si está dentro de MROAssetForm, React lo ve como tipo nuevo en cada render
// y hace unmount/remount → los campos de texto pierden el foco al escribir.
interface TypeAttributesSectionProps {
  typeId: string
  values: Array<{ fieldName: string; fieldValue: string }>
  onChange: (values: Array<{ fieldName: string; fieldValue: string }>) => void
}

function TypeAttributesSection({ typeId, values, onChange }: TypeAttributesSectionProps) {
  if (!typeId) return null
  return (
    <div className='space-y-2'>
      <Label>Atributos del Tipo</Label>
      <TypeAttributesInput
        typeId={typeId}
        assetType='consumable'
        values={values}
        onChange={onChange}
      />
    </div>
  )
}

export function MROAssetForm({
  familyId,
  familyConfig,
  onSubmit,
  onBack,
  submitting,
  submitError,
  maxFileSizeMB = 10,
}: MROAssetFormProps) {
  const [name, setName] = useState('')
  const [consumableTypeId, setConsumableTypeId] = useState('')
  const [consumableTypes, setConsumableTypes] = useState<SelectOption[]>([])
  const [customFieldValues, setCustomFieldValues] = useState<
    Array<{ fieldName: string; fieldValue: string }>
  >([])
  const [unitOfMeasureId, setUnitOfMeasureId] = useState('')
  const [unitsOfMeasure, setUnitsOfMeasure] = useState<SelectOption[]>([])
  const [acquisitionMode, setAcquisitionMode] = useState<'FIXED_ASSET' | 'RENTAL'>('FIXED_ASSET')
  const [supplierId, setSupplierId] = useState('')
  const [initialStock, setInitialStock] = useState('')
  const [minStock, setMinStock] = useState('')
  const [maxStock, setMaxStock] = useState('')
  const [costPerUnit, setCostPerUnit] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [warehouses, setWarehouses] = useState<SelectOption[]>([])
  const [notes, setNotes] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])

  const isVisible = (s: string) => familyConfig.visibleSections.includes(s as never)
  const isRequired = (s: string) => familyConfig.requiredSections.includes(s as never)

  useEffect(() => {
    fetch(`/api/inventory/consumable-types?familyId=${familyId}`)
      .then(r => r.json())
      .then(d => setConsumableTypes(d.types ?? d ?? []))
    fetch('/api/inventory/units-of-measure')
      .then(r => r.json())
      .then(d => {
        const units = Array.isArray(d) ? d : (d.units ?? [])
        setUnitsOfMeasure(
          units.map((u: { id: string; name: string; symbol: string }) => ({
            id: u.id,
            name: `${u.name} (${u.symbol})`,
          }))
        )
      })
    fetch(`/api/inventory/warehouses?familyId=${familyId}`)
      .then(r => r.json())
      .then(d => setWarehouses(d.warehouses ?? d ?? []))
  }, [familyId])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!isDirectFormSubmit(e)) return
    if (!name.trim()) {
      toast.error('Ingresa el nombre del suministro')
      return
    }
    if (!consumableTypeId) {
      toast.error('Selecciona o crea una categoría (tipo de suministro)')
      return
    }
    if (!unitOfMeasureId) {
      toast.error('Selecciona o crea la unidad de medida (ej. botellón, unidad)')
      return
    }
    if (acquisitionMode === 'RENTAL' && !supplierId) {
      toast.error('Selecciona el proveedor del suministro')
      return
    }
    if (isRequired('STOCK_MRO') && isVisible('STOCK_MRO') && !initialStock) {
      toast.error('Ingresa la cantidad inicial en stock')
      return
    }
    const parsedMin = minStock ? parseFloat(minStock) : 0
    const parsedMax = maxStock ? parseFloat(maxStock) : 0
    const parsedCurrent = initialStock ? parseFloat(initialStock) : 0
    if (parsedMax > 0 && parsedMax < parsedMin) {
      toast.error('El máximo a mantener debe ser mayor o igual al mínimo de alerta')
      return
    }
    if (parsedMax > 0 && parsedCurrent > parsedMax) {
      toast.error('La cantidad inicial no puede superar el máximo a mantener')
      return
    }
    if (isRequired('FINANCIAL') && isVisible('FINANCIAL') && !costPerUnit) {
      toast.error('Ingresa el precio por unidad')
      return
    }
    if (isRequired('WAREHOUSE') && isVisible('WAREHOUSE') && !warehouseId) {
      toast.error('Selecciona la bodega de almacenamiento')
      return
    }
    onSubmit({
      name: name.trim(),
      typeId: consumableTypeId,
      unitOfMeasureId,
      acquisitionMode,
      supplierId: supplierId || undefined,
      currentStock: parsedCurrent,
      minStock: parsedMin,
      maxStock: parsedMax,
      costPerUnit: costPerUnit ? parseFloat(costPerUnit) : undefined,
      warehouseId: warehouseId || undefined,
      notes: notes || undefined,
      customValues: customFieldValues.length ? customFieldValues : undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-5'>
      <div className='rounded-lg border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground'>
        Para consumos diarios (ej. botellones de agua), registra el stock aquí y luego, en la ficha,
        usa <strong className='text-foreground'>Registrar consumo</strong> cada día. El detalle
        muestra totales del día, semana y mes para decidir compras.
      </div>

      {/* ── 1. NOMBRE ─────────────────────────────────────────────── */}
      <div className='space-y-1'>
        <Label>
          Nombre del suministro <span className='text-destructive'>*</span>
        </Label>
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          required
          placeholder='Ej: Botellón de agua 20L, Papel A4, Tóner HP…'
        />
      </div>

      {/* ── 2. CATEGORÍA + UNIDAD ─────────────────────────────────── */}
      <div className='grid grid-cols-2 gap-3'>
        <div className='space-y-1'>
          <Label>
            Categoría <span className='text-destructive'>*</span>
          </Label>
          <InlineCreateSelect
            options={consumableTypes}
            value={consumableTypeId}
            onChange={setConsumableTypeId}
            placeholder='Ej: Bebidas, Oficina…'
            createLabel='Crear categoría'
            createTitle='Nueva categoría de suministro'
            editTitle='Editar categoría'
            deleteConfirmMessage='¿Eliminar esta categoría? Solo es posible si no tiene suministros asociados.'
            {...inlineSelectFeedback('Categoría')}
            createForm={({ item, onSuccess, onCancel }) => (
              <CatalogTypeInlineForm
                apiEndpoint='/api/inventory/consumable-types'
                familyId={familyId}
                item={item}
                onSuccess={newItem => {
                  if (item)
                    setConsumableTypes(prev => prev.map(t => (t.id === newItem.id ? newItem : t)))
                  else setConsumableTypes(prev => [...prev, newItem])
                  onSuccess(newItem)
                }}
                onCancel={onCancel}
              />
            )}
            onDelete={async id => {
              const res = await fetch(`/api/inventory/consumable-types/${id}`, { method: 'DELETE' })
              if (!res.ok) {
                const d = await res.json()
                throw new Error(d.error || 'Error al eliminar')
              }
              setConsumableTypes(prev => prev.filter(t => t.id !== id))
            }}
          />
        </div>
        <div className='space-y-1'>
          <Label>
            Unidad de medida <span className='text-destructive'>*</span>
          </Label>
          <InlineCreateSelect
            options={unitsOfMeasure}
            value={unitOfMeasureId}
            onChange={setUnitOfMeasureId}
            placeholder='Ej: Botellón, Unidad, Litro…'
            createLabel='Crear unidad'
            createTitle='Nueva unidad de medida'
            editTitle='Editar unidad de medida'
            deleteConfirmMessage='¿Eliminar esta unidad de medida? Solo es posible si no tiene suministros asociados.'
            {...inlineSelectFeedback('Unidad de medida')}
            createForm={({ item, onSuccess, onCancel }) => (
              <UnitOfMeasureInlineForm
                item={item}
                onSuccess={newItem => {
                  if (item)
                    setUnitsOfMeasure(prev => prev.map(u => (u.id === newItem.id ? newItem : u)))
                  else setUnitsOfMeasure(prev => [...prev, newItem])
                  onSuccess(newItem)
                }}
                onCancel={onCancel}
              />
            )}
            onDelete={async id => {
              const res = await fetch(`/api/inventory/units-of-measure/${id}`, { method: 'DELETE' })
              if (!res.ok) {
                const d = await res.json()
                throw new Error(d.error || 'Error al eliminar')
              }
              setUnitsOfMeasure(prev => prev.filter(u => u.id !== id))
            }}
          />
        </div>
      </div>

      <TypeAttributesSection
        typeId={consumableTypeId}
        values={customFieldValues}
        onChange={setCustomFieldValues}
      />

      {/* ── 3. ADQUISICIÓN ────────────────────────────────────────── */}
      <div className='space-y-1'>
        <Label>¿Cómo se obtiene este suministro?</Label>
        <SimpleSelect
          value={acquisitionMode}
          onChange={e => setAcquisitionMode(e.target.value as typeof acquisitionMode)}
          options={ACQUISITION_MODES}
        />
        <p className='text-xs text-muted-foreground'>
          {ACQUISITION_MODES.find(m => m.value === acquisitionMode)?.help}
        </p>
      </div>

      <div className='space-y-1'>
        <Label>
          Proveedor{' '}
          {acquisitionMode === 'RENTAL' ? (
            <span className='text-destructive'>*</span>
          ) : (
            <span className='text-xs font-normal text-muted-foreground'>(opcional)</span>
          )}
        </Label>
        <SupplierSelect
          value={supplierId || null}
          onChange={v => setSupplierId(v || '')}
          familyId={familyId}
        />
      </div>

      {/* ── 4. STOCK ──────────────────────────────────────────────── */}
      {isVisible('STOCK_MRO') && (
        <fieldset className='rounded-lg border border-border p-4 space-y-3'>
          <legend className='px-2 text-sm font-semibold text-foreground'>
            Cantidades en stock
            {isRequired('STOCK_MRO') && <span className='text-destructive'> *</span>}
          </legend>
          <p className='text-xs text-muted-foreground'>
            El mínimo dispara alerta de reposición. El máximo es la cantidad objetivo a mantener
            (ej. 10 botellones).
          </p>
          <div className='grid grid-cols-3 gap-3'>
            <div className='space-y-1'>
              <Label>Cantidad inicial</Label>
              <Input
                type='number'
                min='0'
                value={initialStock}
                onChange={e => setInitialStock(e.target.value)}
                placeholder='0'
              />
            </div>
            <div className='space-y-1'>
              <Label>Alerta cuando baje de</Label>
              <Input
                type='number'
                min='0'
                value={minStock}
                onChange={e => setMinStock(e.target.value)}
                placeholder='2'
              />
            </div>
            <div className='space-y-1'>
              <Label>Máximo a mantener</Label>
              <Input
                type='number'
                min='0'
                value={maxStock}
                onChange={e => setMaxStock(e.target.value)}
                placeholder='10'
              />
            </div>
          </div>
        </fieldset>
      )}

      {/* ── 5. FINANCIERO ─────────────────────────────────────────── */}
      {isVisible('FINANCIAL') && (
        <div className='space-y-1'>
          <Label>
            Precio por unidad
            {isRequired('FINANCIAL') ? (
              <span className='text-destructive'> *</span>
            ) : (
              <span className='text-xs font-normal text-muted-foreground'> (opcional)</span>
            )}
          </Label>
          <Input
            type='number'
            min='0'
            step='0.01'
            value={costPerUnit}
            onChange={e => setCostPerUnit(e.target.value)}
            placeholder='0.00'
          />
        </div>
      )}

      {/* ── 6. BODEGA ─────────────────────────────────────────────── */}
      {isVisible('WAREHOUSE') && (
        <div className='space-y-1'>
          <Label>
            Bodega
            {isRequired('WAREHOUSE') && <span className='text-destructive'> *</span>}
          </Label>
          <InlineCreateSelect
            options={warehouses}
            value={warehouseId}
            onChange={setWarehouseId}
            placeholder='Buscar bodega...'
            allowClear
            createLabel='Crear bodega'
            createTitle='Nueva bodega'
            {...inlineSelectFeedback('Bodega')}
            createForm={({ onSuccess, onCancel }) => (
              <WarehouseInlineForm
                defaultFamilyId={familyId}
                onSuccess={item => {
                  setWarehouses(prev => [...prev, item])
                  onSuccess(item)
                }}
                onCancel={onCancel}
              />
            )}
          />
        </div>
      )}

      {/* ── 7. NOTAS Y ADJUNTOS ───────────────────────────────────── */}
      <div className='space-y-1'>
        <Label>Observaciones</Label>
        <Textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder='Notas adicionales...'
        />
      </div>
      <FileUploadZone
        files={attachments}
        onChange={setAttachments}
        maxFileSizeMB={maxFileSizeMB}
        label='Adjuntos'
      />

      {submitError && <p className='text-sm text-destructive'>{submitError}</p>}

      <div className='flex gap-3 pt-2'>
        <Button type='button' variant='outline' onClick={onBack} disabled={submitting}>
          ← Atrás
        </Button>
        <Button type='submit' disabled={submitting} className='flex-1'>
          {submitting ? 'Guardando...' : 'Crear suministro'}
        </Button>
      </div>
    </form>
  )
}
