'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { SerialNumberInput } from '@/components/ui/serial-number-input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select'
import { InlineCreateSelect } from '@/components/ui/inline-create-select'
import { SimpleSelect } from '@/components/ui/simple-select'
import { ContractPicker } from '@/components/contracts/contract-picker'
import {
  formatContractAmount,
  resolveRentalFinancialFromContract,
} from '@/lib/contracts/rental-financial-from-contract'
import type { Contract } from '@/types/contracts'
import { useFetch } from '@/hooks/common/use-fetch'
import { SupplierSelect } from '@/components/inventory/suppliers/SupplierSelect'
import { EquipmentTypeInlineForm } from '@/components/inventory/asset-forms/EquipmentTypeInlineForm'
import { EquipmentModelInlineForm } from '@/components/inventory/asset-forms/EquipmentModelInlineForm'
import { EquipmentBrandInlineForm } from '@/components/inventory/asset-forms/EquipmentBrandInlineForm'
import { WarehouseInlineForm } from '@/components/inventory/asset-forms/WarehouseInlineForm'
import { AssignableUserSelect } from '@/components/inventory/shared/AssignableUserSelect'
import { FinancialInfoSection } from '@/components/inventory/shared/FinancialInfoSection'
import { MaintenanceStatusBlock } from '@/components/inventory/shared/MaintenanceStatusBlock'
import { TypeAttributesInput } from '@/components/inventory/custom-fields/type-attributes-input'
import { AttributeManagerDialog } from '@/components/settings/inventory/attribute-manager-dialog'
import type { InlineSelectOption } from '@/components/ui/inline-create-select'
import { AttachmentsField } from '@/components/inventory/shared/AttachmentsField'
import { AccessoriesSection } from '@/components/inventory/shared/AccessoriesSection'
import { toast } from 'sonner'
import { inlineSelectFeedback } from '@/lib/utils/inline-select-feedback'
import { isDirectFormSubmit } from '@/lib/utils/inline-form-guard'
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
  getRecommendedDepreciationMethod,
  DEFAULT_USEFUL_LIFE_YEARS,
  normalizeDepreciationMethod,
  type DepreciationMethod,
} from '@/lib/inventory/depreciation'
import { useActiveDepartments } from '@/contexts/departments-context'
import { FormDraftKeys, useFormDraft } from '@/hooks/common/use-form-draft'
import { FormDraftBanner } from '@/components/common/form-draft-banner'
import { toLocalDateInputValue } from '@/lib/forms/form-date'
import { X, Plus, ChevronDown, ChevronUp, AlertCircle, Tag, KeyRound } from 'lucide-react'

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
  initialEquipment?: any
  equipmentId?: string
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
  initialEquipment,
  equipmentId,
}: EquipmentAssetFormProps) {
  const { data: session } = useSession()
  const hasCredentials =
    (session?.user as { isSuperAdmin?: boolean })?.isSuperAdmin === true ||
    (session?.user as { credentialsEnabled?: boolean })?.credentialsEnabled === true

  const getInitialBrandId = () => {
    if (!initialEquipment) return ''
    if (initialEquipment.brandId) return initialEquipment.brandId
    if (initialEquipment.model?.brandId) return initialEquipment.model.brandId
    if (initialEquipment.brand?.id) return initialEquipment.brand.id
    return ''
  }
  const getInitialModelId = () => {
    if (!initialEquipment) return ''
    if (initialEquipment.modelId) return initialEquipment.modelId
    if (initialEquipment.model?.id) return initialEquipment.model.id
    return ''
  }
  const getInitialTypeId = () => {
    if (!initialEquipment) return ''
    if (initialEquipment.typeId) return initialEquipment.typeId
    if (initialEquipment.type?.id) return initialEquipment.type.id
    return ''
  }
  const getInitialWarehouseId = () => {
    if (!initialEquipment) return ''
    if (initialEquipment.warehouseId) return initialEquipment.warehouseId
    if (initialEquipment.warehouse?.id) return initialEquipment.warehouse.id
    return ''
  }
  const getInitialSupplierId = () => {
    if (!initialEquipment) return ''
    if (initialEquipment.supplierId) return initialEquipment.supplierId
    if (initialEquipment.supplier?.id) return initialEquipment.supplier.id
    return ''
  }
  const getInitialAcquisitionMode = () => {
    if (!initialEquipment) return 'FIXED_ASSET'
    if (initialEquipment.acquisitionMode) return initialEquipment.acquisitionMode
    if (initialEquipment.ownershipType === 'RENTAL') return 'RENTAL'
    if (initialEquipment.ownershipType === 'LOAN') return 'LOAN'
    return 'FIXED_ASSET'
  }

  const [acquisitionMode, setAcquisitionMode] = useState<'FIXED_ASSET' | 'RENTAL' | 'LOAN'>(
    getInitialAcquisitionMode()
  )
  const [code, setCode] = useState(initialEquipment?.code || '')
  const [serialNumber, setSerialNumber] = useState(initialEquipment?.serialNumber || '')
  const [selectedBrandId, setSelectedBrandId] = useState(getInitialBrandId())
  const [brands, setBrands] = useState<Array<{ id: string; name: string; code?: string }>>([])
  const [selectedModelId, setSelectedModelId] = useState(getInitialModelId())
  const [equipmentModels, setEquipmentModels] = useState<
    Array<{ id: string; name: string; brandId?: string; model: string }>
  >([])
  const [equipmentTypeId, setEquipmentTypeId] = useState(getInitialTypeId())
  const [equipmentTypes, setEquipmentTypes] = useState<
    Array<{
      id: string
      name: string
      trackMaintenance?: boolean
    }>
  >([])
  // Gestor de atributos del tipo, encadenado desde el mismo selector (crear/editar tipo)
  const [manageAttributesFor, setManageAttributesFor] = useState<InlineSelectOption | null>(null)
  const [manageAttributesAutoCreate, setManageAttributesAutoCreate] = useState(false)
  const [attributesReloadToken, setAttributesReloadToken] = useState(0)
  // Configuración del tipo seleccionado
  const [selectedTypeConfig, setSelectedTypeConfig] = useState<{
    trackMaintenance: boolean
  }>({
    trackMaintenance: false,
  })
  const [condition, setCondition] = useState(initialEquipment?.condition || 'NEW')
  const [equipmentStatus, setEquipmentStatus] = useState(initialEquipment?.status || 'AVAILABLE')
  const [accessories, setAccessories] = useState<string[]>(initialEquipment?.accessories || [])
  // Campos personalizados
  const [customFieldValues, setCustomFieldValues] = useState<
    Array<{ fieldName: string; fieldValue: string }>
  >(initialEquipment?.customValues || [])
  const [supplierId, setSupplierId] = useState(getInitialSupplierId())
  const [linkedContractId, setLinkedContractId] = useState<string | null>(
    initialEquipment?.businessContractId || initialEquipment?.contractId || null
  )
  const [rentalDeliveryDate, setRentalDeliveryDate] = useState(
    initialEquipment?.rentalDeliveryDate
      ? new Date(initialEquipment.rentalDeliveryDate).toISOString().split('T')[0]
      : ''
  )
  const [rentalBuyoutValue, setRentalBuyoutValue] = useState(
    initialEquipment?.rentalBuyoutValue != null ? String(initialEquipment.rentalBuyoutValue) : ''
  )
  const [rentalClientResponse, setRentalClientResponse] = useState<string>(
    initialEquipment?.rentalClientResponse || 'NOT_NOTIFIED'
  )
  const [purchaseDate, setPurchaseDate] = useState(
    toLocalDateInputValue(initialEquipment?.purchaseDate)
  )
  const [purchasePrice, setPurchasePrice] = useState(
    initialEquipment?.purchasePrice != null ? String(initialEquipment.purchasePrice) : ''
  )
  const [invoiceNumber, setInvoiceNumber] = useState(initialEquipment?.invoiceNumber || '')
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState(
    initialEquipment?.purchaseOrderNumber || ''
  )
  const [estimatedPrice, setEstimatedPrice] = useState(
    initialEquipment?.estimatedPrice != null ? String(initialEquipment.estimatedPrice) : ''
  )
  const [depreciationMethod, setDepreciationMethod] = useState(
    initialEquipment?.depreciationMethod || 'LINEAR'
  )
  const [usefulLifeYears, setUsefulLifeYears] = useState(
    initialEquipment?.usefulLifeYears != null ? String(initialEquipment.usefulLifeYears) : ''
  )
  const [residualValue, setResidualValue] = useState(
    initialEquipment?.residualValue != null ? String(initialEquipment.residualValue) : ''
  )
  // Campos para método "Por Uso"
  const [totalUnits, setTotalUnits] = useState(
    initialEquipment?.totalUnits != null ? String(initialEquipment.totalUnits) : ''
  ) // capacidad total (horas/km/ciclos)
  const [usedUnits, setUsedUnits] = useState(
    initialEquipment?.usedUnits != null ? String(initialEquipment.usedUnits) : ''
  ) // unidades ya consumidas
  const [unitLabel, setUnitLabel] = useState('horas') // etiqueta personalizable
  const [warehouseId, setWarehouseId] = useState(getInitialWarehouseId())
  const [warehouses, setWarehouses] = useState<
    { id: string; name: string; description?: string }[]
  >([])
  const [assignedUserId, setAssignedUserId] = useState(initialEquipment?.assignedUserId || '')
  // Departamento derivado del usuario asignado (solo lectura cuando estado=ASSIGNED)
  const [assignedUserDept, setAssignedUserDept] = useState<{ id: string; name: string } | null>(
    null
  )
  // Fecha de devolución tentativa (solo para asignaciones en formulario de creación)
  const [assignmentEndDate, setAssignmentEndDate] = useState('')
  const [notes, setNotes] = useState(initialEquipment?.notes || '')
  const [physicalLocation, setPhysicalLocation] = useState(initialEquipment?.physicalLocation || '')
  const [attachments, setAttachments] = useState<File[]>([])
  const [existingAttachments, setExistingAttachments] = useState<any[]>(
    initialEquipment?.attachments || initialEquipment?.equipment_attachments || []
  )
  const [priceError, setPriceError] = useState('')
  const [saleListingPrice, setSaleListingPrice] = useState(
    initialEquipment?.saleListingPrice != null ? String(initialEquipment.saleListingPrice) : ''
  )

  const { data: linkedContracts } = useFetch<Contract>(
    linkedContractId ? `/api/inventory/contracts/${linkedContractId}` : '/api/inventory/contracts',
    {
      enabled: !!linkedContractId && acquisitionMode === 'RENTAL',
      transform: d => (d.id ? [d] : []),
      showErrorToast: false,
    }
  )
  const linkedContract = linkedContracts[0] ?? null

  const contractFinancial = useMemo(
    () => (linkedContract ? resolveRentalFinancialFromContract(linkedContract) : null),
    [linkedContract]
  )

  const contractPrefill = useMemo(
    () => ({
      familyId,
      supplierId: supplierId || null,
      startDate: initialEquipment?.rentalStartDate
        ? new Date(initialEquipment.rentalStartDate).toISOString().slice(0, 10)
        : purchaseDate || undefined,
      endDate: initialEquipment?.rentalEndDate
        ? new Date(initialEquipment.rentalEndDate).toISOString().slice(0, 10)
        : undefined,
      monthlyCost:
        initialEquipment?.rentalMonthlyCost != null
          ? String(initialEquipment.rentalMonthlyCost)
          : purchasePrice || undefined,
      hasRecurring: true,
      suggestedLineDescription: serialNumber.trim()
        ? `Equipo ${serialNumber.trim()}`
        : code.trim()
          ? `Equipo ${code.trim()}`
          : 'Equipo en arrendamiento',
      category: 'EQUIPMENT_RENTAL' as const,
    }),
    [
      familyId,
      supplierId,
      initialEquipment?.rentalStartDate,
      initialEquipment?.rentalEndDate,
      initialEquipment?.rentalMonthlyCost,
      purchaseDate,
      purchasePrice,
      serialNumber,
      code,
    ]
  )

  const handleContractChange = (contractId: string | null) => {
    setLinkedContractId(contractId)
  }

  // Mantenimiento
  const [maintenanceDate, setMaintenanceDate] = useState(
    () => new Date().toISOString().split('T')[0]
  )
  const [maintenanceType, setMaintenanceType] = useState<'PREVENTIVE' | 'CORRECTIVE'>('CORRECTIVE')
  const [maintenanceTechnicianId, setMaintenanceTechnicianId] = useState('')
  const [maintenanceSupplierId, setMaintenanceSupplierId] = useState('')
  const [maintenanceDescription, setMaintenanceDescription] = useState('')
  const [techniciansList, setTechniciansList] = useState<
    { id: string; name: string; email: string }[]
  >([])
  const [loadingTechnicians, setLoadingTechnicians] = useState(false)

  // ✅ Departamentos desde contexto global — solo para referencia (no editable)
  const { departments: allDepartments } = useActiveDepartments()
  const departments = allDepartments.filter(
    (dept): dept is typeof dept & { familyId: string } =>
      !!familyId && (dept.familyId === familyId || dept.family?.id === familyId)
  )

  // departmentId efectivo: solo el del usuario asignado cuando estado = ASSIGNED
  const effectiveDepartmentId = equipmentStatus === 'ASSIGNED' ? (assignedUserDept?.id ?? '') : ''

  // Task 19.1: family depreciation config from API
  const [familyDepConfig, setFamilyDepConfig] = useState<FamilyDepreciationConfig | null>(null)
  const [depreciationPreviewOpen, setDepreciationPreviewOpen] = useState(false)

  // Resolver secciones según modalidad activa (sectionsByMode tiene prioridad sobre global)
  const resolvedSections = resolveSectionsForMode(familyConfig, acquisitionMode)
  const isVisible = (s: string) => resolvedSections.visible.includes(s as never)
  const isRequired = (s: string) => resolvedSections.required.includes(s as never)

  // Bodega: solo cuando el equipo está físicamente almacenado (AVAILABLE o DAMAGED)
  const showWarehouse = isVisible('WAREHOUSE') && showWarehouseSelector(equipmentStatus)

  // La visibilidad la define la configuración del área — no bloquear por código de familia legacy
  const showDepreciation = isVisible('DEPRECIATION') && acquisitionMode === 'FIXED_ASSET'

  useEffect(() => {
    Promise.all([
      fetch(`/api/inventory/equipment-types?familyId=${familyId}`).then(r => r.json()),
      fetch(`/api/inventory/warehouses?familyId=${familyId}`).then(r => r.json()),
      fetch(`/api/inventory/brands?familyId=${familyId}`).then(r => r.json()),
    ]).then(([typesRes, warehousesRes, brandsRes]) => {
      setEquipmentTypes(typesRes.types ?? [])
      setWarehouses(warehousesRes.warehouses ?? warehousesRes ?? [])
      setBrands(brandsRes.brands ?? [])

      if (isEditMode && initialEquipment) {
        if (initialEquipment.typeId) setEquipmentTypeId(initialEquipment.typeId)
        if (initialEquipment.brandId) setSelectedBrandId(initialEquipment.brandId)
        if (initialEquipment.modelId) setSelectedModelId(initialEquipment.modelId)
      }
    })
  }, [familyId, isEditMode])

  // Cargar modelos y configuración cuando se selecciona un tipo de equipo o marca
  useEffect(() => {
    if (!equipmentTypeId) {
      setEquipmentModels([])
      if (!isEditMode) setSelectedModelId('')
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

        if (isEditMode && initialEquipment?.modelId) {
          const modelExists = models.some((m: any) => m.id === initialEquipment.modelId)
          if (modelExists) setSelectedModelId(initialEquipment.modelId)
        }
      })
      .catch(() => setEquipmentModels([]))
  }, [equipmentTypeId, equipmentTypes, selectedBrandId, isEditMode, initialEquipment?.modelId])

  // Task 19.1: defaults de depreciación de la familia — vienen en el prop `familyConfig`
  // (ya lo trae UnifiedAssetForm al hacer GET /api/inventory/family-config/:id antes de
  // montar este formulario). Antes se volvía a pedir el mismo endpoint por separado, una
  // llamada de red redundante en cada carga de "Nuevo Activo").
  useEffect(() => {
    const cfg: FamilyDepreciationConfig = {
      defaultDepreciationMethod: normalizeDepreciationMethod(
        familyConfig.defaultDepreciationMethod
      ),
      defaultUsefulLifeYears: familyConfig.defaultUsefulLifeYears ?? null,
      defaultResidualValuePct: familyConfig.defaultResidualValuePct ?? null,
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
  }, [
    familyConfig.defaultDepreciationMethod,
    familyConfig.defaultUsefulLifeYears,
    familyConfig.defaultResidualValuePct,
    familyCode,
  ])

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
      // El departamento se maneja automáticamente vía assignedUserDept
      setAssignedUserDept(null)
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
    NEW: ['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'FOR_SALE'],
    USED: ['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'FOR_SALE'],
    DAMAGED: ['DAMAGED', 'FOR_SALE', 'RETIRED'],
  }

  // Mensajes informativos por condición
  const conditionMessage: Record<string, string> = {
    NEW: 'Activo nuevo — información financiera obligatoria.',
    USED: 'Se puede asignar, poner en mantenimiento o vender.',
    DAMAGED: 'Se puede vender como piezas, dar de baja o marcar como dañado.',
  }

  // Lógica de campos visibles — respeta visibleSections / sectionsByMode de la configuración
  const showFinancial =
    acquisitionMode === 'FIXED_ASSET' &&
    ((isVisible('FINANCIAL') && (condition === 'NEW' || isEditMode)) ||
      (requireFinancialForNew && condition === 'NEW'))

  const financialRequired =
    (isRequired('FINANCIAL') || (requireFinancialForNew && condition === 'NEW')) && showFinancial

  const showEstimatedPrice =
    (condition === 'USED' || condition === 'DAMAGED') && acquisitionMode === 'FIXED_ASSET'

  // Estado actualizado solo si es permitido por la condición
  useEffect(() => {
    const allowed = allowedStatusesByCondition[condition] || []
    if (!allowed.includes(equipmentStatus)) {
      setEquipmentStatus(allowed[0] || 'AVAILABLE')
    }
  }, [condition])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    // El modal inline vive en portal: el submit burbujea por el árbol React al form padre
    if (!isDirectFormSubmit(e)) return
    setPriceError('')
    if (!equipmentTypeId) {
      toast.error('Selecciona el tipo de equipo')
      return
    }

    if (!selectedBrandId) {
      toast.error('Selecciona o crea una marca')
      return
    }
    if (!selectedModelId) {
      toast.error('Selecciona o crea un modelo')
      return
    }
    if (!serialNumber.trim()) {
      toast.error('Ingresa el número de serie')
      return
    }
    if (financialRequired && !purchasePrice) {
      setPriceError('El precio de compra es obligatorio')
      toast.error('El precio de compra es obligatorio')
      return
    }
    if (isRequired('DEPRECIATION') && showDepreciation) {
      if (!depreciationMethod) {
        toast.error('Selecciona el método de depreciación')
        return
      }
      if (!usefulLifeYears || parseFloat(usefulLifeYears) <= 0) {
        toast.error('Ingresa la vida útil en años')
        return
      }
    }
    if (isRequired('WAREHOUSE') && showWarehouse && !warehouseId) {
      toast.error('Selecciona la bodega de almacenamiento')
      return
    }
    if (equipmentStatus === 'ASSIGNED' && !assignedUserId) {
      toast.error('Selecciona el usuario al que se asignará el equipo')
      return
    }
    if (
      isRequired('CONTRACT') &&
      isVisible('CONTRACT') &&
      acquisitionMode === 'RENTAL' &&
      !linkedContractId
    ) {
      toast.error('Selecciona el contrato de arrendamiento')
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
      accessories: isEditMode ? accessories : accessories.length ? accessories : undefined,
      customValues: isEditMode
        ? customFieldValues
        : customFieldValues.length
          ? customFieldValues
          : undefined,
      supplierId: supplierId || undefined,
      contractId: linkedContractId || undefined,
      ...(acquisitionMode === 'RENTAL' && {
        rentalDeliveryDate: rentalDeliveryDate || undefined,
        rentalBuyoutValue: rentalBuyoutValue ? parseFloat(rentalBuyoutValue) : undefined,
        rentalClientResponse: rentalClientResponse || 'NOT_NOTIFIED',
      }),
      purchaseDate: purchaseDate || undefined,
      purchasePrice: purchasePrice ? parseFloat(purchasePrice) : undefined,
      invoiceNumber: invoiceNumber || undefined,
      purchaseOrderNumber: purchaseOrderNumber || undefined,
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
      assignmentEndDate:
        equipmentStatus === 'ASSIGNED' && assignmentEndDate ? assignmentEndDate : undefined,
      // Mantenimiento — solo cuando el estado es MAINTENANCE
      ...(equipmentStatus === 'MAINTENANCE' && {
        maintenanceDate: maintenanceDate || undefined,
        maintenanceType: maintenanceType || undefined,
        maintenanceTechnicianId: maintenanceTechnicianId || undefined,
        maintenanceSupplierId: maintenanceSupplierId || undefined,
        maintenanceDescription: maintenanceDescription || undefined,
      }),
      physicalLocation: physicalLocation || undefined,
      notes: notes || undefined,
      // En modo creación, pasamos attachments para el backend; en edición, los subimos manualmente
      attachments: !isEditMode && attachments.length ? attachments : undefined,
      ...(saleListingPrice
        ? { saleListingPrice: parseFloat(saleListingPrice) }
        : { saleListingPrice: null }),
      // Precio estimado para Bueno/Malo
      ...(showEstimatedPrice && estimatedPrice
        ? { estimatedPrice: parseFloat(estimatedPrice) }
        : {}),
    }
    // Call original onSubmit first (to save equipment)
    onSubmit(payload)

    // Now handle uploading new attachments in edit mode
    if (isEditMode && attachments.length > 0 && equipmentId) {
      for (const file of attachments) {
        const formData = new FormData()
        formData.append('file', file)
        await fetch(`/api/inventory/equipment/${equipmentId}/attachments`, {
          method: 'POST',
          body: formData,
        })
      }
    }
  }

  const draftKey =
    isEditMode && equipmentId
      ? FormDraftKeys.equipmentEdit(equipmentId)
      : FormDraftKeys.equipmentNew(familyId)

  const equipmentDraftValues = useMemo(
    () => ({
      acquisitionMode,
      code,
      serialNumber,
      selectedBrandId,
      selectedModelId,
      equipmentTypeId,
      condition,
      equipmentStatus,
      accessories,
      customFieldValues,
      supplierId,
      linkedContractId,
      rentalDeliveryDate,
      rentalBuyoutValue,
      rentalClientResponse,
      purchaseDate,
      purchasePrice,
      invoiceNumber,
      purchaseOrderNumber,
      estimatedPrice,
      depreciationMethod,
      usefulLifeYears,
      residualValue,
      totalUnits,
      usedUnits,
      unitLabel,
      warehouseId,
      assignedUserId,
      assignmentEndDate,
      notes,
      physicalLocation,
      saleListingPrice,
      maintenanceDate,
      maintenanceType,
      maintenanceTechnicianId,
      maintenanceSupplierId,
      maintenanceDescription,
    }),
    [
      acquisitionMode,
      code,
      serialNumber,
      selectedBrandId,
      selectedModelId,
      equipmentTypeId,
      condition,
      equipmentStatus,
      accessories,
      customFieldValues,
      supplierId,
      linkedContractId,
      rentalDeliveryDate,
      rentalBuyoutValue,
      rentalClientResponse,
      purchaseDate,
      purchasePrice,
      invoiceNumber,
      purchaseOrderNumber,
      estimatedPrice,
      depreciationMethod,
      usefulLifeYears,
      residualValue,
      totalUnits,
      usedUnits,
      unitLabel,
      warehouseId,
      assignedUserId,
      assignmentEndDate,
      notes,
      physicalLocation,
      saleListingPrice,
      maintenanceDate,
      maintenanceType,
      maintenanceTechnicianId,
      maintenanceSupplierId,
      maintenanceDescription,
    ]
  )

  const { clearDraft, wasRestored, dismissRestoredBanner } = useFormDraft({
    key: draftKey,
    values: equipmentDraftValues,
    enabled: !submitting,
    onRestore: d => {
      if (d.acquisitionMode) setAcquisitionMode(d.acquisitionMode as typeof acquisitionMode)
      if (d.code != null) setCode(String(d.code))
      if (d.serialNumber != null) setSerialNumber(String(d.serialNumber))
      if (d.selectedBrandId != null) setSelectedBrandId(String(d.selectedBrandId))
      if (d.selectedModelId != null) setSelectedModelId(String(d.selectedModelId))
      if (d.equipmentTypeId != null) setEquipmentTypeId(String(d.equipmentTypeId))
      if (d.condition != null) setCondition(String(d.condition))
      if (d.equipmentStatus != null) setEquipmentStatus(String(d.equipmentStatus))
      if (Array.isArray(d.accessories)) setAccessories(d.accessories as string[])
      if (Array.isArray(d.customFieldValues))
        setCustomFieldValues(d.customFieldValues as typeof customFieldValues)
      if (d.supplierId != null) setSupplierId(String(d.supplierId))
      if (d.linkedContractId !== undefined) setLinkedContractId(d.linkedContractId as string | null)
      if (d.rentalDeliveryDate != null) setRentalDeliveryDate(String(d.rentalDeliveryDate))
      if (d.rentalBuyoutValue != null) setRentalBuyoutValue(String(d.rentalBuyoutValue))
      if (d.rentalClientResponse != null) setRentalClientResponse(String(d.rentalClientResponse))
      if (d.purchaseDate != null) setPurchaseDate(String(d.purchaseDate))
      if (d.purchasePrice != null) setPurchasePrice(String(d.purchasePrice))
      if (d.invoiceNumber != null) setInvoiceNumber(String(d.invoiceNumber))
      if (d.purchaseOrderNumber != null) setPurchaseOrderNumber(String(d.purchaseOrderNumber))
      if (d.estimatedPrice != null) setEstimatedPrice(String(d.estimatedPrice))
      if (d.depreciationMethod != null)
        setDepreciationMethod(d.depreciationMethod as typeof depreciationMethod)
      if (d.usefulLifeYears != null) setUsefulLifeYears(String(d.usefulLifeYears))
      if (d.residualValue != null) setResidualValue(String(d.residualValue))
      if (d.totalUnits != null) setTotalUnits(String(d.totalUnits))
      if (d.usedUnits != null) setUsedUnits(String(d.usedUnits))
      if (d.unitLabel != null) setUnitLabel(String(d.unitLabel))
      if (d.warehouseId != null) setWarehouseId(String(d.warehouseId))
      if (d.assignedUserId != null) setAssignedUserId(String(d.assignedUserId))
      if (d.assignmentEndDate != null) setAssignmentEndDate(String(d.assignmentEndDate))
      if (d.notes != null) setNotes(String(d.notes))
      if (d.physicalLocation != null) setPhysicalLocation(String(d.physicalLocation))
      if (d.saleListingPrice != null) setSaleListingPrice(String(d.saleListingPrice))
      if (d.maintenanceDate != null) setMaintenanceDate(String(d.maintenanceDate))
      if (d.maintenanceType != null) setMaintenanceType(d.maintenanceType as typeof maintenanceType)
      if (d.maintenanceTechnicianId != null)
        setMaintenanceTechnicianId(String(d.maintenanceTechnicianId))
      if (d.maintenanceSupplierId != null) setMaintenanceSupplierId(String(d.maintenanceSupplierId))
      if (d.maintenanceDescription != null)
        setMaintenanceDescription(String(d.maintenanceDescription))
    },
  })

  const prevSubmittingEq = useRef(false)
  useEffect(() => {
    if (prevSubmittingEq.current && !submitting && !submitError) {
      clearDraft()
    }
    prevSubmittingEq.current = submitting
  }, [submitting, submitError, clearDraft])

  return (
    <>
      <form onSubmit={handleSubmit} className='space-y-5'>
        <FormDraftBanner
          visible={wasRestored}
          onDismiss={dismissRestoredBanner}
          onDiscard={() => {
            clearDraft()
            dismissRestoredBanner()
          }}
        />
        {hasCredentials && (
          <div className='rounded-lg border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground flex items-start gap-2'>
            <KeyRound className='h-3.5 w-3.5 shrink-0 mt-0.5' />
            <span>
              Contraseñas de equipo (BIOS, admin, Wi‑Fi, etc.) no van en este formulario: tras crear
              el activo, úsalas en la tarjeta{' '}
              <strong className='text-foreground'>Credenciales</strong> del detalle (bóveda con
              auditoría).
            </span>
          </div>
        )}
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
              {...inlineSelectFeedback('Tipo de equipo')}
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
              onCreated={item => {
                // Al crear un tipo de equipo nuevo, ir directo a definir sus atributos
                setManageAttributesFor(item)
                setManageAttributesAutoCreate(true)
              }}
              onManageAttributes={item => {
                setManageAttributesFor(item)
                setManageAttributesAutoCreate(false)
              }}
              manageAttributesTooltip='Gestionar atributos'
              onDelete={async id => {
                const res = await fetch(`/api/inventory/equipment-types/${id}`, {
                  method: 'DELETE',
                })
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
                {...inlineSelectFeedback('Marca')}
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
                {...inlineSelectFeedback('Modelo')}
                createForm={({ item, onSuccess, onCancel }) => (
                  <EquipmentModelInlineForm
                    typeId={equipmentTypeId}
                    familyId={familyId}
                    item={item}
                    initialBrandId={selectedBrandId || undefined}
                    onSuccess={newItem => {
                      if (item) {
                        setEquipmentModels(prev =>
                          prev.map(t => (t.id === newItem.id ? newItem : t))
                        )
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
                    toast.success('Modelo eliminado exitosamente')
                  } catch (err: unknown) {
                    const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
                    toast.error(errorMessage)
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
          reloadToken={attributesReloadToken}
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
              <option value='USED'>Usado</option>
              <option value='DAMAGED'>Dañado</option>
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
            <SimpleSelect
              value={equipmentStatus}
              onChange={e => setEquipmentStatus(e.target.value)}
            >
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
            <p className='font-medium'>{assignedUserDept.name}</p>
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
          <div className='rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3'>
            <AssignableUserSelect
              familyId={familyId}
              value={assignedUserId}
              onChange={(userId, user) => {
                setAssignedUserId(userId)
                setAssignedUserDept(user?.department ?? null)
              }}
              required
            />
            <div className='space-y-1'>
              <Label>
                Fecha de Devolución Estimada{' '}
                <span className='text-xs text-muted-foreground font-normal'>(opcional)</span>
              </Label>
              <DateInput
                value={assignmentEndDate}
                onChange={e => setAssignmentEndDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                clearable
              />
              <p className='text-xs text-muted-foreground'>
                Si es préstamo o uso temporal, indica la fecha esperada de devolución. El sistema
                enviará una alerta próxima a esa fecha.
              </p>
            </div>
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
            supplierId={maintenanceSupplierId}
            onSupplierChange={setMaintenanceSupplierId}
            description={maintenanceDescription}
            onDescriptionChange={setMaintenanceDescription}
            familyId={familyId}
          />
        )}

        {/* ── 4. ADQUISICIÓN ────────────────────────────────────────── */}
        {/* Ocultar cuando el estado es transitorio (MAINTENANCE/FOR_SALE) — solo datos operativos */}
        {equipmentStatus !== 'MAINTENANCE' && equipmentStatus !== 'FOR_SALE' && (
          <>
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

            {/* Contrato — arrendamiento */}
            {isVisible('CONTRACT') && acquisitionMode === 'RENTAL' && (
              <div className='rounded-md border border-border p-4 space-y-3'>
                <p className='text-sm font-medium'>
                  Contrato de arrendamiento
                  {isRequired('CONTRACT') && <span className='text-destructive'> *</span>}
                </p>
                <ContractPicker
                  value={linkedContractId}
                  onChange={handleContractChange}
                  supplierId={supplierId || null}
                  familyId={familyId}
                  context='equipment'
                  prefill={contractPrefill}
                  draftParentKey={draftKey}
                />
                {linkedContract && contractFinancial ? (
                  <div className='rounded-md border bg-muted/30 px-3 py-2.5 space-y-1'>
                    <p className='text-xs text-muted-foreground'>{contractFinancial.amountLabel}</p>
                    <p className='text-sm font-medium font-mono'>
                      {formatContractAmount(
                        contractFinancial.displayAmount,
                        contractFinancial.currency
                      )}
                    </p>
                    {(contractFinancial.startDate || contractFinancial.endDate) && (
                      <p className='text-[11px] text-muted-foreground'>
                        Vigencia: {contractFinancial.startDate ?? '—'} →{' '}
                        {contractFinancial.endDate ?? '—'}
                      </p>
                    )}
                    <p className='text-[11px] text-muted-foreground'>
                      Tomado automáticamente del contrato vinculado. El costo y las fechas se
                      sincronizan al guardar.
                    </p>
                  </div>
                ) : (
                  <p className='text-xs text-muted-foreground rounded-md bg-muted/40 px-3 py-2'>
                    Vincula un contrato de arrendamiento para cargar costo mensual y vigencia
                    automáticamente.
                  </p>
                )}

                <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1'>
                  <div className='space-y-1'>
                    <Label htmlFor='rentalDeliveryDate'>Fecha de entrega</Label>
                    <DateInput
                      id='rentalDeliveryDate'
                      value={rentalDeliveryDate}
                      onChange={e => setRentalDeliveryDate(e.target.value)}
                      clearable
                    />
                    <p className='text-[11px] text-muted-foreground'>
                      Entrega física del equipo (puede diferir del inicio del contrato).
                    </p>
                  </div>
                  <div className='space-y-1'>
                    <Label htmlFor='rentalBuyoutValue'>Valor opción de compra</Label>
                    <Input
                      id='rentalBuyoutValue'
                      type='number'
                      min='0'
                      step='0.01'
                      value={rentalBuyoutValue}
                      onChange={e => setRentalBuyoutValue(e.target.value)}
                      placeholder='0.00'
                    />
                    <p className='text-[11px] text-muted-foreground'>
                      Valor de compra al finalizar la renta (según contrato).
                    </p>
                  </div>
                  <div className='space-y-1 sm:col-span-2'>
                    <Label htmlFor='rentalClientResponse'>Respuesta del cliente</Label>
                    <SimpleSelect
                      value={rentalClientResponse}
                      onChange={e => setRentalClientResponse(e.target.value)}
                      options={[
                        { value: 'NOT_NOTIFIED', label: 'No se ha notificado al cliente' },
                        { value: 'PENDING_DECISION', label: 'Pendiente de decisión' },
                        { value: 'PURCHASE_CONFIRMED', label: 'Compra del equipo confirmada' },
                        { value: 'RETURN_REQUESTED', label: 'Devolución solicitada' },
                        { value: 'RENEWAL_REQUESTED', label: 'Renovación solicitada' },
                      ]}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── 6. FINANCIERO + DEPRECIACIÓN ──────────────────────────── */}
        {showFinancial &&
          (isEditMode ? (
            // En edición: solo lectura — el precio/fecha/factura ahora se
            // administran desde "Facturas / Pagos de adquisición" en la ficha
            // del equipo (se sincronizan solos hacia estos mismos campos), no
            // aquí, para no tener dos formularios pidiendo lo mismo.
            <div className='space-y-1'>
              <FinancialInfoSection
                title='Información Financiera'
                hiddenFields={['supplier']}
                purchasePrice={purchasePrice ? parseFloat(purchasePrice) : null}
                purchaseDate={purchaseDate || null}
                invoiceNumber={invoiceNumber}
                purchaseOrderNumber={purchaseOrderNumber}
                collapsible={false}
                readOnly
              />
              <p className='text-xs text-muted-foreground'>
                Para modificar precio, fecha o N° de factura, edítalo en &quot;Facturas / Pagos de
                adquisición&quot;, en la ficha del equipo.
              </p>
            </div>
          ) : (
            <FinancialInfoSection
              title='Información Financiera'
              hiddenFields={['supplier']}
              required={financialRequired}
              priceError={priceError}
              purchasePrice={purchasePrice ? parseFloat(purchasePrice) : null}
              purchaseDate={purchaseDate || null}
              invoiceNumber={invoiceNumber}
              purchaseOrderNumber={purchaseOrderNumber}
              collapsible={false}
              onChange={(field, value) => {
                if (field === 'purchasePrice') setPurchasePrice(value != null ? String(value) : '')
                else if (field === 'purchaseDate') setPurchaseDate(value ?? '')
                else if (field === 'invoiceNumber') setInvoiceNumber(value ?? '')
                else if (field === 'purchaseOrderNumber') setPurchaseOrderNumber(value ?? '')
              }}
            />
          ))}

        {showDepreciation && (
          <fieldset className='rounded-lg border border-border p-4 space-y-3'>
            <legend className='px-2 text-sm font-semibold text-foreground'>
              Depreciación
              {isRequired('DEPRECIATION') && <span className='text-destructive'> *</span>}
            </legend>
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

        {/* Nota informativa: arrendamiento / activo de tercero no deprecia contablemente */}
        {isVisible('DEPRECIATION') && acquisitionMode !== 'FIXED_ASSET' && (
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
          existingAttachments={existingAttachments}
          onChange={setAttachments}
          onDeleteExisting={
            isEditMode && equipmentId
              ? async (attachmentId: string) => {
                  try {
                    const res = await fetch(
                      `/api/inventory/equipment/${equipmentId}/attachments/${attachmentId}`,
                      { method: 'DELETE' }
                    )
                    if (res.ok) {
                      setExistingAttachments(prev => prev.filter(a => a.id !== attachmentId))
                    } else {
                      const err = await res.json()
                      toast.error(err.error || 'No se pudo eliminar el adjunto')
                    }
                  } catch {
                    toast.error('Error al eliminar el adjunto')
                  }
                }
              : undefined
          }
          maxFileSizeMB={maxFileSizeMB}
          equipmentId={isEditMode ? equipmentId : undefined}
        />

        {submitError && <p className='text-sm text-destructive'>{submitError}</p>}

        <div className='flex gap-3 pt-2'>
          <Button type='button' variant='outline' onClick={onBack} disabled={submitting}>
            ← Atrás
          </Button>
          <Button type='submit' disabled={submitting} className='flex-1'>
            {submitting ? 'Guardando...' : isEditMode ? 'Guardar cambios' : 'Crear Activo'}
          </Button>
        </div>
      </form>

      {/* Gestor de atributos encadenado desde el selector de Tipo de Equipo */}
      {manageAttributesFor && (
        <AttributeManagerDialog
          open={!!manageAttributesFor}
          onOpenChange={o => {
            if (!o) {
              setManageAttributesFor(null)
              setManageAttributesAutoCreate(false)
            }
          }}
          typeKind='equipment'
          typeId={manageAttributesFor.id}
          typeName={manageAttributesFor.name}
          autoOpenCreate={manageAttributesAutoCreate}
          onAttributesChange={() => setAttributesReloadToken(t => t + 1)}
        />
      )}
    </>
  )
}

// Wrapper para campos personalizados que solo muestra si hay campos configurados
function TypeAttributesSection({
  typeId,
  values,
  onChange,
  reloadToken,
}: {
  typeId: string
  values: Array<{ fieldName: string; fieldValue: string }>
  onChange: (values: Array<{ fieldName: string; fieldValue: string }>) => void
  reloadToken?: number
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
        reloadToken={reloadToken}
      />
    </div>
  )
}
