'use client'

import { useState, useEffect, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select'
import { InlineCreateSelect } from '@/components/ui/inline-create-select'
import { SimpleSelect } from '@/components/ui/simple-select'
import { ContractPicker } from '@/components/contracts/contract-picker'
import { SupplierSelect } from '@/components/inventory/suppliers/SupplierSelect'
import { EquipmentTypeInlineForm } from '@/components/inventory/asset-forms/EquipmentTypeInlineForm'
import { WarehouseInlineForm } from '@/components/inventory/asset-forms/WarehouseInlineForm'
import { FileInputWithCamera } from '@/components/common/file-input-with-camera'
import { AssignableUserSelect } from '@/components/inventory/shared/AssignableUserSelect'
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
import {
  X,
  Plus,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Upload,
  Camera,
  Eye,
  FileText,
  Image as ImageIcon,
} from 'lucide-react'

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

// ── Componente interno de adjuntos con cámara y preview ──────────────────────

const IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function AttachmentsField({
  files,
  onChange,
  maxFileSizeMB = 10,
}: {
  files: File[]
  onChange: (files: File[]) => void
  maxFileSizeMB?: number
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState('')

  const ACCEPTED = 'image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt'

  const addFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files
    if (!list) return
    const maxBytes = maxFileSizeMB * 1024 * 1024
    const toAdd: File[] = []
    Array.from(list).forEach(f => {
      if (f.size > maxBytes) return // silently skip oversized (could add toast)
      if (!files.find(x => x.name === f.name && x.size === f.size)) toAdd.push(f)
    })
    if (toAdd.length > 0) onChange([...files, ...toAdd])
  }

  const remove = (i: number) => onChange(files.filter((_, j) => j !== i))

  const openPreview = (f: File) => {
    const url = URL.createObjectURL(f)
    setPreviewUrl(url)
    setPreviewName(f.name)
  }

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPreviewName('')
  }

  const images = files.filter(f => IMAGE_TYPES.includes(f.type))
  const docs = files.filter(f => !IMAGE_TYPES.includes(f.type))

  return (
    <>
      <div className='space-y-2'>
        <div className='flex items-center justify-between'>
          <Label>Imágenes y Adjuntos</Label>
          <FileInputWithCamera accept={ACCEPTED} multiple onChange={addFiles}>
            {({ openFile, openCamera, showCamera }) => (
              <div className='flex items-center gap-1.5'>
                {showCamera && (
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    onClick={openCamera}
                    title='Tomar foto'
                  >
                    <Camera className='h-4 w-4 mr-1.5' />
                    Foto
                  </Button>
                )}
                <Button type='button' size='sm' variant='outline' onClick={openFile}>
                  <Upload className='h-4 w-4 mr-1.5' />
                  {showCamera ? 'Archivo' : 'Subir archivo'}
                </Button>
              </div>
            )}
          </FileInputWithCamera>
        </div>

        {files.length === 0 ? (
          <FileInputWithCamera accept={ACCEPTED} multiple onChange={addFiles}>
            {({ openFile, openCamera, showCamera }) => (
              <div
                className='flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-6 text-muted-foreground cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors'
                onClick={openFile}
              >
                <Upload className='h-6 w-6 opacity-40' />
                <p className='text-sm'>
                  Arrastra archivos o <span className='text-primary font-medium'>haz clic</span>
                </p>
                {showCamera && (
                  <Button
                    type='button'
                    size='sm'
                    variant='ghost'
                    className='text-xs'
                    onClick={e => {
                      e.stopPropagation()
                      openCamera()
                    }}
                  >
                    <Camera className='h-3.5 w-3.5 mr-1' />O toma una foto con la cámara
                  </Button>
                )}
                <p className='text-xs'>Máx. {maxFileSizeMB} MB por archivo</p>
              </div>
            )}
          </FileInputWithCamera>
        ) : (
          <div className='space-y-3'>
            {/* Galería de imágenes */}
            {images.length > 0 && (
              <div>
                <p className='text-xs text-muted-foreground mb-1.5 flex items-center gap-1'>
                  <ImageIcon className='h-3.5 w-3.5' />
                  Imágenes ({images.length})
                </p>
                <div className='grid grid-cols-3 sm:grid-cols-4 gap-2'>
                  {images.map((f, i) => {
                    const url = URL.createObjectURL(f)
                    return (
                      <div
                        key={i}
                        className='group relative aspect-square rounded-lg overflow-hidden border border-border bg-muted'
                      >
                        <img
                          src={url}
                          alt={f.name}
                          className='h-full w-full object-cover'
                          onLoad={() => URL.revokeObjectURL(url)}
                        />
                        <div className='absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-1'>
                          <button
                            type='button'
                            onClick={() => openPreview(f)}
                            className='opacity-0 group-hover:opacity-100 transition-opacity rounded-full bg-black/60 p-1 text-white hover:bg-black/80'
                            title='Vista previa'
                          >
                            <Eye className='h-3.5 w-3.5' />
                          </button>
                          <button
                            type='button'
                            onClick={() => remove(files.indexOf(f))}
                            className='opacity-0 group-hover:opacity-100 transition-opacity rounded-full bg-black/60 p-1 text-white hover:bg-destructive'
                            title='Eliminar'
                          >
                            <X className='h-3.5 w-3.5' />
                          </button>
                        </div>
                        <p className='absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity'>
                          {f.name}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Lista de documentos */}
            {docs.length > 0 && (
              <div>
                {images.length > 0 && (
                  <p className='text-xs text-muted-foreground mb-1.5 flex items-center gap-1'>
                    <FileText className='h-3.5 w-3.5' />
                    Documentos ({docs.length})
                  </p>
                )}
                <ul className='space-y-1'>
                  {docs.map((f, i) => (
                    <li
                      key={i}
                      className='flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-sm'
                    >
                      <FileText className='h-3.5 w-3.5 shrink-0 text-muted-foreground' />
                      <span className='flex-1 truncate'>{f.name}</span>
                      <span className='text-xs text-muted-foreground shrink-0'>
                        {formatFileSize(f.size)}
                      </span>
                      <button
                        type='button'
                        onClick={() => remove(files.indexOf(f))}
                        className='rounded p-0.5 hover:bg-muted'
                        title='Eliminar'
                      >
                        <X className='h-3.5 w-3.5 text-muted-foreground' />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de preview */}
      {previewUrl && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4'
          onClick={closePreview}
        >
          <div
            className='relative max-h-[90vh] max-w-[90vw] overflow-auto rounded-lg bg-card shadow-xl'
            onClick={e => e.stopPropagation()}
          >
            <button
              type='button'
              onClick={closePreview}
              className='absolute right-2 top-2 z-10 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70'
            >
              <X className='h-4 w-4' />
            </button>
            <img
              src={previewUrl}
              alt={previewName}
              className='max-h-[85vh] max-w-[85vw] rounded-lg object-contain'
            />
            <p className='px-3 py-1.5 text-center text-xs text-muted-foreground'>{previewName}</p>
          </div>
        </div>
      )}
    </>
  )
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
}: EquipmentAssetFormProps) {
  const [acquisitionMode, setAcquisitionMode] = useState<'FIXED_ASSET' | 'RENTAL' | 'LOAN'>(
    'FIXED_ASSET'
  )
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

  // ✅ Departamentos desde contexto global — filtrados por familyId en memoria
  const { departments: allDepartments } = useActiveDepartments()
  const departments = allDepartments.filter(
    (dept): dept is typeof dept & { familyId: string } => dept.familyId === familyId
  )
  const loadingDepartments = false

  // Departamento manual (AVAILABLE, MAINTENANCE, DAMAGED)
  const [departmentId, setDepartmentId] = useState('')

  // departmentId efectivo según estado
  const effectiveDepartmentId =
    equipmentStatus === 'ASSIGNED' ? (assignedUserDept?.id ?? '') : departmentId

  // Task 19.1: family depreciation config from API
  const [familyDepConfig, setFamilyDepConfig] = useState<FamilyDepreciationConfig | null>(null)
  const [depreciationPreviewOpen, setDepreciationPreviewOpen] = useState(false)

  // Resolver secciones según modalidad activa (sectionsByMode tiene prioridad sobre global)
  const resolvedSections = resolveSectionsForMode(familyConfig, acquisitionMode)
  const isVisible = (s: string) => resolvedSections.visible.includes(s as never)

  // Visibilidad condicional por estado — definidas después de isVisible
  // Departamento manual: AVAILABLE, MAINTENANCE, DAMAGED (no ASSIGNED ni RETIRED)
  const showDepartmentSelector = ['AVAILABLE', 'MAINTENANCE', 'DAMAGED'].includes(equipmentStatus)
  // Bodega: solo cuando el equipo está físicamente almacenado (AVAILABLE o DAMAGED)
  const showWarehouse = isVisible('WAREHOUSE') && ['AVAILABLE', 'DAMAGED'].includes(equipmentStatus)

  // Task 19.1: determine if family supports depreciation
  const supportsDepreciation = familyCode ? familySupportsDepreciation(familyCode) : true

  useEffect(() => {
    fetch(`/api/inventory/equipment-types?familyId=${familyId}`)
      .then(r => r.json())
      .then(d => setEquipmentTypes(d.types ?? []))
    fetch(`/api/inventory/warehouses?familyId=${familyId}`)
      .then(r => r.json())
      .then(d => setWarehouses(d.warehouses ?? d ?? []))
  }, [familyId])

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

  const addAccessory = () => {
    const v = accessoryInput.trim()
    if (v && !accessories.includes(v)) {
      setAccessories(p => [...p, v])
      setAccessoryInput('')
    }
  }

  const addSpec = () => {
    const k = specKey.trim()
    const v = specValue.trim()
    if (k && v) {
      setSpecifications(p => ({ ...p, [k]: v }))
      setSpecKey('')
      setSpecValue('')
    }
  }

  const supplierLabel =
    acquisitionMode === 'RENTAL'
      ? 'Proveedor del Arrendamiento'
      : acquisitionMode === 'LOAN'
        ? 'Propietario del Bien'
        : 'Proveedor'
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
      departmentId: effectiveDepartmentId || undefined,
      condition,
      status: equipmentStatus,
      accessories: accessories.length ? accessories : undefined,
      specifications: Object.keys(specifications).length ? specifications : undefined,
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
      {/* Marca / Modelo */}
      <div className='grid grid-cols-2 gap-3'>
        <div className='space-y-1'>
          <Label>Marca</Label>
          <Input value={brand} onChange={e => setBrand(e.target.value)} placeholder='Ej: Dell' />
        </div>
        <div className='space-y-1'>
          <Label>Modelo</Label>
          <Input
            value={model}
            onChange={e => setModel(e.target.value)}
            placeholder='Ej: Latitude 5520'
          />
        </div>
      </div>

      {/* N° Serie */}
      <div className='space-y-1'>
        <Label>N° de Serie del Fabricante</Label>
        <Input
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

      {/* Tipo de equipo */}
      <div className='space-y-1'>
        <Label>Tipo de Equipo</Label>
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
          }}
        />
      </div>

      {/* ── 2. UBICACIÓN ──────────────────────────────────────────── */}
      {/* Departamento — visible en AVAILABLE, MAINTENANCE, DAMAGED */}
      {showDepartmentSelector && (
        <div className='space-y-1'>
          <Label>Departamento</Label>
          {loadingDepartments ? (
            <div className='h-9 rounded-md border border-input bg-background flex items-center px-3 text-sm text-muted-foreground'>
              Cargando departamentos...
            </div>
          ) : departments.length === 0 ? (
            <div className='flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground'>
              <AlertCircle className='h-4 w-4 shrink-0' />
              No hay departamentos activos para esta familia
            </div>
          ) : (
            <SearchableSelect
              options={departments.map(d => ({ id: d.id, name: d.name }))}
              value={departmentId}
              onChange={setDepartmentId}
              placeholder='Buscar departamento...'
            />
          )}
        </div>
      )}

      {/* ── 3. ESTADO + ASIGNACIÓN ────────────────────────────────── */}
      <div className='grid grid-cols-2 gap-3'>
        <div className='space-y-1'>
          <Label>
            Condición <span className='text-destructive'>*</span>
          </Label>
          <SimpleSelect value={condition} onChange={e => setCondition(e.target.value)}>
            <option value='NEW'>Nuevo</option>
            <option value='LIKE_NEW'>Como Nuevo</option>
            <option value='GOOD'>Bueno</option>
            <option value='FAIR'>Regular</option>
            <option value='POOR'>Malo</option>
          </SimpleSelect>
          {condition === 'NEW' && requireFinancialForNew && (
            <p className='text-xs text-amber-600 dark:text-amber-400'>
              Activo nuevo — información financiera obligatoria.
            </p>
          )}
        </div>
        <div className='space-y-1'>
          <Label>Estado</Label>
          <SimpleSelect value={equipmentStatus} onChange={e => setEquipmentStatus(e.target.value)}>
            <option value='AVAILABLE'>Disponible</option>
            <option value='ASSIGNED'>Asignado</option>
            <option value='MAINTENANCE'>En Mantenimiento</option>
            <option value='DAMAGED'>Dañado</option>
            <option value='RETIRED'>Retirado</option>
          </SimpleSelect>
        </div>
      </div>

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

      {/* Asignar a usuario — usa el componente compartido con departamento auto-rellenado */}
      {equipmentStatus === 'ASSIGNED' && (
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

      {/* Mantenimiento — fecha de ingreso, tipo y técnico asignado */}
      {equipmentStatus === 'MAINTENANCE' && (
        <div className='rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 space-y-3'>
          <p className='text-sm font-medium text-amber-800 dark:text-amber-300'>
            Datos del mantenimiento
          </p>
          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1'>
              <Label>
                Fecha de ingreso <span className='text-destructive'>*</span>
              </Label>
              <Input
                type='date'
                value={maintenanceDate}
                onChange={e => setMaintenanceDate(e.target.value)}
              />
            </div>
            <div className='space-y-1'>
              <Label>Tipo de mantenimiento</Label>
              <SimpleSelect
                value={maintenanceType}
                onChange={e => setMaintenanceType(e.target.value as 'PREVENTIVE' | 'CORRECTIVE')}
              >
                <option value='CORRECTIVE'>Correctivo</option>
                <option value='PREVENTIVE'>Preventivo</option>
              </SimpleSelect>
            </div>
          </div>
          <div className='space-y-1'>
            <Label>Técnico asignado</Label>
            <SearchableSelect
              options={techniciansList.map(t => ({ id: t.id, name: t.name || t.email }))}
              value={maintenanceTechnicianId}
              onChange={setMaintenanceTechnicianId}
              placeholder={loadingTechnicians ? 'Cargando técnicos...' : 'Buscar técnico...'}
              disabled={loadingTechnicians}
            />
          </div>
          <div className='space-y-1'>
            <Label>Descripción del problema / trabajo</Label>
            <Textarea
              value={maintenanceDescription}
              onChange={e => setMaintenanceDescription(e.target.value)}
              rows={2}
              placeholder='Describe el motivo del mantenimiento...'
            />
          </div>
        </div>
      )}

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

      {/* ── 4. DETALLES DEL EQUIPO ────────────────────────────────── */}
      {/* Accesorios */}
      <div className='space-y-2'>
        <Label>Accesorios</Label>
        <div className='flex gap-2'>
          <Input
            value={accessoryInput}
            onChange={e => setAccessoryInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addAccessory()
              }
            }}
            placeholder='Ej: Cargador, Mouse, Funda...'
          />
          <Button type='button' variant='outline' size='sm' onClick={addAccessory}>
            <Plus className='h-4 w-4' />
          </Button>
        </div>
        {accessories.length > 0 && (
          <div className='flex flex-wrap gap-1.5'>
            {accessories.map(a => (
              <span
                key={a}
                className='inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs'
              >
                {a}
                <button type='button' onClick={() => setAccessories(p => p.filter(x => x !== a))}>
                  <X className='h-3 w-3' />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Especificaciones */}
      <div className='space-y-2'>
        <Label>Características / Especificaciones</Label>
        <div className='flex gap-2'>
          <Input
            value={specKey}
            onChange={e => setSpecKey(e.target.value)}
            placeholder='Ej: Procesador'
            className='flex-1'
          />
          <Input
            value={specValue}
            onChange={e => setSpecValue(e.target.value)}
            placeholder='Ej: Intel i5-1135G7'
            className='flex-1'
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addSpec()
              }
            }}
          />
          <Button type='button' variant='outline' size='sm' onClick={addSpec}>
            <Plus className='h-4 w-4' />
          </Button>
        </div>
        {Object.keys(specifications).length > 0 && (
          <div className='rounded-md border border-border divide-y divide-border text-sm'>
            {Object.entries(specifications).map(([k, v]) => (
              <div key={k} className='flex items-center justify-between px-3 py-1.5'>
                <span>
                  <span className='font-medium'>{k}:</span> {v}
                </span>
                <button
                  type='button'
                  onClick={() =>
                    setSpecifications(p => {
                      const n = { ...p }
                      delete n[k]
                      return n
                    })
                  }
                >
                  <X className='h-3 w-3 text-muted-foreground' />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 5. ADQUISICIÓN ────────────────────────────────────────── */}
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

      {/* Contrato — RENTAL y LOAN */}
      {(acquisitionMode === 'RENTAL' || acquisitionMode === 'LOAN') && (
        <div className='rounded-md border border-border p-4 space-y-3'>
          <p className='text-sm font-medium'>
            {acquisitionMode === 'RENTAL'
              ? 'Contrato de arrendamiento'
              : 'Contrato del activo de tercero'}
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

      {isVisible('DEPRECIATION') && supportsDepreciation && acquisitionMode === 'FIXED_ASSET' && (
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
                    Ej: un generador usa &ldquo;horas&rdquo;, un vehículo usa &ldquo;km&rdquo;, una
                    prensa usa &ldquo;ciclos&rdquo;.
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
                        Depreciación = (Precio − Residual) ÷ Total {unitLabel} × {unitLabel} usados
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
