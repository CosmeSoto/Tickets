'use client'

import { useState, useRef, useEffect } from 'react'
import { FamilySelector } from '@/components/inventory/family-selector'
import { useAdaptiveAssetForm } from '@/hooks/use-adaptive-asset-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { Search, X, Upload, FileText, ImageIcon, Loader2, ChevronDown } from 'lucide-react'

interface AdaptiveAssetFormProps {
  families: Array<{ id: string; name: string; icon?: string | null; color?: string | null; code: string }>
  warehouses: Array<{ id: string; name: string }>
  suppliers?: Array<{ id: string; name: string }>
  onSubmit: (data: Record<string, unknown>, files?: File[]) => void
  isLoading?: boolean
}

const ACQUISITION_MODES = [
  { value: 'FIXED_ASSET', label: 'Activo Fijo' },
  { value: 'RENTAL', label: 'Arrendamiento' },
  { value: 'LOAN', label: 'Préstamo / Comodato' },
]

const DEPRECIATION_METHODS = [
  { value: 'LINEAR', label: 'Línea Recta' },
  { value: 'DECLINING_BALANCE', label: 'Saldo Decreciente' },
  { value: 'UNITS_OF_PRODUCTION', label: 'Unidades de Producción' },
]

const CONTRACT_TYPES = [
  { value: 'SOFTWARE', label: 'Licencia de Software' },
  { value: 'SERVICE_EXTERNAL', label: 'Contrato Externo' },
  { value: 'MAINTENANCE', label: 'Mantenimiento' },
  { value: 'INSURANCE', label: 'Seguro' },
  { value: 'SLA', label: 'SLA' },
]

const EQUIPMENT_STATUSES = [
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'INACTIVE', label: 'Inactivo' },
  { value: 'MAINTENANCE', label: 'En Mantenimiento' },
  { value: 'DECOMMISSIONED', label: 'Dado de Baja' },
]

const EQUIPMENT_CONDITIONS = [
  { value: 'NEW', label: 'Nuevo' },
  { value: 'GOOD', label: 'Bueno' },
  { value: 'FAIR', label: 'Regular' },
  { value: 'POOR', label: 'Malo' },
]

const FINANCIAL_FAMILIES = ['FIXED_ASSETS', 'COMMERCIAL']

// ─── Combobox con buscador ────────────────────────────────────────────────────
interface ComboboxOption { value: string; label: string }
interface ComboboxProps {
  options: ComboboxOption[]
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  emptyText?: string
}

function Combobox({ options, value, onChange, placeholder = 'Seleccionar...', disabled, loading, emptyText = 'Sin resultados' }: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const selected = options.find(o => o.value === value)
  const filtered = query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
      >
        <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
          {loading ? 'Cargando...' : (selected?.label ?? placeholder)}
        </span>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4 opacity-50" />}
      </button>

      {open && !loading && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <div className="flex items-center border-b px-3 py-2 gap-2">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              autoFocus
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Buscar..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {query && <button type="button" onClick={() => setQuery('')}><X className="h-3 w-3 text-muted-foreground" /></button>}
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">{emptyText}</p>
            ) : (
              filtered.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); setQuery('') }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground ${o.value === value ? 'bg-accent/50 font-medium' : ''}`}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
          {value && (
            <div className="border-t px-3 py-2">
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false) }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Limpiar selección
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Zona de adjuntos ─────────────────────────────────────────────────────────
interface AttachmentZoneProps {
  files: File[]
  onChange: (files: File[]) => void
  disabled?: boolean
}

function AttachmentZone({ files, onChange, disabled }: AttachmentZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return
    const next = [...files]
    Array.from(incoming).forEach(f => {
      if (!next.find(x => x.name === f.name && x.size === f.size)) next.push(f)
    })
    onChange(next)
  }

  const remove = (idx: number) => onChange(files.filter((_, i) => i !== idx))

  const isImage = (f: File) => f.type.startsWith('image/')

  return (
    <fieldset className="rounded-lg border border-dashed border-gray-300 p-4 space-y-3">
      <legend className="px-2 text-sm font-medium text-gray-700 flex items-center gap-1">
        <Upload className="h-4 w-4" /> Adjuntos e Imágenes
      </legend>

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-md border-2 border-dashed p-6 text-center transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'} ${disabled ? 'pointer-events-none opacity-50' : ''}`}
      >
        <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Arrastra archivos aquí o <span className="text-primary font-medium">haz clic para seleccionar</span></p>
        <p className="text-xs text-muted-foreground mt-1">Imágenes, PDF, Word, Excel — máx. 10 MB por archivo</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
          className="hidden"
          onChange={e => addFiles(e.target.files)}
          disabled={disabled}
        />
      </div>

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2">
              {isImage(f)
                ? <ImageIcon className="h-4 w-4 text-blue-500 shrink-0" />
                : <FileText className="h-4 w-4 text-gray-500 shrink-0" />}
              <span className="flex-1 text-sm truncate">{f.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
              <button type="button" onClick={() => remove(i)} disabled={disabled} className="text-muted-foreground hover:text-destructive">
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  )
}

