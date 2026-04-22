'use client'

import { useState, useEffect, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select'
import { InlineCreateSelect } from '@/components/ui/inline-create-select'
import { SimpleSelect } from '@/components/ui/simple-select'
import { FileUploadZone } from '@/components/ui/file-upload-zone'
import { ContractPicker } from '@/components/contracts/contract-picker'
import { SupplierSelect } from '@/components/inventory/suppliers/SupplierSelect'
import { EquipmentTypeInlineForm } from '@/components/inventory/asset-forms/EquipmentTypeInlineForm'
import { WarehouseInlineForm } from '@/components/inventory/asset-forms/WarehouseInlineForm'
import type { FamilyConfig } from '@/lib/inventory/family-config-types'
import { resolveSectionsForMode } from '@/lib/inventory/family-config-types'
import {
  calculateDepreciation,
  familySupportsDepreciation,
  getRecommendedDepreciationMethod,
  DEFAULT_USEFUL_LIFE_YEARS,
  type DepreciationMethod,
} from '@/lib/inventory/depreciation'
import { useUserList } from '@/hooks/use-user-list'
import { useActiveDepartments } from '@/contexts/departments-context'
import { X, Plus, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'

interface EquipmentAssetFormProps {
  familyId: string
  familyCode?: string
  familyConfig: FamilyConfig
  onSubmit: (payload: Record<string, unknown>) => void
  onBack: () => void
  submitting: boolean
  submitError: string | null
  maxFileSizeMB?: number
}

const ACQUISITION_MODES = [
  { value: 'FIXED_ASSET', label: 'Compra directa (Activo Fijo)', help: 'Lo compraste — es propiedad de la empresa, se deprecia.' },
  { value: 'RENTAL',      label: 'Arrendamiento',                help: 'Pagas mensualidad; el proveedor sigue siendo el dueño.' },
  { value: 'LOAN',        label: 'Activo de Tercero',            help: 'Te lo prestan sin costo; el propietario conserva la titularidad.' },
]

const DEPRECIATION_METHODS = [
  { value: 'LINEAR',              label: 'Línea Recta' },
  { value: 'DECLINING_BALANCE',   label: 'Saldo Decreciente' },
  { value: 'UNITS_OF_PRODUCTION', label: 'Unidades de Producción' },
]

const DEPRECIATION_METHOD_HELP: Record<string, string> = {
  LINEAR:              'Deprecia el mismo monto cada año durante la vida útil del activo.',
  DECLINING_BALANCE:   'Deprecia un porcentaje mayor en los primeros años, reduciendo el valor más rápido.',
  UNITS_OF_PRODUCTION: 'Deprecia según el uso real del activo (horas, unidades producidas, etc.).',
}

interface FamilyDepreciationConfig {
  defaultDepreciationMethod: string | null
  defaultUsefulLifeYears: number | null
  defaultResidualValuePct: number | null
}

export function EquipmentAssetForm({
  familyId, familyCode, familyConfig, onSubmit, onBack, submitting, submitError, maxFileSizeMB = 10,
}: EquipmentAssetFormProps) {
  const [acquisitionMode, setAcquisitionMode] = useState<'FIXED_ASSET' | 'RENTAL' | 'LOAN'>('FIXED_ASSET')
  const [code, setCode] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [equipmentTypeId, setEquipmentTypeId] = useState('')
  const [equipmentTypes, setEquipmentTypes] = useState<{ id: string; name: string }[]>([])
  const [condition, setCondition] = useState('NEW')
  const [equipmentStatus, setEquipmentStatus] = useState('AVAILABLE')
  const [accessories, setAccessories] = useState<string[]>([])
  const [accessoryInput, setAccessoryInput] = useState('')
  const [specKey, setSpecKey] = useState('')
  const [specValue, setSpecValue] = useState('')
  const [specifications, setSpecifications] = useState<Record<string, string>>({})
  const [supplierId, setSupplierId] = useState('')
  const [linkedContractId, setLinkedContractId] = useState<string | null>(null)
  const [purchaseDate, setPurchaseDate] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [depreciationMethod, setDepreciationMethod] = useState('LINEAR')
  const [usefulLifeYears, setUsefulLifeYears] = useState('')
  const [residualValue, setResidualValue] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [warehouses, setWarehouses] = useState<{ id: string; name: string; description?: string }[]>([])
  const [assignedUserId, setAssignedUserId] = useState('')
  const [notes, setNotes] = useState('')
  const [physicalLocation, setPhysicalLocation] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const [priceError, setPriceError] = useState('')

  // ✅ Departamentos desde contexto global — filtrados por familyId en memoria
  const { departments: allDepartments } = useActiveDepartments()
  const departments = allDepartments.filter(
    (dept): dept is typeof dept & { familyId: string } => dept.familyId === familyId
  )
  const loadingDepartments = false

  // Department selector state
  const [departmentId, setDepartmentId] = useState('')

  // Task 19.1: family depreciation config from API
  const [familyDepConfig, setFamilyDepConfig] = useState<FamilyDepreciationConfig | null>(null)
  const [depreciationPreviewOpen, setDepreciationPreviewOpen] = useState(false)

  // Resolver secciones según modalidad activa (sectionsByMode tiene prioridad sobre global)
  const resolvedSections = resolveSectionsForMode(familyConfig, acquisitionMode)
  const isVisible = (s: string) => resolvedSections.visible.includes(s as never)

  // Task 19.1: determine if family supports depreciation
  const supportsDepreciation = familyCode ? familySupportsDepreciation(familyCode) : true

  useEffect(() => {
    fetch(`/api/inventory/equipment-types?familyId=${familyId}`)
      .then(r => r.json()).then(d => setEquipmentTypes(d.types ?? []))
    fetch(`/api/inventory/warehouses?familyId=${familyId}`)
      .then(r => r.json()).then(d => setWarehouses(d.warehouses ?? d ?? []))
  }, [familyId])

  // Task 19.1: fetch family-config depreciation defaults when familyId changes
  useEffect(() => {
    fetch(`/api/inventory/family-config/${familyId}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: (FamilyDepreciationConfig & Record<string, unknown>) | null) => {
        if (!data) return
        const cfg: FamilyDepreciationConfig = {
          defaultDepreciationMethod: data.defaultDepreciationMethod ?? null,
          defaultUsefulLifeYears: data.defaultUsefulLifeYears ?? null,
          defaultResidualValuePct: data.defaultResidualValuePct ?? null,
        }
        setFamilyDepConfig(cfg)

        // Pre-fill depreciation fields
        if (cfg.defaultDepreciationMethod) {
          setDepreciationMethod(cfg.defaultDepreciationMethod)
        } else if (familyCode) {
          setDepreciationMethod(getRecommendedDepreciationMethod(familyCode))
        }

        if (cfg.defaultUsefulLifeYears != null) {
          setUsefulLifeYears(String(cfg.defaultUsefulLifeYears))
        } else if (familyCode && DEFAULT_USEFUL_LIFE_YEARS[familyCode] != null) {
          const defaultYears = DEFAULT_USEFUL_LIFE_YEARS[familyCode]
          if (defaultYears > 0) setUsefulLifeYears(String(defaultYears))
        }

        // residualValue will be auto-calculated when purchasePrice is entered (task 19.2)
      })
      .catch(() => {})
  }, [familyId, familyCode])

  // Usuarios asignables: filtrados por departamento seleccionado cuando estado es ASSIGNED
  const { users: assignableUsersList } = useUserList({
    departmentId: departmentId || undefined,
    isActive: true,
    limit: 200,
    enabled: equipmentStatus === 'ASSIGNED',
  })

  // Convertir a formato SearchableSelectOption
  const assignableUsers: SearchableSelectOption[] = assignableUsersList.map(u => ({
    id: u.id,
    name: u.name || u.email || u.id,
  }))

  // Resetear usuario asignado si cambia el departamento
  useEffect(() => {
    setAssignedUserId('')
  }, [departmentId])

  // Task 19.2: auto-calculate suggested residual value when purchasePrice changes
  const suggestedResidualValue = useMemo(() => {
    const price = parseFloat(purchasePrice)
    if (!price || !familyDepConfig?.defaultResidualValuePct) return null
    return Math.round(price * (familyDepConfig.defaultResidualValuePct / 100) * 100) / 100
  }, [purchasePrice, familyDepConfig])

  // Task 19.3: real-time depreciation preview
  const depreciationPreview = useMemo(() => {
    const price = parseFloat(purchasePrice)
    const years = parseFloat(usefulLifeYears)
    const residual = parseFloat(residualValue) || 0
    if (!price || !purchaseDate || !years || years <= 0) return null

    const purchaseDateObj = new Date(purchaseDate)
    if (isNaN(purchaseDateObj.getTime())) return null

    const method = depreciationMethod as DepreciationMethod
    const checkYears = [1, 3, 5].filter(y => y <= years)
    // Always include the last year if not already included
    if (!checkYears.includes(Math.floor(years)) && years < 5) {
      checkYears.push(Math.floor(years))
      checkYears.sort((a, b) => a - b)
    }

    return checkYears.map(year => {
      const refDate = new Date(purchaseDateObj)
      refDate.setFullYear(refDate.getFullYear() + year)
      const result = calculateDepreciation(price, purchaseDateObj, years, residual, refDate, method)
      return { year, bookValue: result.bookValue }
    })
  }, [purchasePrice, purchaseDate, usefulLifeYears, residualValue, depreciationMethod])

  const addAccessory = () => {
    const v = accessoryInput.trim()
    if (v && !accessories.includes(v)) { setAccessories(p => [...p, v]); setAccessoryInput('') }
  }

  const addSpec = () => {
    const k = specKey.trim(); const v = specValue.trim()
    if (k && v) { setSpecifications(p => ({ ...p, [k]: v })); setSpecKey(''); setSpecValue('') }
  }

  const supplierLabel = acquisitionMode === 'RENTAL' ? 'Proveedor del Arrendamiento' : acquisitionMode === 'LOAN' ? 'Propietario del Bien' : 'Proveedor'
  const supplierRequired = acquisitionMode === 'RENTAL' || acquisitionMode === 'LOAN'
  const requireFinancialForNew = familyConfig.requireFinancialForNew ?? true
  const showFinancial = isVisible('FINANCIAL') || (requireFinancialForNew && condition === 'NEW')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPriceError('')
    if (requireFinancialForNew && condition === 'NEW' && !purchasePrice) {
      setPriceError('El precio de compra es obligatorio para activos nuevos')
      return
    }
    const payload: Record<string, unknown> = {
      acquisitionMode,
      code: code || undefined,
      serialNumber: serialNumber || undefined,
      brand: brand || undefined,
      model: model || undefined,
      typeId: equipmentTypeId || undefined,
      departmentId: departmentId || undefined,
      condition,
      status: equipmentStatus,
      accessories: accessories.length ? accessories : undefined,
      specifications: Object.keys(specifications).length ? specifications : undefined,
      supplierId: supplierId || undefined,
      contractId: linkedContractId || undefined,
      purchaseDate: purchaseDate || undefined,
      purchasePrice: purchasePrice ? parseFloat(purchasePrice) : undefined,
      invoiceNumber: invoiceNumber || undefined,
      depreciationMethod: depreciationMethod || undefined,
      usefulLifeYears: usefulLifeYears ? parseFloat(usefulLifeYears) : undefined,
      residualValue: residualValue ? parseFloat(residualValue) : undefined,
      warehouseId: equipmentStatus !== 'ASSIGNED' ? (warehouseId || undefined) : undefined,
      assignedUserId: equipmentStatus === 'ASSIGNED' ? (assignedUserId || undefined) : undefined,
      physicalLocation: physicalLocation || undefined,
      notes: notes || undefined,
    }
    onSubmit(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Botón atrás superior */}
      <button type="button" onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">← Atrás</button>

      {/* ── 1. IDENTIFICACIÓN ─────────────────────────────────────── */}
      {/* Marca / Modelo */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Marca</Label>
          <Input value={brand} onChange={e => setBrand(e.target.value)} placeholder="Ej: Dell" />
        </div>
        <div className="space-y-1">
          <Label>Modelo</Label>
          <Input value={model} onChange={e => setModel(e.target.value)} placeholder="Ej: Latitude 5520" />
        </div>
      </div>

      {/* N° Serie */}
      <div className="space-y-1">
        <Label>N° de Serie del Fabricante</Label>
        <Input value={serialNumber} onChange={e => setSerialNumber(e.target.value)} placeholder="Ej: SN-ABC-12345" />
      </div>

      {/* Código */}
      <div className="space-y-1">
        <Label>Código Interno <span className="text-xs font-normal text-muted-foreground">(opcional — se genera automáticamente)</span></Label>
        <Input value={code} onChange={e => setCode(e.target.value)} placeholder="Dejar vacío para generar automáticamente" />
      </div>

      {/* Tipo de equipo */}
      <div className="space-y-1">
        <Label>Tipo de Equipo</Label>
        <InlineCreateSelect
          options={equipmentTypes}
          value={equipmentTypeId}
          onChange={setEquipmentTypeId}
          placeholder="Buscar tipo de equipo..."
          createLabel="Crear tipo de equipo"
          createTitle="Nuevo tipo de equipo"
          editTitle="Editar tipo de equipo"
          deleteConfirmMessage="¿Eliminar este tipo de equipo? Solo es posible si no tiene activos asociados."
          createForm={({ item, onSuccess, onCancel }) => (
            <EquipmentTypeInlineForm
              familyId={familyId}
              item={item}
              onSuccess={(newItem) => {
                if (item) {
                  setEquipmentTypes(prev => prev.map(t => t.id === newItem.id ? newItem : t))
                } else {
                  setEquipmentTypes(prev => [...prev, newItem])
                }
                onSuccess(newItem)
              }}
              onCancel={onCancel}
            />
          )}
          onDelete={async (id) => {
            const res = await fetch(`/api/admin/equipment-types/${id}`, { method: 'DELETE' })
            if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error al eliminar') }
            setEquipmentTypes(prev => prev.filter(t => t.id !== id))
          }}
        />
      </div>

      {/* ── 2. UBICACIÓN ──────────────────────────────────────────── */}
      {/* Departamento */}
      <div className="space-y-1">
        <Label>Departamento <span className="text-destructive">*</span></Label>
        {loadingDepartments ? (
          <div className="h-9 rounded-md border border-input bg-background flex items-center px-3 text-sm text-muted-foreground">
            Cargando departamentos...
          </div>
        ) : departments.length === 0 ? (
          <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 shrink-0" />
            No hay departamentos activos para esta familia
          </div>
        ) : (
          <SearchableSelect
            options={departments.map(d => ({ id: d.id, name: d.name }))}
            value={departmentId}
            onChange={setDepartmentId}
            placeholder="Buscar departamento..."
          />
        )}
      </div>

      {/* ── 3. ESTADO + ASIGNACIÓN ────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Condición <span className="text-destructive">*</span></Label>
          <SimpleSelect value={condition} onChange={e => setCondition(e.target.value)}>
            <option value="NEW">Nuevo</option>
            <option value="LIKE_NEW">Como Nuevo</option>
            <option value="GOOD">Bueno</option>
            <option value="FAIR">Regular</option>
            <option value="POOR">Malo</option>
          </SimpleSelect>
          {condition === 'NEW' && requireFinancialForNew && <p className="text-xs text-amber-600 dark:text-amber-400">Activo nuevo — información financiera obligatoria.</p>}
        </div>
        <div className="space-y-1">
          <Label>Estado</Label>
          <SimpleSelect value={equipmentStatus} onChange={e => setEquipmentStatus(e.target.value)}>
            <option value="AVAILABLE">Disponible</option>
            <option value="ASSIGNED">Asignado</option>
            <option value="MAINTENANCE">En Mantenimiento</option>
            <option value="DAMAGED">Dañado</option>
            <option value="RETIRED">Retirado</option>
          </SimpleSelect>
        </div>
      </div>

      {/* Asignar a usuario — aparece inmediatamente después de seleccionar "Asignado" */}
      {equipmentStatus === 'ASSIGNED' && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1">
          <Label>Asignar a <span className="text-destructive">*</span></Label>
          <SearchableSelect
            options={assignableUsers}
            value={assignedUserId}
            onChange={setAssignedUserId}
            placeholder={departmentId ? 'Buscar usuario del departamento...' : 'Selecciona un departamento primero'}
            disabled={!departmentId}
          />
          {!departmentId && (
            <p className="text-xs text-amber-600 dark:text-amber-400">Selecciona un departamento para ver los usuarios disponibles.</p>
          )}
        </div>
      )}

      {/* Bodega — solo si no está asignado */}
      {isVisible('WAREHOUSE') && equipmentStatus !== 'ASSIGNED' && (
        <div className="space-y-1">
          <Label>Bodega</Label>
          <InlineCreateSelect
            options={warehouses}
            value={warehouseId}
            onChange={setWarehouseId}
            placeholder="Buscar bodega..."
            allowClear
            createLabel="Crear bodega"
            createTitle="Nueva bodega"
            createForm={({ onSuccess, onCancel }) => (
              <WarehouseInlineForm
                defaultFamilyId={familyId}
                onSuccess={(item) => {
                  setWarehouses(prev => [...prev, item])
                  onSuccess(item)
                }}
                onCancel={onCancel}
              />
            )}
          />
        </div>
      )}

      {/* ── 4. DETALLES DEL EQUIPO ────────────────────────────────── */}
      {/* Accesorios */}
      <div className="space-y-2">
        <Label>Accesorios</Label>
        <div className="flex gap-2">
          <Input value={accessoryInput} onChange={e => setAccessoryInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAccessory() } }}
            placeholder="Ej: Cargador, Mouse, Funda..." />
          <Button type="button" variant="outline" size="sm" onClick={addAccessory}><Plus className="h-4 w-4" /></Button>
        </div>
        {accessories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {accessories.map(a => (
              <span key={a} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs">
                {a}
                <button type="button" onClick={() => setAccessories(p => p.filter(x => x !== a))}><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Especificaciones */}
      <div className="space-y-2">
        <Label>Características / Especificaciones</Label>
        <div className="flex gap-2">
          <Input value={specKey} onChange={e => setSpecKey(e.target.value)} placeholder="Ej: Procesador" className="flex-1" />
          <Input value={specValue} onChange={e => setSpecValue(e.target.value)} placeholder="Ej: Intel i5-1135G7" className="flex-1"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSpec() } }} />
          <Button type="button" variant="outline" size="sm" onClick={addSpec}><Plus className="h-4 w-4" /></Button>
        </div>
        {Object.keys(specifications).length > 0 && (
          <div className="rounded-md border border-border divide-y divide-border text-sm">
            {Object.entries(specifications).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-3 py-1.5">
                <span><span className="font-medium">{k}:</span> {v}</span>
                <button type="button" onClick={() => setSpecifications(p => { const n = { ...p }; delete n[k]; return n })}><X className="h-3 w-3 text-muted-foreground" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 5. ADQUISICIÓN ────────────────────────────────────────── */}
      {/* Modalidad */}
      <div className="space-y-1">
        <Label>¿Cómo se adquirió este equipo?</Label>
        <SimpleSelect
          value={acquisitionMode}
          onChange={e => setAcquisitionMode(e.target.value as typeof acquisitionMode)}
          options={ACQUISITION_MODES}
        />
        <p className="text-xs text-muted-foreground">{ACQUISITION_MODES.find(m => m.value === acquisitionMode)?.help}</p>
      </div>

      {/* Proveedor */}
      <div className="space-y-1">
        <Label>{supplierLabel} {supplierRequired && <span className="text-destructive">*</span>}</Label>
        <SupplierSelect
          value={supplierId || null}
          onChange={v => setSupplierId(v || '')}
          familyId={familyId}
        />
      </div>

      {/* Contrato — RENTAL y LOAN */}
      {(acquisitionMode === 'RENTAL' || acquisitionMode === 'LOAN') && (
        <div className="rounded-md border border-border p-4 space-y-3">
          <p className="text-sm font-medium">
            {acquisitionMode === 'RENTAL' ? 'Contrato de arrendamiento' : 'Contrato del activo de tercero'}
          </p>
          <ContractPicker
            value={linkedContractId}
            onChange={setLinkedContractId}
            supplierId={supplierId || null}
            familyId={familyId}
          />
        </div>
      )}

      {/* ── 6. FINANCIERO + DEPRECIACIÓN ──────────────────────────── */}
      {showFinancial && (
        <fieldset className="rounded-lg border border-border p-4 space-y-3">
          <legend className="px-2 text-sm font-semibold text-foreground">
            Información Financiera {requireFinancialForNew && condition === 'NEW' && <span className="text-destructive">*</span>}
          </legend>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Precio de Compra {requireFinancialForNew && condition === 'NEW' && <span className="text-destructive">*</span>}</Label>
              <Input type="number" min="0" step="0.01" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} placeholder="0.00" />
              {priceError && <p className="text-xs text-destructive">{priceError}</p>}
            </div>
            <div className="space-y-1">
              <Label>Fecha de Compra</Label>
              <Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label>N° de Factura</Label>
              <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Ej: FAC-2024-0123" />
            </div>
          </div>
        </fieldset>
      )}

      {isVisible('DEPRECIATION') && supportsDepreciation && (
        <fieldset className="rounded-lg border border-border p-4 space-y-3">
          <legend className="px-2 text-sm font-semibold text-foreground">Depreciación</legend>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label>Método de Depreciación</Label>
              <SimpleSelect value={depreciationMethod} onChange={e => setDepreciationMethod(e.target.value)} options={DEPRECIATION_METHODS} />
              {DEPRECIATION_METHOD_HELP[depreciationMethod] && (
                <p className="text-xs text-muted-foreground">{DEPRECIATION_METHOD_HELP[depreciationMethod]}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Vida Útil (años)</Label>
              <Input type="number" min="1" value={usefulLifeYears} onChange={e => setUsefulLifeYears(e.target.value)} />
              <p className="text-xs text-muted-foreground">Ej: laptops 3-5 años, servidores 5-7 años, mobiliario 10 años.</p>
            </div>
            <div className="space-y-1">
              <Label>Valor Residual</Label>
              <Input type="number" min="0" step="0.01" value={residualValue} onChange={e => setResidualValue(e.target.value)} placeholder="0.00" />
              <p className="text-xs text-muted-foreground">Valor estimado del activo al final de su vida útil.</p>
              {suggestedResidualValue != null && !residualValue && (
                <button type="button" className="text-xs text-primary hover:underline"
                  onClick={() => setResidualValue(String(suggestedResidualValue))}>
                  Sugerido: ${suggestedResidualValue.toLocaleString('es-CL')} ({familyDepConfig?.defaultResidualValuePct}% del precio)
                </button>
              )}
            </div>
          </div>
          {depreciationPreview && depreciationPreview.length > 0 && (
            <div className="mt-2 rounded-md border border-border bg-muted/30">
              <button type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium"
                onClick={() => setDepreciationPreviewOpen(p => !p)}>
                <span>Vista previa de depreciación</span>
                {depreciationPreviewOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {depreciationPreviewOpen && (
                <div className="border-t border-border px-3 py-2 space-y-1">
                  <p className="text-xs text-muted-foreground mb-2">Valor libro estimado (solo informativo):</p>
                  <div className="grid grid-cols-3 gap-2">
                    {depreciationPreview.map(({ year, bookValue }) => (
                      <div key={year} className="rounded-md bg-background border border-border p-2 text-center">
                        <p className="text-xs text-muted-foreground">Año {year}</p>
                        <p className="text-sm font-semibold">${bookValue.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </fieldset>
      )}

      {/* ── 7. NOTAS Y ADJUNTOS ───────────────────────────────────── */}
      <div className="space-y-1">
        <Label>Ubicación física actual <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
        <Input
          value={physicalLocation}
          onChange={e => setPhysicalLocation(e.target.value)}
          placeholder="Ej: Oficina 201, Piso 3, Sala de Servidores..."
        />
        <p className="text-xs text-muted-foreground">Dónde se encuentra el equipo actualmente (distinto a la bodega de almacenamiento).</p>
      </div>

      <div className="space-y-1">
        <Label>Observaciones</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Notas adicionales sobre el activo..." />
      </div>

      <FileUploadZone files={attachments} onChange={setAttachments} maxFileSizeMB={maxFileSizeMB} />

      {submitError && <p className="text-sm text-destructive">{submitError}</p>}

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onBack} disabled={submitting}>← Atrás</Button>
        <Button type="submit" disabled={submitting} className="flex-1">
          {submitting ? 'Guardando...' : 'Crear Activo'}
        </Button>
      </div>
    </form>
  )
}
