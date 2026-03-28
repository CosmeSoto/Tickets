'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select'
import { SimpleSelect } from '@/components/ui/simple-select'
import { FileUploadZone } from '@/components/ui/file-upload-zone'
import { ContractSection, type ContractData } from '@/components/inventory/contract-section'
import type { FamilyConfig } from '@/lib/inventory/family-config-types'
import { resolveSectionsForMode } from '@/lib/inventory/family-config-types'
import { X, Plus } from 'lucide-react'

interface EquipmentAssetFormProps {
  familyId: string
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

export function EquipmentAssetForm({
  familyId, familyConfig, onSubmit, onBack, submitting, submitError, maxFileSizeMB = 10,
}: EquipmentAssetFormProps) {
  const [acquisitionMode, setAcquisitionMode] = useState<'FIXED_ASSET' | 'RENTAL' | 'LOAN'>('FIXED_ASSET')
  const [code, setCode] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [equipmentTypeId, setEquipmentTypeId] = useState('')
  const [equipmentTypes, setEquipmentTypes] = useState<SearchableSelectOption[]>([])
  const [condition, setCondition] = useState('NEW')
  const [equipmentStatus, setEquipmentStatus] = useState('AVAILABLE')
  const [accessories, setAccessories] = useState<string[]>([])
  const [accessoryInput, setAccessoryInput] = useState('')
  const [specKey, setSpecKey] = useState('')
  const [specValue, setSpecValue] = useState('')
  const [specifications, setSpecifications] = useState<Record<string, string>>({})
  const [supplierId, setSupplierId] = useState('')
  const [suppliers, setSuppliers] = useState<SearchableSelectOption[]>([])
  const [contractData, setContractData] = useState<ContractData | null>(null)
  const [purchaseDate, setPurchaseDate] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [depreciationMethod, setDepreciationMethod] = useState('LINEAR')
  const [usefulLifeYears, setUsefulLifeYears] = useState('')
  const [residualValue, setResidualValue] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [warehouses, setWarehouses] = useState<SearchableSelectOption[]>([])
  const [assignedUserId, setAssignedUserId] = useState('')
  const [assignableUsers, setAssignableUsers] = useState<SearchableSelectOption[]>([])
  const [notes, setNotes] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const [priceError, setPriceError] = useState('')

  // Resolver secciones según modalidad activa (sectionsByMode tiene prioridad sobre global)
  const resolvedSections = resolveSectionsForMode(familyConfig, acquisitionMode)
  const isVisible = (s: string) => resolvedSections.visible.includes(s as never)

  useEffect(() => {
    fetch(`/api/inventory/equipment-types?familyId=${familyId}`)
      .then(r => r.json()).then(d => setEquipmentTypes(d.types ?? []))
    fetch('/api/inventory/warehouses')
      .then(r => r.json()).then(d => setWarehouses(d.warehouses ?? d ?? []))
  }, [familyId])

  useEffect(() => {
    if (acquisitionMode === 'RENTAL' || acquisitionMode === 'LOAN') {
      fetch('/api/inventory/suppliers').then(r => r.json()).then(d => setSuppliers(d.suppliers ?? []))
    }
  }, [acquisitionMode])

  useEffect(() => {
    if (equipmentStatus === 'ASSIGNED') {
      fetch('/api/users?limit=200').then(r => r.json()).then(d => {
        const list = d.data ?? d.users ?? []
        setAssignableUsers(list.map((u: { id: string; name?: string; email?: string }) => ({ id: u.id, name: u.name ?? u.email ?? u.id })))
      })
    }
  }, [equipmentStatus])

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
      condition,
      status: equipmentStatus,
      accessories: accessories.length ? accessories : undefined,
      specifications: Object.keys(specifications).length ? specifications : undefined,
      supplierId: supplierId || undefined,
      contractAction: contractData?.action,
      contractId: contractData?.contractId,
      contractNumber: contractData?.contractNumber,
      contractStartDate: contractData?.startDate,
      contractEndDate: contractData?.endDate,
      contractMonthlyCost: contractData?.monthlyCost,
      purchaseDate: purchaseDate || undefined,
      purchasePrice: purchasePrice ? parseFloat(purchasePrice) : undefined,
      invoiceNumber: invoiceNumber || undefined,
      depreciationMethod: depreciationMethod || undefined,
      usefulLifeYears: usefulLifeYears ? parseFloat(usefulLifeYears) : undefined,
      residualValue: residualValue ? parseFloat(residualValue) : undefined,
      warehouseId: equipmentStatus !== 'ASSIGNED' ? (warehouseId || undefined) : undefined,
      assignedUserId: equipmentStatus === 'ASSIGNED' ? (assignedUserId || undefined) : undefined,
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
        <Label>¿Cómo se adquirió este equipo?</Label>
        <SimpleSelect
          value={acquisitionMode}
          onChange={e => setAcquisitionMode(e.target.value as typeof acquisitionMode)}
          options={ACQUISITION_MODES}
        />
        <p className="text-xs text-muted-foreground">{ACQUISITION_MODES.find(m => m.value === acquisitionMode)?.help}</p>
      </div>

      {/* Código */}
      <div className="space-y-1">
        <Label>Código Interno <span className="text-xs font-normal text-muted-foreground">(opcional — se genera automáticamente)</span></Label>
        <Input value={code} onChange={e => setCode(e.target.value)} placeholder="Dejar vacío para generar automáticamente" />
      </div>

      {/* N° Serie */}
      <div className="space-y-1">
        <Label>N° de Serie del Fabricante</Label>
        <Input value={serialNumber} onChange={e => setSerialNumber(e.target.value)} placeholder="Ej: SN-ABC-12345" />
      </div>

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

      {/* Tipo de equipo */}
      <div className="space-y-1">
        <Label>Tipo de Equipo</Label>
        <SearchableSelect options={equipmentTypes} value={equipmentTypeId} onChange={setEquipmentTypeId} placeholder="Buscar tipo de equipo..." />
      </div>

      {/* Condición / Estado */}
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

      {/* Proveedor */}
      <div className="space-y-1">
        <Label>{supplierLabel} {supplierRequired && <span className="text-destructive">*</span>}</Label>
        <SearchableSelect options={suppliers} value={supplierId} onChange={setSupplierId} placeholder="Buscar proveedor..." />
      </div>

      {/* Contrato — solo RENTAL */}
      {acquisitionMode === 'RENTAL' && (
        <div className="rounded-md border border-border p-4 space-y-3">
          <ContractSection acquisitionMode="RENTAL" supplierId={supplierId || null} onContractChange={setContractData} />
        </div>
      )}

      {/* Sección FINANCIERO */}
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

      {/* Sección DEPRECIACIÓN */}
      {isVisible('DEPRECIATION') && (
        <fieldset className="rounded-lg border border-border p-4 space-y-3">
          <legend className="px-2 text-sm font-semibold text-foreground">Depreciación</legend>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label>Método</Label>
              <SimpleSelect value={depreciationMethod} onChange={e => setDepreciationMethod(e.target.value)}
                options={DEPRECIATION_METHODS}
              />
            </div>
            <div className="space-y-1">
              <Label>Vida Útil (años)</Label>
              <Input type="number" min="1" value={usefulLifeYears} onChange={e => setUsefulLifeYears(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Valor Residual</Label>
              <Input type="number" min="0" step="0.01" value={residualValue} onChange={e => setResidualValue(e.target.value)} placeholder="0.00" />
            </div>
          </div>
        </fieldset>
      )}

      {/* Asignado a usuario — solo cuando estado es ASSIGNED */}
      {equipmentStatus === 'ASSIGNED' && (
        <div className="space-y-1">
          <Label>Asignar a <span className="text-destructive">*</span></Label>
          <SearchableSelect options={assignableUsers} value={assignedUserId} onChange={setAssignedUserId} placeholder="Buscar usuario..." />
        </div>
      )}

      {/* Sección BODEGA — oculta si está asignado */}
      {isVisible('WAREHOUSE') && equipmentStatus !== 'ASSIGNED' && (
        <div className="space-y-1">
          <Label>Bodega</Label>
          <SearchableSelect options={warehouses} value={warehouseId} onChange={setWarehouseId} placeholder="Buscar bodega..." />
        </div>
      )}

      {/* Observaciones */}
      <div className="space-y-1">
        <Label>Observaciones</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Notas adicionales sobre el activo..." />
      </div>

      {/* Adjuntos */}
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
