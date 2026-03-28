'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { FamilyConfig } from '@/lib/inventory/family-config-types'
import { X, Upload, Search } from 'lucide-react'

interface MROAssetFormProps {
  familyId: string
  familyConfig: FamilyConfig
  onSubmit: (payload: Record<string, unknown>) => void
  onBack: () => void
  submitting: boolean
  submitError: string | null
  maxFileSizeMB?: number
}

interface SelectOption { id: string; name: string }

const ACQUISITION_MODES = [
  { value: 'FIXED_ASSET', label: 'Activo Fijo',      help: 'Lo compraste, es tuyo.' },
  { value: 'RENTAL',      label: 'Arrendamiento',    help: 'Suministro por proveedor externo.' },
]

function SearchSelect({ options, value, onChange, placeholder = 'Seleccionar...', disabled }: {
  options: SelectOption[]; value: string; onChange: (v: string) => void
  placeholder?: string; disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const filtered = q ? options.filter(o => o.name.toLowerCase().includes(q.toLowerCase())) : options
  const selected = options.find(o => o.id === value)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button type="button" disabled={disabled} onClick={() => setOpen(o => !o)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm disabled:opacity-50">
        <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>{selected?.name ?? placeholder}</span>
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input autoFocus className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Buscar..." value={q} onChange={e => setQ(e.target.value)} />
            {q && <button type="button" onClick={() => setQ('')}><X className="h-3 w-3" /></button>}
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            <button type="button" onClick={() => { onChange(''); setOpen(false); setQ('') }}
              className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-accent">
              {placeholder}
            </button>
            {filtered.map(o => (
              <button key={o.id} type="button"
                onClick={() => { onChange(o.id); setOpen(false); setQ('') }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-accent ${o.id === value ? 'bg-accent/50 font-medium' : ''}`}>
                {o.name}
              </button>
            ))}
            {filtered.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</p>}
          </div>
        </div>
      )}
    </div>
  )
}

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
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isVisible = (s: string) => familyConfig.visibleSections.includes(s as never)

  useEffect(() => {
    fetch(`/api/inventory/consumable-types?familyId=${familyId}`)
      .then(r => r.json()).then(d => setConsumableTypes(d.types ?? d ?? []))
    fetch('/api/inventory/units-of-measure')
      .then(r => r.json()).then(d => setUnitsOfMeasure(d.units ?? []))
    fetch('/api/inventory/warehouses')
      .then(r => r.json()).then(d => setWarehouses(d.warehouses ?? d ?? []))
  }, [familyId])

  useEffect(() => {
    if (acquisitionMode === 'RENTAL') {
      fetch('/api/inventory/suppliers').then(r => r.json()).then(d => setSuppliers(d.suppliers ?? []))
    }
  }, [acquisitionMode])

  const addFiles = (files: FileList | null) => {
    if (!files) return
    setAttachments(prev => {
      const next = [...prev]
      Array.from(files).forEach(f => {
        if (f.size > maxFileSizeMB * 1024 * 1024) return
        if (!next.find(x => x.name === f.name && x.size === f.size)) next.push(f)
      })
      return next
    })
  }

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
      {/* Modalidad */}
      <div className="space-y-1">
        <Label>Modalidad de Adquisición</Label>
        <select value={acquisitionMode} onChange={e => setAcquisitionMode(e.target.value as typeof acquisitionMode)}
          className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {ACQUISITION_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <p className="text-xs text-muted-foreground">{ACQUISITION_MODES.find(m => m.value === acquisitionMode)?.help}</p>
      </div>

      {/* Nombre */}
      <div className="space-y-1">
        <Label>Nombre <span className="text-destructive">*</span></Label>
        <Input value={name} onChange={e => setName(e.target.value)} required placeholder="Ej: Tornillo M6" />
      </div>

      {/* Tipo de material */}
      <div className="space-y-1">
        <Label>Tipo de Material</Label>
        <SearchSelect options={consumableTypes} value={consumableTypeId} onChange={setConsumableTypeId} placeholder="Buscar tipo..." />
      </div>

      {/* Unidad de medida */}
      <div className="space-y-1">
        <Label>Unidad de Medida</Label>
        <SearchSelect options={unitsOfMeasure} value={unitOfMeasureId} onChange={setUnitOfMeasureId} placeholder="Buscar unidad..." />
      </div>

      {/* Proveedor — solo RENTAL */}
      {acquisitionMode === 'RENTAL' && (
        <div className="space-y-1">
          <Label>Proveedor del Suministro <span className="text-destructive">*</span></Label>
          <SearchSelect options={suppliers} value={supplierId} onChange={setSupplierId} placeholder="Buscar proveedor..." />
        </div>
      )}

      {/* Sección STOCK_MRO */}
      {isVisible('STOCK_MRO') && (
        <fieldset className="rounded-lg border border-border p-4 space-y-3">
          <legend className="px-2 text-sm font-semibold text-foreground">Stock</legend>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Stock Inicial</Label>
              <Input type="number" min="0" value={initialStock} onChange={e => setInitialStock(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label>Stock Mínimo</Label>
              <Input type="number" min="0" value={minStock} onChange={e => setMinStock(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label>Stock Máximo</Label>
              <Input type="number" min="0" value={maxStock} onChange={e => setMaxStock(e.target.value)} placeholder="0" />
            </div>
          </div>
        </fieldset>
      )}

      {/* Sección FINANCIAL */}
      {isVisible('FINANCIAL') && (
        <div className="space-y-1">
          <Label>Costo por Unidad</Label>
          <Input type="number" min="0" step="0.01" value={costPerUnit} onChange={e => setCostPerUnit(e.target.value)} placeholder="0.00" />
        </div>
      )}

      {/* Sección WAREHOUSE */}
      {isVisible('WAREHOUSE') && (
        <div className="space-y-1">
          <Label>Bodega</Label>
          <SearchSelect options={warehouses} value={warehouseId} onChange={setWarehouseId} placeholder="Buscar bodega..." />
        </div>
      )}

      {/* Observaciones */}
      <div className="space-y-1">
        <Label>Observaciones</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Notas adicionales..." />
      </div>

      {/* Adjuntos */}
      <div className="space-y-2">
        <Label>Adjuntos</Label>
        <div
          className="flex flex-col items-center justify-center rounded-md border-2 border-dashed border-border p-5 cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
        >
          <Upload className="h-7 w-7 text-muted-foreground mb-1" />
          <p className="text-sm text-muted-foreground">Arrastra archivos o <span className="text-primary font-medium">haz clic</span></p>
          <p className="text-xs text-muted-foreground mt-0.5">Máx. {maxFileSizeMB} MB por archivo</p>
        </div>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
        {attachments.length > 0 && (
          <div className="space-y-1">
            {attachments.map((f, i) => (
              <div key={i} className="flex items-center justify-between rounded-md border border-border px-3 py-1.5 text-sm">
                <span className="truncate">{f.name}</span>
                <button type="button" onClick={() => setAttachments(p => p.filter((_, j) => j !== i))}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

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
