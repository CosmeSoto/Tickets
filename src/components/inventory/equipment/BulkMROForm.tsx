'use client'

/**
 * BulkMROForm — Formulario para crear un lote de materiales MRO/consumibles.
 * Reutiliza los mismos componentes que MROAssetForm pero adaptado para lotes.
 * Un "lote MRO" es una compra de N unidades del mismo material.
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, AlertCircle, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { InlineCreateSelect } from '@/components/ui/inline-create-select'
import { SimpleSelect } from '@/components/ui/simple-select'
import { SupplierSelect } from '@/components/inventory/suppliers/SupplierSelect'
import { CatalogTypeInlineForm } from '@/components/inventory/asset-forms/CatalogTypeInlineForm'
import { UnitOfMeasureInlineForm } from '@/components/inventory/asset-forms/UnitOfMeasureInlineForm'
import { WarehouseInlineForm } from '@/components/inventory/asset-forms/WarehouseInlineForm'
import { StepHeader } from '@/components/inventory/shared/StepHeader'
import type { FamilyConfig } from '@/lib/inventory/family-config-types'
import { toast } from 'sonner'
import { inlineSelectFeedback } from '@/lib/utils/inline-select-feedback'

interface BulkMROFormProps {
  familyId: string
  familyConfig: FamilyConfig
  familyName?: string
  familyColor?: string
  onBack: () => void
  onCancel?: () => void
  onSuccess?: (result: any) => void
}

type SelectOption = { id: string; name: string; description?: string }

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

export function BulkMROForm({
  familyId,
  familyConfig,
  familyName,
  familyColor,
  onBack,
  onCancel,
  onSuccess,
}: BulkMROFormProps) {
  const router = useRouter()
  const isVisible = (s: string) => familyConfig.visibleSections.includes(s as never)
  const isRequired = (s: string) => familyConfig.requiredSections.includes(s as never)

  // Estado del formulario
  const [name, setName] = useState('')
  const [consumableTypeId, setConsumableTypeId] = useState('')
  const [consumableTypes, setConsumableTypes] = useState<SelectOption[]>([])
  const [unitOfMeasureId, setUnitOfMeasureId] = useState('')
  const [unitsOfMeasure, setUnitsOfMeasure] = useState<SelectOption[]>([])
  const [acquisitionMode, setAcquisitionMode] = useState<'FIXED_ASSET' | 'RENTAL'>('FIXED_ASSET')
  const [supplierId, setSupplierId] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [minStock, setMinStock] = useState('')
  const [maxStock, setMaxStock] = useState('')
  const [costPerUnit, setCostPerUnit] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [warehouses, setWarehouses] = useState<SelectOption[]>([])
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('El nombre del material es requerido')
      return
    }
    if (isRequired('STOCK_MRO') && isVisible('STOCK_MRO') && !quantity) {
      toast.error('Ingresa la cantidad del lote')
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
    if (acquisitionMode === 'RENTAL' && !supplierId) {
      setError('Selecciona el proveedor del suministro')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/inventory/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subtype: 'MRO',
          familyId,
          name: name.trim(),
          typeId: consumableTypeId || undefined,
          unitOfMeasureId: unitOfMeasureId || undefined,
          acquisitionMode,
          supplierId: supplierId || undefined,
          initialStock: quantity ? parseFloat(quantity) : undefined,
          minStock: minStock ? parseFloat(minStock) : undefined,
          maxStock: maxStock ? parseFloat(maxStock) : undefined,
          costPerUnit: costPerUnit ? parseFloat(costPerUnit) : undefined,
          warehouseId: warehouseId || undefined,
          notes: notes || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al crear el material')
      setSuccess(true)
      onSuccess?.(data)
    } catch (err: any) {
      setError(err.message || 'Error desconocido')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className='space-y-4'>
        <div className='rounded-lg border border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800 p-6'>
          <div className='flex items-start gap-4'>
            <div className='rounded-full bg-green-100 dark:bg-green-900 p-3'>
              <CheckCircle2 className='h-6 w-6 text-green-600 dark:text-green-400' />
            </div>
            <div className='flex-1 space-y-3'>
              <h2 className='text-xl font-semibold text-green-900 dark:text-green-100'>
                Material creado exitosamente
              </h2>
              <p className='text-sm text-green-700 dark:text-green-300'>
                El material <strong>{name}</strong> fue registrado en el inventario.
              </p>
              <div className='flex gap-2 pt-2'>
                <Button onClick={() => router.push('/inventory')} className='flex-1'>
                  Ver inventario
                </Button>
                <Button
                  variant='outline'
                  onClick={() => {
                    setSuccess(false)
                    setName('')
                  }}
                  className='flex-1'
                >
                  Crear otro
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-6'>
      {/* Header estandarizado */}
      <StepHeader
        mode='bulk'
        step={3}
        description='Registra una entrada de stock de materiales MRO / consumibles.'
        familyName={familyName}
        familyColor={familyColor}
        subtypeName='MRO'
        backLabel='Cambiar tipo'
        onBack={onBack}
      />

      {error && (
        <Alert variant='destructive'>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ── Identificación del material ─────────────────────────── */}
      <div className='rounded-lg border bg-card p-5 space-y-4'>
        <div>
          <h3 className='font-semibold mb-1'>Identificación del Material</h3>
          <p className='text-xs text-muted-foreground'>Nombre y clasificación del material</p>
        </div>

        <div className='space-y-1.5'>
          <Label htmlFor='name'>
            Nombre del material <span className='text-destructive'>*</span>
          </Label>
          <Input
            id='name'
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder='Ej: Tóner HP 85A, Papel A4, Lubricante WD-40...'
            required
          />
        </div>

        <div className='grid grid-cols-2 gap-4'>
          <div className='space-y-1.5'>
            <Label>
              Categoría{' '}
              <span className='text-xs font-normal text-muted-foreground'>(opcional)</span>
            </Label>
            <InlineCreateSelect
              options={consumableTypes}
              value={consumableTypeId}
              onChange={setConsumableTypeId}
              placeholder='Ej: Tóner, Papel...'
              allowClear
              createLabel='Crear categoría'
              createTitle='Nueva categoría'
              {...inlineSelectFeedback('Categoría')}
              createForm={({ item, onSuccess: onS, onCancel: onC }) => (
                <CatalogTypeInlineForm
                  apiEndpoint='/api/inventory/consumable-types'
                  familyId={familyId}
                  item={item}
                  onSuccess={newItem => {
                    if (item)
                      setConsumableTypes(prev => prev.map(t => (t.id === newItem.id ? newItem : t)))
                    else setConsumableTypes(prev => [...prev, newItem])
                    onS(newItem)
                  }}
                  onCancel={onC}
                />
              )}
              onDelete={async id => {
                const res = await fetch(`/api/inventory/consumable-types/${id}`, {
                  method: 'DELETE',
                })
                if (!res.ok) {
                  const d = await res.json()
                  throw new Error(d.error || 'Error')
                }
                setConsumableTypes(prev => prev.filter(t => t.id !== id))
              }}
            />
          </div>
          <div className='space-y-1.5'>
            <Label>
              Unidad de medida{' '}
              <span className='text-xs font-normal text-muted-foreground'>(opcional)</span>
            </Label>
            <InlineCreateSelect
              options={unitsOfMeasure}
              value={unitOfMeasureId}
              onChange={setUnitOfMeasureId}
              placeholder='Ej: Unidad, Litro...'
              allowClear
              createLabel='Crear unidad'
              createTitle='Nueva unidad'
              {...inlineSelectFeedback('Unidad de medida')}
              createForm={({ item, onSuccess: onS, onCancel: onC }) => (
                <UnitOfMeasureInlineForm
                  item={item}
                  onSuccess={newItem => {
                    if (item)
                      setUnitsOfMeasure(prev => prev.map(u => (u.id === newItem.id ? newItem : u)))
                    else setUnitsOfMeasure(prev => [...prev, newItem])
                    onS(newItem)
                  }}
                  onCancel={onC}
                />
              )}
              onDelete={async id => {
                const res = await fetch(`/api/inventory/units-of-measure/${id}`, {
                  method: 'DELETE',
                })
                if (!res.ok) {
                  const d = await res.json()
                  throw new Error(d.error || 'Error')
                }
                setUnitsOfMeasure(prev => prev.filter(u => u.id !== id))
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Stock ───────────────────────────────────────────────── */}
      {isVisible('STOCK_MRO') && (
        <div className='rounded-lg border bg-card p-5 space-y-4'>
          <div>
            <h3 className='font-semibold mb-1'>
              Cantidad del Lote
              {isRequired('STOCK_MRO') && <span className='text-destructive'> *</span>}
            </h3>
            <p className='text-xs text-muted-foreground'>Unidades que ingresan al inventario</p>
          </div>
          <div className='grid grid-cols-3 gap-4'>
            <div className='space-y-1.5'>
              <Label htmlFor='quantity'>
                Cantidad que ingresa <span className='text-destructive'>*</span>
              </Label>
              <Input
                id='quantity'
                type='number'
                min='1'
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder='0'
              />
            </div>
            <div className='space-y-1.5'>
              <Label>Alerta cuando baje de</Label>
              <Input
                type='number'
                min='0'
                value={minStock}
                onChange={e => setMinStock(e.target.value)}
                placeholder='0'
              />
            </div>
            <div className='space-y-1.5'>
              <Label>Máximo a mantener</Label>
              <Input
                type='number'
                min='0'
                value={maxStock}
                onChange={e => setMaxStock(e.target.value)}
                placeholder='0'
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Adquisición ─────────────────────────────────────────── */}
      <div className='rounded-lg border bg-card p-5 space-y-4'>
        <div>
          <h3 className='font-semibold mb-1'>Adquisición</h3>
          <p className='text-xs text-muted-foreground'>Cómo se obtiene este material</p>
        </div>

        <div className='space-y-1.5'>
          <Label>Modalidad</Label>
          <SimpleSelect
            value={acquisitionMode}
            onChange={e => setAcquisitionMode(e.target.value as typeof acquisitionMode)}
            options={ACQUISITION_MODES}
          />
          <p className='text-xs text-muted-foreground'>
            {ACQUISITION_MODES.find(m => m.value === acquisitionMode)?.help}
          </p>
        </div>

        <div className='space-y-1.5'>
          <Label>
            Proveedor {acquisitionMode === 'RENTAL' && <span className='text-destructive'>*</span>}
          </Label>
          <SupplierSelect
            value={supplierId || null}
            onChange={v => setSupplierId(v || '')}
            familyId={familyId}
          />
        </div>

        {isVisible('FINANCIAL') && (
          <div className='space-y-1.5'>
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
            {costPerUnit && quantity && (
              <p className='text-xs text-muted-foreground'>
                Total del lote:{' '}
                <strong>${(parseFloat(costPerUnit) * parseFloat(quantity)).toFixed(2)}</strong>
              </p>
            )}
          </div>
        )}

        {isVisible('WAREHOUSE') && (
          <div className='space-y-1.5'>
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
              createForm={({ onSuccess: onS, onCancel: onC }) => (
                <WarehouseInlineForm
                  defaultFamilyId={familyId}
                  onSuccess={item => {
                    setWarehouses(prev => [...prev, item])
                    onS(item)
                  }}
                  onCancel={onC}
                />
              )}
            />
          </div>
        )}
      </div>

      {/* ── Notas ───────────────────────────────────────────────── */}
      <div className='space-y-1.5'>
        <Label>
          Observaciones{' '}
          <span className='text-xs font-normal text-muted-foreground'>(opcional)</span>
        </Label>
        <Textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder='Notas adicionales sobre este lote...'
        />
      </div>

      {/* ── Botones ─────────────────────────────────────────────── */}
      <div className='flex gap-3 pt-2'>
        {onCancel && (
          <Button type='button' variant='outline' onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
        )}
        <Button type='submit' disabled={submitting} className='flex-1'>
          {submitting ? (
            <>
              <Package className='mr-2 h-4 w-4 animate-pulse' />
              Creando material...
            </>
          ) : (
            <>
              <Package className='mr-2 h-4 w-4' />
              Registrar {quantity || '0'} unidades
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
