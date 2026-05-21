'use client'

import { useState, useEffect, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { SerialNumberInput } from '@/components/ui/serial-number-input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select'
import { InlineCreateSelect } from '@/components/ui/inline-create-select'
import { SimpleSelect } from '@/components/ui/simple-select'
import { ContractPicker } from '@/components/contracts/contract-picker'
import { SupplierSelect } from '@/components/inventory/suppliers/SupplierSelect'
import { EquipmentTypeInlineForm } from '@/components/inventory/asset-forms/EquipmentTypeInlineForm'
import { EquipmentModelInlineForm } from '@/components/inventory/asset-forms/EquipmentModelInlineForm'
import { EquipmentBrandInlineForm } from '@/components/inventory/asset-forms/EquipmentBrandInlineForm'
import { WarehouseInlineForm } from '@/components/inventory/asset-forms/WarehouseInlineForm'
import { AssignableUserSelect } from '@/components/inventory/shared/AssignableUserSelect'
import { MaintenanceStatusBlock } from '@/components/inventory/shared/MaintenanceStatusBlock'
import { TypeAttributesInput } from '@/components/inventory/custom-fields/type-attributes-input'
import { AttachmentsField } from '@/components/inventory/shared/AttachmentsField'
import { AccessoriesSection } from '@/components/inventory/shared/AccessoriesSection'
import { useToast } from '@/hooks/use-toast'
import {
  showDepartmentSelector,
  showWarehouseSelector,
  showMaintenanceBlock,
  showAssignmentBlock,
  showForSalePriceField,
} from '@/lib/inventory/status-visibility'
import type { FamilyConfig } from '@/lib/inventory/family-config-types'
import { resolveSectionsForMode } from '@/lib/inventory/family-config-types'
import {
  calculateDepreciation,
  familySupportsDepreciation,
  getRecommendedDepreciationMethod,
  DEFAULT_USEFUL_LIFE_YEARS,
  type DepreciationMethod,
} from '@/lib/inventory/depreciation'
import { useActiveDepartments } from '@/contexts/departments-context'
import { X, Plus, ChevronDown, ChevronUp, AlertCircle, Tag } from 'lucide-react'

interface EquipmentAssetFormProps {
  familyId: string
  familyCode?: string
  familyConfig: FamilyConfig
  onSubmit: (payload: Record<string, unknown>) => void
  onBack: () => void
  submitting: boolean
  submitError: string | null
  maxFileSizeMB?: number
  isEditMode?: boolean
}

const ACQUISITION_MODES = [
  {
    value: 'FIXED_ASSET',
    label: 'Compra directa (Activo Fijo)',
    help: 'Lo compraste — es propiedad de la empresa, se deprecia.',
  },
  {
    value: 'RENTAL',
    label: 'Arrendamiento',
    help: 'Pagas mensualidad; el proveedor sigue siendo el dueño.',
  },
  {
    value: 'LOAN',
    label: 'Activo de Tercero',
    help: 'Te lo prestan sin costo; el propietario conserva la titularidad.',
  },
]

const DEPRECIATION_METHODS = [
  { value: 'LINEAR', label: 'Línea Recta' },
  { value: 'DECLINING_BALANCE', label: 'Saldo Decreciente Acelerado' },
  { value: 'UNITS_OF_PRODUCTION', label: 'Por Uso (horas / km / ciclos)' },
]

// Descripción corta visible bajo el selector
const DEPRECIATION_METHOD_HELP: Record<string, string> = {
  LINEAR:
    'Descuenta el mismo monto cada año. Ideal para mobiliario, infraestructura y equipos de uso constante.',
  DECLINING_BALANCE:
    'Descuenta más en los primeros años y menos al final. Ideal para tecnología que se vuelve obsoleta rápido (laptops, servidores).',
  UNITS_OF_PRODUCTION:
    'Descuenta según cuánto se usa el equipo, no por el tiempo. Ideal para generadores, vehículos, compresores o cualquier equipo donde puedas medir horas de operación, kilómetros o ciclos.',
}

// Ejemplo concreto expandido que aparece al seleccionar el método
const DEPRECIATION_METHOD_EXAMPLE: Record<string, string> = {
  LINEAR:
    'Ejemplo: una laptop de $1.200 con vida útil de 4 años deprecia $300 por año, todos los años por igual.',
  DECLINING_BALANCE:
    'Ejemplo: una laptop de $1.200 deprecia ~$600 el primer año, ~$300 el segundo, ~$150 el tercero — el valor cae rápido al inicio.',
  UNITS_OF_PRODUCTION:
    'Ejemplo: un generador de $10.000 con vida útil de 10.000 horas. Si este año operó 1.500 horas, deprecia $1.500 ese año. Si el próximo año solo operó 500 horas, deprecia $500.',
}

interface FamilyDepreciationConfig {
  defaultDepreciationMethod: string | null
  defaultUsefulLifeYears: number | null
  defaultResidualValuePct: number | null
}

export function EquipmentAssetForm({
  familyId,
  familyCode,
  familyConfig,
  onSubmit,
  onBack,
  submitting,
  submitError,
  maxFileSizeMB = 10,
  isEditMode = false,
}: EquipmentAssetFormProps) {
  const { toast } = useToast()
  const [acquisitionMode, setAcquisitionMode] = useState<'FIXED_ASSET' | 'RENTAL' | 'LOAN'>(
    'FIXED_ASSET'
  )
  const [code, setCode] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [selectedBrandId, setSelectedBrandId] = useState('')
  const [brands, setBrands] = useState<Array<{ id: string; name: string; code?: string }>>([])
  const [selectedModelId, setSelectedModelId] = useState('')
  const [equipmentModels, setEquipmentModels] = useState<
    Array<{ id: string; name: string; brandId?: string; model: string }>
  >([])
  const [equipmentTypeId, setEquipmentTypeId] = useState('')
  const [equipmentTypes, setEquipmentTypes] = useState<
    Array<{
      id: string
      name: string
      trackMaintenance?: boolean
    }>
  >([])
  // Configuración del tipo seleccionado
  const [selectedTypeConfig, setSelectedTypeConfig] = useState<{
    trackMaintenance: boolean
  }>({
    trackMaintenance: false,
  })
  const [condition, setCondition] = useState('NEW')
  const [equipmentStatus, setEquipmentStatus] = useState('AVAILABLE')
  const [accessories, setAccessories] = useState<string[]>([])
  // Campos personalizados
  const [customFieldValues, setCustomFieldValues] = useState<
    Array<{ fieldName: string; fieldValue: string }>
  >([])
  const [supplierId, setSupplierId] = useState('')
  const [linkedContractId, setLinkedContractId] = useState<string | null>(null)
  const [purchaseDate, setPurchaseDate] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [estimatedPrice, setEstimatedPrice] = useState('')
  const [depreciationMethod, setDepreciationMethod] = useState('LINEAR')
  const [usefulLifeYears, setUsefulLifeYears] = useState('')
  const [residualValue, setResidualValue] = useState('')
  // Campos para método "Por Uso"
  const [totalUnits, setTotalUnits] = useState('') // capacidad total (horas/km/ciclos)
  const [usedUnits, setUsedUnits] = useState('') // unidades ya consumidas
  const [unitLabel, setUnitLabel] = useState('horas') // etiqueta personalizable
  const [warehouseId, setWarehouseId] = useState('')
  const [warehouses, setWarehouses] = useState<
    { id: string; name: string; description?: string }[]
  >([])
  const [assignedUserId, setAssignedUserId] = useState('')
  // Departamento derivado del usuario asignado (solo lectura cuando estado=ASSIGNED)
  const [assignedUserDept, setAssignedUserDept] = useState<{ id: string; name: string } | null>(
    null
  )
  const [notes, setNotes] = useState('')
  const [physicalLocation, setPhysicalLocation] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const [priceError, setPriceError] = useState('')
  const [saleListingPrice, setSaleListingPrice] = useState('')

  // Mantenimiento
  const [maintenanceDate, setMaintenanceDate] = useState(
    () => new Date().toISOString().split('T')[0]
  )
  const [maintenanceType, setMaintenanceType] = useState<'PREVENTIVE' | 'CORRECTIVE'>('CORRECTIVE')
  const [maintenanceTechnicianId, setMaintenanceTechnicianId] = useState('')
  const [maintenanceDescription, setMaintenanceDescription] = useState('')
  const [techniciansList, setTechniciansList] = useState<
    { id: string; name: string; email: string }[]
  >([])
  const [loadingTechnicians, setLoadingTechnicians] = useState(false)

  // ✅ Departamentos desde contexto global — solo para referencia (no editable)
  const { departments: allDepartments } = useActiveDepartments()
  const departments = allDepartments.filter(
    (dept): dept is typeof dept & { familyId: string } => dept.familyId === familyId
  )

  // departmentId efectivo: solo el del usuario asignado cuando estado = ASSIGNED
  const effectiveDepartmentId = equipmentStatus === 'ASSIGNED' ? (assignedUserDept?.id ?? '') : ''

  // Task 19.1: family depreciation config from API
  const [familyDepConfig, setFamilyDepConfig] = useState<FamilyDepreciationConfig | null>(null)
  const [depreciationPreviewOpen, setDepreciationPreviewOpen] = useState(false)

  // Resolver secciones según modalidad activa (sectionsByMode tiene prioridad sobre global)
  const resolvedSections = resolveSectionsForMode(familyConfig, acquisitionMode)
  const isVisible = (s: string) => resolvedSections.visible.includes(s as never)

  // Bodega: solo cuando el equipo está físicamente almacenado (AVAILABLE o DAMAGED)
  const showWarehouse = isVisible('WAREHOUSE') && showWarehouseSelector(equipmentStatus)

  // Task 19.1: determine if family supports depreciation
  const supportsDepreciation = familyCode ? familySupportsDepreciation(familyCode) : true

  useEffect(() => {
    fetch(`/api/inventory/equipment-types?familyId=${familyId}`)
      .then(r => r.json())
      .then(d => setEquipmentTypes(d.types ?? []))
    fetch(`/api/inventory/warehouses?familyId=${familyId}`)
      .then(r => r.json())
      .then(d => setWarehouses(d.warehouses ?? d ?? []))
    fetch(`/api/inventory/brands?familyId=${familyId}`)
      .then(r => r.json())
      .then(d => setBrands(d.brands ?? []))
  }, [familyId])

  // Cargar modelos y configuración cuando se selecciona un tipo de equipo o marca
  useEffect(() => {
    if (!equipmentTypeId) {
      setEquipmentModels([])
      setSelectedModelId('')
      setSelectedTypeConfig({
        trackMaintenance: false,
      })
      return
    }

    // Cargar la configuración del tipo seleccionado
    const selectedType = equipmentTypes.find(t => t.id === equipmentTypeId)
    if (selectedType) {
      setSelectedTypeConfig({
        trackMaintenance: selectedType.trackMaintenance ?? false,
      })
    }

    // Cargar modelos
    const params = new URLSearchParams()
    params.set('typeId', equipmentTypeId)
    params.set('limit', '100')
    if (selectedBrandId) {
      params.set('brandId', selectedBrandId)
    }

    fetch(`/api/inventory/models?${params.toString()}`)
      .then(r => r.json())
      .then(d => {
        const models = (d.models ?? d.data ?? []).map((m: any) => ({
          id: m.id,
          name: m.brand ? `${m.brand.name} ${m.model}` : m.model,
          brandId: m.brandId,
          model: m.model,
        }))
        setEquipmentModels(models)
      })
      .catch(() => setEquipmentModels([]))
  }, [equipmentTypeId, equipmentTypes, selectedBrandId])

  // Task 19.1: fetch family-config depreciation defaults when familyId changes
  useEffect(() => {
    fetch(`/api/inventory/family-config/${familyId}`)
      .then(r => (r.ok ? r.json() : null))
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

  // Usuarios asignables: cargados desde el endpoint de inventario con lógica de rol/familia
  const [assignableUsersList, setAssignableUsersList] = useState<
    { id: string; name: string; email: string; department?: { id: string; name: string } | null }[]
  >([])
  const [loadingAssignableUsers, setLoadingAssignableUsers] = useState(false)

  useEffect(() => {
    if (equipmentStatus !== 'ASSIGNED') return

    setLoadingAssignableUsers(true)
    const params = new URLSearchParams()
    if (familyId) params.set('familyId', familyId)

    fetch(`/api/inventory/assignable-users?${params}`)
      .then(r => (r.ok ? r.json() : { users: [] }))
      .then(data => setAssignableUsersList(data.users ?? []))
      .catch(() => setAssignableUsersList([]))
      .finally(() => setLoadingAssignableUsers(false))
  }, [equipmentStatus, familyId])

  // Convertir a formato SearchableSelectOption
  const assignableUsers: SearchableSelectOption[] = assignableUsersList.map(u => ({
    id: u.id,
    name: u.department ? `${u.name || u.email} — ${u.department.name}` : u.name || u.email || u.id,
  }))

  // Al seleccionar usuario, auto-completar departamento
  const handleAssignedUserChange = (userId: string) => {
    setAssignedUserId(userId)
    const user = assignableUsersList.find(u => u.id === userId)
    setAssignedUserDept(user?.department ?? null)
  }

  // Limpiar asignación al cambiar estado
  useEffect(() => {
    if (equipmentStatus !== 'ASSIGNED') {
      setAssignedUserId('')
      setAssignedUserDept(null)
    }
    // Limpiar bodega si el estado ya no la soporta
    if (!['AVAILABLE', 'DAMAGED'].includes(equipmentStatus)) {
      setWarehouseId('')
    }
    // Limpiar departamento manual si pasa a RETIRED (no aplica)
    if (equipmentStatus === 'RETIRED') {
      setDepartmentId('')
    }
  }, [equipmentStatus])

  // Cargar técnicos cuando el estado es MAINTENANCE
  useEffect(() => {
    if (equipmentStatus !== 'MAINTENANCE') return
    setLoadingTechnicians(true)
    fetch('/api/users?role=TECHNICIAN&isActive=true&limit=200')
      .then(r => (r.ok ? r.json() : { data: [] }))
      .then(data => setTechniciansList(data.data ?? []))
      .catch(() => setTechniciansList([]))
      .finally(() => setLoadingTechnicians(false))
  }, [equipmentStatus])

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
    if (!price || !years || years <= 0) return null

    const method = depreciationMethod as DepreciationMethod

    // Para "Por Uso": la preview simula uso uniforme anual (no necesita fecha)
    if (method === 'UNITS_OF_PRODUCTION') {
      const total = parseFloat(totalUnits)
      if (!total || total <= 0) return null
      const unitsPerYear = total / years
      const checkYears = [1, 3, 5].filter(y => y <= years)
      if (!checkYears.includes(Math.floor(years)) && years < 5) {
        checkYears.push(Math.floor(years))
        checkYears.sort((a, b) => a - b)
      }
      return checkYears.map(year => {
        const simulatedUsed = Math.min(unitsPerYear * year, total)
        const ratePerUnit = (price - residual) / total
        const bookValue = Math.max(price - ratePerUnit * simulatedUsed, residual)
        return { year, bookValue: Math.round(bookValue) }
      })
    }

    // Para LINEAR y DECLINING_BALANCE: usa fecha de compra si existe, si no simula desde hoy
    const baseDateObj = purchaseDate ? new Date(purchaseDate) : new Date()
    if (isNaN(baseDateObj.getTime())) return null

    const checkYears = [1, 3, 5].filter(y => y <= years)
    if (!checkYears.includes(Math.floor(years)) && years < 5) {
      checkYears.push(Math.floor(years))
      checkYears.sort((a, b) => a - b)
    }

    return checkYears.map(year => {
      const refDate = new Date(baseDateObj)
      refDate.setFullYear(refDate.getFullYear() + year)
      const result = calculateDepreciation(price, baseDateObj, years, residual, refDate, method)
      return { year, bookValue: result.bookValue }
    })
  }, [purchasePrice, purchaseDate, usefulLifeYears, residualValue, depreciationMethod, totalUnits])

  const supplierLabel =
    acquisitionMode === 'RENTAL'
      ? 'Proveedor del Arrendamiento'
      : acquisitionMode === 'LOAN'
        ? 'Propietario del Bien'
        : 'Proveedor'
  const supplierRequired = acquisitionMode === 'RENTAL' || acquisitionMode === 'LOAN'
  const requireFinancialForNew = familyConfig.requireFinancialForNew ?? true

  // Estados permitidos por condición
  const allowedStatusesByCondition: Record<string, string[]> = {
    NEW: ['AVAILABLE', 'ASSIGNED', 'MAINTENANCE'],
    GOOD: ['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'FOR_SALE'],
    POOR: ['DAMAGED', 'FOR_SALE', 'RETIRED'],
  }

  // Mensajes informativos por condición
  const conditionMessage: Record<string, string> = {
    NEW: 'Activo nuevo — información financiera obligatoria.',
    GOOD: 'Se puede asignar, poner en mantenimiento o vender.',
    POOR: 'Se puede vender como piezas, dar de baja o marcar como dañado.',
  }

  // Lógica de campos visibles
  const showFinancial =
    (isVisible('FINANCIAL') || (requireFinancialForNew && condition === 'NEW')) &&
    acquisitionMode === 'FIXED_ASSET' &&
    condition === 'NEW'

  const showEstimatedPrice =
    (condition === 'GOOD' || condition === 'POOR') && acquisitionMode === 'FIXED_ASSET'

  // Estado actualizado solo si es permitido por la condición
  useEffect(() => {
    const allowed = allowedStatusesByCondition[condition] || []
    if (!allowed.includes(equipmentStatus)) {
      setEquipmentStatus(allowed[0] || 'AVAILABLE')
    }
  }, [condition])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPriceError('')
    if (!equipmentTypeId) return

    // Validar campos obligatorios
    if (!selectedBrandId) return
    if (!selectedModelId) return
    if (!serialNumber.trim()) return
    if (requireFinancialForNew && condition === 'NEW' && !purchasePrice) {
      setPriceError('El precio de compra es obligatorio para activos nuevos')
      return
    }
    const selectedModel = equipmentModels.find(m => m.id === selectedModelId)
    const payload: Record<string, unknown> = {
      acquisitionMode,
      code: code || undefined,
      serialNumber: serialNumber || undefined,
      brandId: selectedBrandId || undefined,
      modelId: selectedModelId || undefined,
      typeId: equipmentTypeId || undefined,
      departmentId: effectiveDepartmentId || undefined,
      condition,
      status: equipmentStatus,
      accessories: accessories.length ? accessories : undefined,
      customValues: customFieldValues.length ? customFieldValues : undefined,
      supplierId: supplierId || undefined,
      contractId: linkedContractId || undefined,
      purchaseDate: purchaseDate || undefined,
      purchasePrice: purchasePrice ? parseFloat(purchasePrice) : undefined,
      invoiceNumber: invoiceNumber || undefined,
      depreciationMethod:
        acquisitionMode === 'FIXED_ASSET' ? depreciationMethod || undefined : undefined,
      usefulLifeYears:
        acquisitionMode === 'FIXED_ASSET' && usefulLifeYears
          ? parseFloat(usefulLifeYears)
          : undefined,
      residualValue:
        acquisitionMode === 'FIXED_ASSET' && residualValue ? parseFloat(residualValue) : undefined,
      // Campos "Por Uso" — solo cuando el método es UNITS_OF_PRODUCTION y es activo propio
      ...(acquisitionMode === 'FIXED_ASSET' &&
        depreciationMethod === 'UNITS_OF_PRODUCTION' && {
          totalUnits: totalUnits ? parseFloat(totalUnits) : undefined,
          usedUnits: usedUnits ? parseFloat(usedUnits) : undefined,
        }),
      warehouseId: showWarehouse ? warehouseId || undefined : undefined,
      assignedUserId: equipmentStatus === 'ASSIGNED' ? assignedUserId || undefined : undefined,
      // Mantenimiento — solo cuando el estado es MAINTENANCE
      ...(equipmentStatus === 'MAINTENANCE' && {
        maintenanceDate: maintenanceDate || undefined,
        maintenanceType: maintenanceType || undefined,
        maintenanceTechnicianId: maintenanceTechnicianId || undefined,
        maintenanceDescription: maintenanceDescription || undefined,
      }),
      physicalLocation: physicalLocation || undefined,
      notes: notes || undefined,
      // Archivos adjuntos — se suben después de crear el activo
      attachments: attachments.length ? attachments : undefined,
      ...(saleListingPrice
        ? { saleListingPrice: parseFloat(saleListingPrice) }
        : { saleListingPrice: null }),
      // Precio estimado para Bueno/Malo
      ...(showEstimatedPrice && estimatedPrice
        ? { estimatedPrice: parseFloat(estimatedPrice) }
        : {}),
    }
    onSubmit(payload)
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-5'>
      {/* Botón atrás superior */}
      <button
        type='button'
        onClick={onBack}
        className='text-sm text-muted-foreground hover:text-foreground'
      >
        ← Atrás
      </button>

      {/* ── 1. IDENTIFICACIÓN ─────────────────────────────────────── */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
        {/* Tipo de equipo */}
        <div className='space-y-1'>
          <Label>
            Tipo de Equipo <span className='text-destructive'>*</span>
          </Label>
          <InlineCreateSelect
            options={equipmentTypes}
            value={equipmentTypeId}
            onChange={setEquipmentTypeId}
            placeholder='Buscar tipo de equipo...'
            createLabel='Crear tipo de equipo'
            createTitle='Nuevo tipo de equipo'
            editTitle='Editar tipo de equipo'
            deleteConfirmMessage='¿Eliminar este tipo de equipo? Solo es posible si no tiene activos asociados.'
            createForm={({ item, onSuccess, onCancel }) => (
              <EquipmentTypeInlineForm
                familyId={familyId}
                item={item}
                onSuccess={newItem => {
                  if (item) {
                    setEquipmentTypes(prev => prev.map(t => (t.id === newItem.id ? newItem : t)))
                  } else {
                    setEquipmentTypes(prev => [...prev, newItem])
                  }
                  onSuccess(newItem)
                }}
                onCancel={onCancel}
              />
            )}
            onDelete={async id => {
              const res = await fetch(`/api/admin/equipment-types/${id}`, { method: 'DELETE' })
              if (!res.ok) {
                const d = await res.json()
                throw new Error(d.error || 'Error al eliminar')
              }
              setEquipmentTypes(prev => prev.filter(t => t.id !== id))
              if (equipmentTypeId === id) {
                setEquipmentTypeId('')
                setSelectedBrandId('')
                setSelectedModelId('')
              }
            }}
          />
        </div>

        {/* Marca */}
        {equipmentTypeId && (
          <div className='space-y-1'>
            <Label>
              Marca <span className='text-destructive'>*</span>
            </Label>
            <InlineCreateSelect
              options={brands}
              value={selectedBrandId}
              onChange={newVal => {
                setSelectedBrandId(newVal)
                setSelectedModelId('')
              }}
              placeholder='Buscar o crear marca...'
              createLabel='Crear marca'
              createTitle='Nueva marca'
              editTitle='Editar marca'
              deleteConfirmMessage='¿Eliminar esta marca? Solo es posible si no tiene activos asociados.'
              createForm={({ item, onSuccess, onCancel }) => (
                <EquipmentBrandInlineForm
                  familyId={familyId}
                  item={item}
                  onSuccess={newItem => {
                    if (item) {
                      setBrands(prev => prev.map(b => (b.id === newItem.id ? newItem : b)))
                    } else {
                      setBrands(prev => [...prev, newItem])
                    }
                    setSelectedBrandId(newItem.id)
                    onSuccess(newItem)
                  }}
                  onCancel={onCancel}
                />
              )}
              onDelete={async id => {
                const res = await fetch(`/api/inventory/brands/${id}`, { method: 'DELETE' })
                if (!res.ok) {
                  const d = await res.json()
                  throw new Error(d.error || 'Error al eliminar')
                }
                setBrands(prev => prev.filter(b => b.id !== id))
                if (selectedBrandId === id) {
                  setSelectedBrandId('')
                  setSelectedModelId('')
                }
              }}
            />
          </div>
        )}

        {/* Modelo de Equipo */}
        {equipmentTypeId && selectedBrandId && (
          <div className='space-y-1'>
            <Label>
              Modelo <span className='text-destructive'>*</span>
            </Label>
            <InlineCreateSelect
              options={equipmentModels}
              value={selectedModelId}
              onChange={setSelectedModelId}
              placeholder='Buscar o crear modelo...'
              allowClear
              createLabel='Crear modelo'
              createTitle='Nuevo modelo de equipo'
              editTitle='Editar modelo de equipo'
              deleteConfirmMessage='¿Eliminar este modelo? Solo es posible si no tiene activos asociados.'
              createForm={({ item, onSuccess, onCancel }) => (
                <EquipmentModelInlineForm
                  typeId={equipmentTypeId}
                  familyId={familyId}
                  item={item}
                  initialBrandId={selectedBrandId || undefined}
                  onSuccess={newItem => {
                    if (item) {
                      setEquipmentModels(prev => prev.map(t => (t.id === newItem.id ? newItem : t)))
                    } else {
                      setEquipmentModels(prev => [...prev, newItem])
                    }
                    onSuccess(newItem)
                  }}
                  onCancel={onCancel}
                />
              )}
              onDelete={async id => {
                try {
                  const res = await fetch(`/api/inventory/models/${id}`, { method: 'DELETE' })
                  if (!res.ok) {
                    const d = await res.json()
                    throw new Error(d.error || 'Error al eliminar')
                  }
                  setEquipmentModels(prev => prev.filter(t => t.id !== id))
                  if (selectedModelId === id) {
                    setSelectedModelId('')
                  }
                  toast({
                    title: 'Modelo eliminado',
                    description: 'El modelo fue eliminado exitosamente',
                  })
                } catch (err: unknown) {
                  const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
                  toast({
                    title: 'Error',
                    description: errorMessage,
                    variant: 'destructive',
                  })
                  throw err
                }
              }}
            />
          </div>
        )}

        {/* N° Serie */}
        <div className='space-y-1'>
          <Label>
            N° de Serie del Fabricante <span className='text-destructive'>*</span>
          </Label>
          <SerialNumberInput
            value={serialNumber}
            onChange={e => setSerialNumber(e.target.value)}
            placeholder='Ej: SN-ABC-12345'
          />
        </div>

        {/* Código */}
        <div className='space-y-1'>
          <Label>
            Código Interno{' '}
            <span className='text-xs font-normal text-muted-foreground'>
              (opcional — se genera automáticamente)
            </span>
          </Label>
          <Input
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder='Dejar vacío para generar automáticamente'
          />
        </div>
      </div>

      {/* ── 2. DETALLES DEL EQUIPO ────────────────────────────────── */}
      {/* Atributos por Tipo */}
      <TypeAttributesSection
        typeId={equipmentTypeId}
        values={customFieldValues}
        onChange={setCustomFieldValues}
      />

      {/* Accesorios */}
      <AccessoriesSection accessories={accessories} onChange={setAccessories} inline />

      {/* ── 3. ESTADO Y UBICACIÓN ──────────────────────────────────── */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
        <div className='space-y-1'>
          <Label>
            Condición <span className='text-destructive'>*</span>
          </Label>
          <SimpleSelect value={condition} onChange={e => setCondition(e.target.value)}>
            <option value='NEW'>Nuevo</option>
            <option value='GOOD'>Bueno</option>
            <option value='POOR'>Malo</option>
          </SimpleSelect>
          {conditionMessage[condition] && (
            <p
              className={`text-xs ${condition === 'NEW' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}
            >
              {conditionMessage[condition]}
            </p>
          )}
        </div>
        <div className='space-y-1'>
          <Label>Estado</Label>
          <SimpleSelect value={equipmentStatus} onChange={e => setEquipmentStatus(e.target.value)}>
            {(allowedStatusesByCondition[condition] || []).map(status => (
              <option key={status} value={status}>
                {status === 'AVAILABLE'
                  ? 'Disponible'
                  : status === 'ASSIGNED'
                    ? 'Asignado'
                    : status === 'MAINTENANCE'
                      ? 'En Mantenimiento'
                      : status === 'DAMAGED'
                        ? 'Dañado'
                        : status === 'RETIRED'
                          ? 'Retirado'
                          : status === 'FOR_SALE'
                            ? 'En venta'
                            : status}
              </option>
            ))}
          </SimpleSelect>
        </div>

        {/* Bodega — solo AVAILABLE y DAMAGED */}
        {showWarehouse && (
          <div className='space-y-1'>
            <Label>Bodega</Label>
            <InlineCreateSelect
              options={warehouses}
              value={warehouseId}
              onChange={setWarehouseId}
              placeholder='Buscar bodega...'
              allowClear
              createLabel='Crear bodega'
              createTitle='Nueva bodega'
              editTitle='Editar bodega'
              deleteConfirmMessage='¿Eliminar esta bodega? Solo es posible si no tiene activos asociados.'
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
              onDelete={async id => {
                const res = await fetch(`/api/inventory/warehouses/${id}`, { method: 'DELETE' })
                if (!res.ok) {
                  const d = await res.json()
                  throw new Error(d.error || 'Error al eliminar')
                }
                setWarehouses(prev => prev.filter(w => w.id !== id))
                if (warehouseId === id) {
                  setWarehouseId('')
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Departamento — solo información automática cuando estado = ASSIGNED y hay usuario asignado */}
      {equipmentStatus === 'ASSIGNED' && assignedUserDept && (
        <div className='rounded-md border border-primary/30 bg-primary/5 p-3'>
          <Label className='text-xs text-muted-foreground'>Departamento</Label>
          <p className='font-medium'>{assignedUserDept}</p>
        </div>
      )}

      {/* Precio Estimado — solo para Bueno/Malo y FIXED_ASSET */}
      {showEstimatedPrice && (
        <div className='space-y-1'>
          <Label>Precio Estimado (USD) — opcional</Label>
          <Input
            type='number'
            step='0.01'
            min='0'
            value={estimatedPrice}
            onChange={e => setEstimatedPrice(e.target.value)}
            placeholder='Ej: 500.00 — valor estimado del activo'
          />
          {/* <p className='text-xs text-muted-foreground'>
            Valor estimado del activo en su condición actual.
          </p> */}
        </div>
      )}

      {/* Aviso para activos registrados directamente como RETIRED (históricos) */}
      {equipmentStatus === 'RETIRED' && (
        <div className='rounded-md border border-muted-foreground/20 bg-muted/40 px-4 py-3 space-y-1'>
          <p className='text-sm font-medium text-muted-foreground'>
            Registro de activo histórico retirado
          </p>
          <p className='text-xs text-muted-foreground'>
            Estás registrando un activo que ya fue dado de baja. Este modo es exclusivo para
            migración de datos históricos. Para dar de baja un activo activo, usa el botón
            &ldquo;Solicitar baja&rdquo; desde el detalle del equipo — eso inicia el flujo formal
            con aprobación, acta y folio.
          </p>
        </div>
      )}

      {/* Precio de venta — solo cuando estado es FOR_SALE */}
      {showForSalePriceField(equipmentStatus) && (
        <div className='space-y-2 col-span-2'>
          <div className='rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3'>
            <p className='text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2'>
              <Tag className='h-4 w-4' />
              Activo marcado para la venta
            </p>
            <div className='space-y-1'>
              <Label>Precio de venta público (USD) — opcional</Label>
              <Input
                type='number'
                step='0.01'
                min='0'
                value={saleListingPrice}
                onChange={e => setSaleListingPrice(e.target.value)}
                placeholder="Ej: 850.00 — dejar vacío para mostrar 'Consultar precio'"
              />
              <p className='text-xs text-muted-foreground'>
                Este precio se mostrará en la vitrina pública. Si no lo defines, se mostrará
                &ldquo;Consultar precio&rdquo;.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Asignar a usuario — usa el componente compartido con departamento auto-rellenado */}
      {showAssignmentBlock(equipmentStatus) && (
        <div className='rounded-lg border border-primary/30 bg-primary/5 p-4'>
          <AssignableUserSelect
            familyId={familyId}
            value={assignedUserId}
            onChange={(userId, user) => {
              setAssignedUserId(userId)
              setAssignedUserDept(user?.department ?? null)
            }}
            required
          />
        </div>
      )}

      {/* Mantenimiento — usa componente compartido */}
      {showMaintenanceBlock(equipmentStatus) && (
        <MaintenanceStatusBlock
          date={maintenanceDate}
          onDateChange={setMaintenanceDate}
          type={maintenanceType}
          onTypeChange={setMaintenanceType}
          technicianId={maintenanceTechnicianId}
          onTechnicianChange={setMaintenanceTechnicianId}
          description={maintenanceDescription}
          onDescriptionChange={setMaintenanceDescription}
        />
      )}

      {/* ── 4. ADQUISICIÓN ────────────────────────────────────────── */}
      {/* Modalidad */}
      <div className='space-y-1'>
        <Label>¿Cómo se adquirió este equipo?</Label>
        <SimpleSelect
          value={acquisitionMode}
          onChange={e => setAcquisitionMode(e.target.value as typeof acquisitionMode)}
          options={ACQUISITION_MODES}
        />
        <p className='text-xs text-muted-foreground'>
          {ACQUISITION_MODES.find(m => m.value === acquisitionMode)?.help}
        </p>
      </div>

      {/* Proveedor */}
      <div className='space-y-1'>
        <Label>
          {supplierLabel} {supplierRequired && <span className='text-destructive'>*</span>}
        </Label>
        <SupplierSelect
          value={supplierId || null}
          onChange={v => setSupplierId(v || '')}
          familyId={familyId}
        />
      </div>

      {/* Contrato — SOLO RENTAL (NO para LOAN) */}
      {acquisitionMode === 'RENTAL' && (
        <div className='rounded-md border border-border p-4 space-y-3'>
          <p className='text-sm font-medium'>Contrato de arrendamiento</p>
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
        <fieldset className='rounded-lg border border-border p-4 space-y-3'>
          <legend className='px-2 text-sm font-semibold text-foreground'>
            Información Financiera{' '}
            {requireFinancialForNew && condition === 'NEW' && (
              <span className='text-destructive'>*</span>
            )}
          </legend>
          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1'>
              <Label>
                Precio de Compra{' '}
                {requireFinancialForNew && condition === 'NEW' && (
                  <span className='text-destructive'>*</span>
                )}
              </Label>
              <Input
                type='number'
                min='0'
                step='0.01'
                value={purchasePrice}
                onChange={e => setPurchasePrice(e.target.value)}
                placeholder='0.00'
              />
              {priceError && <p className='text-xs text-destructive'>{priceError}</p>}
            </div>
            <div className='space-y-1'>
              <Label>Fecha de Compra</Label>
              <Input
                type='date'
                value={purchaseDate}
                onChange={e => setPurchaseDate(e.target.value)}
              />
            </div>
            <div className='space-y-1 col-span-2'>
              <Label>N° de Factura</Label>
              <Input
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
                placeholder='Ej: FAC-2024-0123'
              />
            </div>
          </div>
        </fieldset>
      )}

      {isVisible('DEPRECIATION') &&
        supportsDepreciation &&
        acquisitionMode === 'FIXED_ASSET' &&
        condition === 'NEW' && (
          <fieldset className='rounded-lg border border-border p-4 space-y-3'>
            <legend className='px-2 text-sm font-semibold text-foreground'>Depreciación</legend>
            <div className='grid grid-cols-2 gap-3'>
              {/* Método */}
              <div className='space-y-1 col-span-2'>
                <Label>Método de Depreciación</Label>
                <SimpleSelect
                  value={depreciationMethod}
                  onChange={e => setDepreciationMethod(e.target.value)}
                  options={DEPRECIATION_METHODS}
                />
                {/* Descripción corta */}
                {DEPRECIATION_METHOD_HELP[depreciationMethod] && (
                  <p className='text-xs text-muted-foreground'>
                    {DEPRECIATION_METHOD_HELP[depreciationMethod]}
                  </p>
                )}
                {/* Ejemplo concreto */}
                {DEPRECIATION_METHOD_EXAMPLE[depreciationMethod] && (
                  <p className='text-xs text-muted-foreground italic'>
                    {DEPRECIATION_METHOD_EXAMPLE[depreciationMethod]}
                  </p>
                )}
              </div>

              {/* Vida útil */}
              <div className='space-y-1'>
                <Label>
                  {depreciationMethod === 'UNITS_OF_PRODUCTION'
                    ? 'Vida útil estimada (años)'
                    : 'Vida Útil (años)'}
                </Label>
                <Input
                  type='number'
                  min='1'
                  value={usefulLifeYears}
                  onChange={e => setUsefulLifeYears(e.target.value)}
                />
                <p className='text-xs text-muted-foreground'>
                  Ej: laptops 3-5 años, servidores 5-7 años, mobiliario 10 años.
                </p>
              </div>

              {/* Valor residual */}
              <div className='space-y-1'>
                <Label>Valor Residual</Label>
                <Input
                  type='number'
                  min='0'
                  step='0.01'
                  value={residualValue}
                  onChange={e => setResidualValue(e.target.value)}
                  placeholder='0.00'
                />
                <p className='text-xs text-muted-foreground'>
                  Valor estimado del activo al final de su vida útil.
                </p>
                {suggestedResidualValue != null && !residualValue && (
                  <button
                    type='button'
                    className='text-xs text-primary hover:underline'
                    onClick={() => setResidualValue(String(suggestedResidualValue))}
                  >
                    Sugerido: ${suggestedResidualValue.toLocaleString('es-CL')} (
                    {familyDepConfig?.defaultResidualValuePct}% del precio)
                  </button>
                )}
              </div>

              {/* ── Campos extra para "Por Uso" ── */}
              {depreciationMethod === 'UNITS_OF_PRODUCTION' && (
                <>
                  {/* Unidad de medida */}
                  <div className='space-y-1 col-span-2'>
                    <Label>¿Qué unidad mide el uso de este equipo?</Label>
                    <div className='flex gap-2'>
                      {['horas', 'km', 'ciclos', 'horas de vuelo'].map(u => (
                        <button
                          key={u}
                          type='button'
                          onClick={() => setUnitLabel(u)}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                            unitLabel === u
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-muted border-border hover:border-primary/50'
                          }`}
                        >
                          {u}
                        </button>
                      ))}
                      <Input
                        value={
                          ['horas', 'km', 'ciclos', 'horas de vuelo'].includes(unitLabel)
                            ? ''
                            : unitLabel
                        }
                        onChange={e => setUnitLabel(e.target.value || 'horas')}
                        placeholder='Otra unidad...'
                        className='h-7 text-xs flex-1'
                      />
                    </div>
                    <p className='text-xs text-muted-foreground'>
                      Ej: un generador usa &ldquo;horas&rdquo;, un vehículo usa &ldquo;km&rdquo;,
                      una prensa usa &ldquo;ciclos&rdquo;.
                    </p>
                  </div>

                  {/* Capacidad total */}
                  <div className='space-y-1'>
                    <Label>
                      Capacidad total de vida ({unitLabel})
                      <span className='text-destructive ml-1'>*</span>
                    </Label>
                    <Input
                      type='number'
                      min='1'
                      value={totalUnits}
                      onChange={e => setTotalUnits(e.target.value)}
                      placeholder={`Ej: 10000 ${unitLabel}`}
                    />
                    <p className='text-xs text-muted-foreground'>
                      Total de {unitLabel} que el equipo puede operar en toda su vida útil.
                    </p>
                  </div>

                  {/* Unidades ya usadas */}
                  <div className='space-y-1'>
                    <Label>
                      {unitLabel.charAt(0).toUpperCase() + unitLabel.slice(1)} ya utilizados
                    </Label>
                    <Input
                      type='number'
                      min='0'
                      value={usedUnits}
                      onChange={e => setUsedUnits(e.target.value)}
                      placeholder={`Ej: 1500 ${unitLabel}`}
                    />
                    <p className='text-xs text-muted-foreground'>
                      Cuántos {unitLabel} lleva acumulados hasta hoy (0 si es nuevo).
                    </p>
                  </div>

                  {/* Indicador visual de uso */}
                  {totalUnits && usedUnits && parseFloat(totalUnits) > 0 && (
                    <div className='col-span-2 space-y-1'>
                      <div className='flex justify-between text-xs text-muted-foreground'>
                        <span>Uso acumulado</span>
                        <span>
                          {Math.min(
                            100,
                            Math.round((parseFloat(usedUnits) / parseFloat(totalUnits)) * 100)
                          )}
                          % &nbsp;({usedUnits} / {totalUnits} {unitLabel})
                        </span>
                      </div>
                      <div className='h-2 rounded-full bg-muted overflow-hidden'>
                        <div
                          className='h-full rounded-full bg-primary transition-all'
                          style={{
                            width: `${Math.min(100, (parseFloat(usedUnits) / parseFloat(totalUnits)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ── Vista previa enrollable ── */}
            {depreciationPreview && depreciationPreview.length > 0 && (
              <div className='mt-2 rounded-md border border-border bg-muted/30'>
                <button
                  type='button'
                  className='flex w-full items-center justify-between px-3 py-2 text-sm font-medium'
                  onClick={() => setDepreciationPreviewOpen(p => !p)}
                >
                  <span>Vista previa de depreciación</span>
                  {depreciationPreviewOpen ? (
                    <ChevronUp className='h-4 w-4' />
                  ) : (
                    <ChevronDown className='h-4 w-4' />
                  )}
                </button>
                {depreciationPreviewOpen && (
                  <div className='border-t border-border px-3 py-2 space-y-2'>
                    {/* Fórmula del método seleccionado */}
                    <div className='rounded-md bg-muted/60 px-3 py-2 text-xs font-mono text-muted-foreground'>
                      {depreciationMethod === 'LINEAR' && (
                        <span>Depreciación anual = (Precio − Valor residual) ÷ Vida útil</span>
                      )}
                      {depreciationMethod === 'DECLINING_BALANCE' && (
                        <span>Depreciación año N = Valor libro × (2 ÷ Vida útil)</span>
                      )}
                      {depreciationMethod === 'UNITS_OF_PRODUCTION' && (
                        <span>
                          Depreciación = (Precio − Residual) ÷ Total {unitLabel} × {unitLabel}{' '}
                          usados
                        </span>
                      )}
                    </div>
                    <p className='text-xs text-muted-foreground'>
                      Valor libro estimado (solo informativo
                      {!purchaseDate && depreciationMethod !== 'UNITS_OF_PRODUCTION'
                        ? ' — simulado desde hoy'
                        : ''}
                      ):
                    </p>
                    <div className='grid grid-cols-3 gap-2'>
                      {depreciationPreview.map(({ year, bookValue }) => (
                        <div
                          key={year}
                          className='rounded-md bg-background border border-border p-2 text-center'
                        >
                          <p className='text-xs text-muted-foreground'>Año {year}</p>
                          <p className='text-sm font-semibold'>
                            $
                            {bookValue.toLocaleString('es-CL', {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0,
                            })}
                          </p>
                        </div>
                      ))}
                    </div>
                    {depreciationMethod === 'UNITS_OF_PRODUCTION' && (
                      <p className='text-xs text-muted-foreground italic'>
                        * Simulado con uso uniforme anual. El valor real depende de los {unitLabel}{' '}
                        registrados cada año.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </fieldset>
        )}

      {/* Nota: RENTAL y LOAN no deprecian — el activo no es propiedad de la empresa */}
      {isVisible('DEPRECIATION') && supportsDepreciation && acquisitionMode !== 'FIXED_ASSET' && (
        <div className='rounded-md border border-border bg-muted/40 px-4 py-3 space-y-1'>
          <p className='text-sm font-medium text-foreground'>Sin depreciación</p>
          <p className='text-xs text-muted-foreground'>
            {acquisitionMode === 'RENTAL'
              ? 'Los equipos arrendados no se deprecian — el proveedor es el propietario y quien registra la depreciación. La empresa registra el costo mensual del arrendamiento como gasto operativo.'
              : 'Los activos de tercero no se deprecian — el propietario original conserva la titularidad y es quien aplica la depreciación contable.'}
          </p>
        </div>
      )}

      {/* ── 7. NOTAS Y ADJUNTOS ───────────────────────────────────── */}
      <div className='space-y-1'>
        <Label>
          Ubicación física actual{' '}
          <span className='text-xs font-normal text-muted-foreground'>(opcional)</span>
        </Label>
        <Input
          value={physicalLocation}
          onChange={e => setPhysicalLocation(e.target.value)}
          placeholder='Ej: Oficina 201, Piso 3, Sala de Servidores...'
        />
        <p className='text-xs text-muted-foreground'>
          Dónde se encuentra el equipo actualmente (distinto a la bodega de almacenamiento).
        </p>
      </div>

      <div className='space-y-1'>
        <Label>Observaciones</Label>
        <Textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder='Notas adicionales sobre el activo...'
        />
      </div>

      <AttachmentsField
        files={attachments}
        onChange={setAttachments}
        maxFileSizeMB={maxFileSizeMB}
      />

      {submitError && <p className='text-sm text-destructive'>{submitError}</p>}

      <div className='flex gap-3 pt-2'>
        <Button type='button' variant='outline' onClick={onBack} disabled={submitting}>
          ← Atrás
        </Button>
        <Button type='submit' disabled={submitting} className='flex-1'>
          {submitting ? 'Guardando...' : 'Crear Activo'}
        </Button>
      </div>
    </form>
  )
}

// Wrapper para campos personalizados que solo muestra si hay campos configurados
function TypeAttributesSection({
  typeId,
  values,
  onChange,
}: {
  typeId: string
  values: Array<{ fieldName: string; fieldValue: string }>
  onChange: (values: Array<{ fieldName: string; fieldValue: string }>) => void
}) {
  // No renderizar nada si no hay tipo seleccionado
  if (!typeId) {
    return null
  }

  return (
    <div className='space-y-2'>
      <Label>Atributos del Tipo</Label>
      <TypeAttributesInput
        typeId={typeId}
        assetType='equipment'
        values={values}
        onChange={onChange}
      />
    </div>
  )
}