// ─── Formulario principal ─────────────────────────────────────────────────────
export function AdaptiveAssetForm({ families, warehouses, suppliers = [], onSubmit, isLoading }: AdaptiveAssetFormProps) {
  const {
    selectedFamilyId,
    selectedFamilyCode,
    familyTypes,
    loadingTypes,
    selectFamily,
    showDepreciationFields,
    showContractFields,
    getDefaultDepreciationMethod,
    getDefaultUsefulLife,
  } = useAdaptiveAssetForm()

  const [form, setForm] = useState<Record<string, unknown>>({})
  const [files, setFiles] = useState<File[]>([])
  const [showResetDialog, setShowResetDialog] = useState(false)

  const set = (key: string, value: unknown) => setForm(prev => ({ ...prev, [key]: value }))

  const acquisitionMode = (form.acquisitionMode as string) ?? null
  const depreciationMethod = (form.depreciationMethod as string) ?? getDefaultDepreciationMethod(selectedFamilyCode)

  const allTypes = [
    ...(familyTypes?.equipmentTypes ?? []).map(t => ({ value: t.id, label: t.name })),
    ...(familyTypes?.consumableTypes ?? []).map(t => ({ value: t.id, label: `${t.name} (MRO)` })),
    ...(familyTypes?.licenseTypes ?? []).map(t => ({ value: t.id, label: `${t.name} (Licencia)` })),
  ]

  const warehouseOptions = warehouses.map(w => ({ value: w.id, label: w.name }))
  const supplierOptions = suppliers.map(s => ({ value: s.id, label: s.name }))

  const showFinancial = FINANCIAL_FAMILIES.includes(selectedFamilyCode ?? '')
  const showDepr = showDepreciationFields(acquisitionMode)
  const showContract = showContractFields(selectedFamilyCode)
  const showStock = selectedFamilyCode === 'MAINTENANCE'

  const handleFamilySelect = (familyId: string) => {
    const family = families.find(f => f.id === familyId)
    if (!family) return
    if (selectedFamilyId && selectedFamilyId !== familyId) {
      set('_pendingFamilyId', familyId)
      set('_pendingFamilyCode', family.code)
      setShowResetDialog(true)
      return
    }
    selectFamily(familyId, family.code)
    setForm({
      depreciationMethod: getDefaultDepreciationMethod(family.code),
      usefulLifeYears: getDefaultUsefulLife(family.code),
    })
  }

  const confirmFamilyChange = () => {
    const pendingId = form._pendingFamilyId as string
    const pendingCode = form._pendingFamilyCode as string
    selectFamily(pendingId, pendingCode)
    setForm({
      depreciationMethod: getDefaultDepreciationMethod(pendingCode),
      usefulLifeYears: getDefaultUsefulLife(pendingCode),
    })
    setFiles([])
    setShowResetDialog(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const { _pendingFamilyId, _pendingFamilyCode, ...data } = form
    void _pendingFamilyId; void _pendingFamilyCode
    onSubmit({ ...data, familyId: selectedFamilyId, familyCode: selectedFamilyCode }, files)
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Paso 1: Familia */}
        <div>
          <Label className="text-sm font-medium mb-3 block">Familia de Inventario <span className="text-destructive">*</span></Label>
          <FamilySelector
            families={families}
            selectedId={selectedFamilyId}
            onSelect={handleFamilySelect}
            disabled={isLoading}
          />
        </div>

        {/* Campos base */}
        {selectedFamilyId && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nombre <span className="text-destructive">*</span></Label>
                <Input
                  id="name"
                  required
                  value={(form.name as string) ?? ''}
                  onChange={e => set('name', e.target.value)}
                  disabled={isLoading}
                  placeholder="Ej: Compresor de aire industrial"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="code">Código / Serie</Label>
                <Input
                  id="code"
                  value={(form.code as string) ?? ''}
                  onChange={e => set('code', e.target.value)}
                  disabled={isLoading}
                  placeholder="Ej: EQ-2024-001"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Combobox
                  options={allTypes}
                  value={(form.typeId as string) ?? ''}
                  onChange={v => set('typeId', v)}
                  placeholder="Buscar tipo..."
                  disabled={isLoading}
                  loading={loadingTypes}
                  emptyText="No hay tipos para esta familia"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Modalidad de Adquisición</Label>
                <Combobox
                  options={ACQUISITION_MODES}
                  value={(form.acquisitionMode as string) ?? ''}
                  onChange={v => set('acquisitionMode', v)}
                  placeholder="Seleccionar modalidad..."
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Combobox
                  options={EQUIPMENT_STATUSES}
                  value={(form.status as string) ?? ''}
                  onChange={v => set('status', v)}
                  placeholder="Seleccionar estado..."
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Condición</Label>
                <Combobox
                  options={EQUIPMENT_CONDITIONS}
                  value={(form.condition as string) ?? ''}
                  onChange={v => set('condition', v)}
                  placeholder="Seleccionar condición..."
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="location">Ubicación</Label>
                <Input
                  id="location"
                  value={(form.location as string) ?? ''}
                  onChange={e => set('location', e.target.value)}
                  disabled={isLoading}
                  placeholder="Ej: Piso 2, Sala de máquinas"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="notes">Notas</Label>
                <textarea
                  id="notes"
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 resize-none"
                  value={(form.notes as string) ?? ''}
                  onChange={e => set('notes', e.target.value)}
                  disabled={isLoading}
                  placeholder="Observaciones adicionales..."
                />
              </div>
            </div>

            {/* Sección financiera */}
            {showFinancial && (
              <fieldset className="rounded-lg border border-gray-200 p-4 space-y-4">
                <legend className="px-2 text-sm font-semibold text-gray-700">Información Financiera</legend>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="purchasePrice">Precio de Compra</Label>
                    <Input
                      id="purchasePrice"
                      type="number"
                      min="0"
                      step="0.01"
                      value={(form.purchasePrice as string) ?? ''}
                      onChange={e => set('purchasePrice', e.target.value)}
                      disabled={isLoading}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="purchaseDate">Fecha de Compra</Label>
                    <Input
                      id="purchaseDate"
                      type="date"
                      value={(form.purchaseDate as string) ?? ''}
                      onChange={e => set('purchaseDate', e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Proveedor</Label>
                    <Combobox
                      options={supplierOptions}
                      value={(form.supplierId as string) ?? ''}
                      onChange={v => set('supplierId', v)}
                      placeholder="Buscar proveedor..."
                      disabled={isLoading}
                      emptyText="No hay proveedores registrados"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="invoiceNumber">Número de Factura</Label>
                    <Input
                      id="invoiceNumber"
                      value={(form.invoiceNumber as string) ?? ''}
                      onChange={e => set('invoiceNumber', e.target.value)}
                      disabled={isLoading}
                      placeholder="Ej: FAC-2024-0123"
                    />
                  </div>
                </div>
              </fieldset>
            )}

            {/* Sección depreciación */}
            {showDepr && (
              <fieldset className="rounded-lg border border-blue-100 bg-blue-50/30 p-4 space-y-4">
                <legend className="px-2 text-sm font-semibold text-blue-700">Depreciación</legend>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Método de Depreciación</Label>
                    <Combobox
                      options={DEPRECIATION_METHODS}
                      value={depreciationMethod as string}
                      onChange={v => set('depreciationMethod', v)}
                      placeholder="Seleccionar método..."
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="usefulLifeYears">Vida Útil (años)</Label>
                    <Input
                      id="usefulLifeYears"
                      type="number"
                      min="1"
                      value={(form.usefulLifeYears as string) ?? ''}
                      onChange={e => set('usefulLifeYears', e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="residualValue">Valor Residual</Label>
                    <Input
                      id="residualValue"
                      type="number"
                      min="0"
                      step="0.01"
                      value={(form.residualValue as string) ?? ''}
                      onChange={e => set('residualValue', e.target.value)}
                      disabled={isLoading}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="depreciationRate">Tasa Anual (%)</Label>
                    <Input
                      id="depreciationRate"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={(form.depreciationRate as string) ?? ''}
                      onChange={e => set('depreciationRate', e.target.value)}
                      disabled={isLoading}
                      placeholder="Ej: 20"
                    />
                  </div>
                  {depreciationMethod === 'UNITS_OF_PRODUCTION' && (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="totalUnits">Unidades Totales</Label>
                        <Input
                          id="totalUnits"
                          type="number"
                          min="1"
                          value={(form.totalUnits as string) ?? ''}
                          onChange={e => set('totalUnits', e.target.value)}
                          disabled={isLoading}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="usedUnits">Unidades Usadas</Label>
                        <Input
                          id="usedUnits"
                          type="number"
                          min="0"
                          value={(form.usedUnits as string) ?? ''}
                          onChange={e => set('usedUnits', e.target.value)}
                          disabled={isLoading}
                        />
                      </div>
                    </>
                  )}
                </div>
              </fieldset>
            )}

            {/* Sección contrato */}
            {showContract && (
              <fieldset className="rounded-lg border border-amber-100 bg-amber-50/30 p-4 space-y-4">
                <legend className="px-2 text-sm font-semibold text-amber-700">Contrato / Servicio</legend>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Tipo de Contrato</Label>
                    <Combobox
                      options={CONTRACT_TYPES}
                      value={(form.contractType as string) ?? ''}
                      onChange={v => set('contractType', v)}
                      placeholder="Seleccionar tipo..."
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contractRenewalCost">Costo de Renovación</Label>
                    <Input
                      id="contractRenewalCost"
                      type="number"
                      min="0"
                      step="0.01"
                      value={(form.contractRenewalCost as string) ?? ''}
                      onChange={e => set('contractRenewalCost', e.target.value)}
                      disabled={isLoading}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contractStartDate">Fecha Inicio</Label>
                    <Input
                      id="contractStartDate"
                      type="date"
                      value={(form.contractStartDate as string) ?? ''}
                      onChange={e => set('contractStartDate', e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contractEndDate">Fecha Fin</Label>
                    <Input
                      id="contractEndDate"
                      type="date"
                      value={(form.contractEndDate as string) ?? ''}
                      onChange={e => set('contractEndDate', e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </fieldset>
            )}

            {/* Sección stock MRO */}
            {showStock && (
              <fieldset className="rounded-lg border border-green-100 bg-green-50/30 p-4 space-y-4">
                <legend className="px-2 text-sm font-semibold text-green-700">Materiales MRO — Stock</legend>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="currentStock">Stock Actual</Label>
                    <Input id="currentStock" type="number" min="0" value={(form.currentStock as string) ?? ''} onChange={e => set('currentStock', e.target.value)} disabled={isLoading} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="minStock">Stock Mínimo</Label>
                    <Input id="minStock" type="number" min="0" value={(form.minStock as string) ?? ''} onChange={e => set('minStock', e.target.value)} disabled={isLoading} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="maxStock">Stock Máximo</Label>
                    <Input id="maxStock" type="number" min="0" value={(form.maxStock as string) ?? ''} onChange={e => set('maxStock', e.target.value)} disabled={isLoading} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="unitOfMeasure">Unidad de Medida</Label>
                    <Input id="unitOfMeasure" value={(form.unitOfMeasure as string) ?? ''} onChange={e => set('unitOfMeasure', e.target.value)} disabled={isLoading} placeholder="unidades, kg, litros..." />
                  </div>
                </div>
              </fieldset>
            )}

            {/* Bodega */}
            <fieldset className="rounded-lg border border-gray-200 p-4 space-y-3">
              <legend className="px-2 text-sm font-semibold text-gray-700">Bodega</legend>
              <Combobox
                options={warehouseOptions}
                value={(form.warehouseId as string) ?? ''}
                onChange={v => set('warehouseId', v)}
                placeholder="Buscar bodega... (opcional)"
                disabled={isLoading}
                emptyText="No hay bodegas registradas"
              />
            </fieldset>

            {/* Adjuntos */}
            <AttachmentZone files={files} onChange={setFiles} disabled={isLoading} />

            {/* Tags / etiquetas */}
            <div className="space-y-1.5">
              <Label htmlFor="serialNumber">Número de Serie</Label>
              <Input
                id="serialNumber"
                value={(form.serialNumber as string) ?? ''}
                onChange={e => set('serialNumber', e.target.value)}
                disabled={isLoading}
                placeholder="Ej: SN-ABC-123456"
              />
            </div>

            {/* Resumen de adjuntos */}
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    {f.name.length > 20 ? f.name.slice(0, 20) + '…' : f.name}
                    <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => window.history.back()} disabled={isLoading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading || !selectedFamilyId}>
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Guardar Activo
              </Button>
            </div>
          </>
        )}
      </form>

      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cambiar familia</AlertDialogTitle>
            <AlertDialogDescription>
              Al cambiar la familia se perderán los datos ingresados y los archivos adjuntos. ¿Deseas continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmFamilyChange}>Continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
