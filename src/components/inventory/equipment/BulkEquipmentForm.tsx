/**
 * BulkEquipmentForm — Formulario para crear múltiples equipos en un lote.
 * Flujo: Familia → Subtipo → Datos del lote
 * Sección 'Datos Comunes' usa los mismos componentes que EquipmentAssetForm.
 */
'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select'
import { SimpleSelect } from '@/components/ui/simple-select'
import { InlineCreateSelect } from '@/components/ui/inline-create-select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Package,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { bulkEquipmentInputSchema } from '@/lib/validations/bulk-equipment'
import { StockIndicatorBadge } from '@/components/inventory/equipment/StockIndicatorBadge'
import { useActiveDepartments } from '@/contexts/departments-context'
import { FamilySelector } from '@/components/inventory/family-selector'
import { SubtypeSelector } from '@/components/inventory/subtype-selector'
import { useInventoryFamilies } from '@/contexts/families-context'
import { StepHeader } from '@/components/inventory/shared/StepHeader'
import { SupplierSelect } from '@/components/inventory/suppliers/SupplierSelect'
import { BulkMROForm } from '@/components/inventory/equipment/BulkMROForm'
import { AccessoriesSection } from '@/components/inventory/shared/AccessoriesSection'
import { TypeAttributesInput } from '@/components/inventory/custom-fields/type-attributes-input'
import { WarehouseInlineForm } from '@/components/inventory/asset-forms/WarehouseInlineForm'
import { ModelSelector } from '@/components/inventory/models/ModelSelector'
import { ContractPicker } from '@/components/contracts/contract-picker'
import { toast } from 'sonner'
import {
  calculateDepreciation,
  getRecommendedDepreciationMethod,
  DEFAULT_USEFUL_LIFE_YEARS,
  normalizeDepreciationMethod,
  type DepreciationMethod,
} from '@/lib/inventory/depreciation'
import {
  resolveSectionsForMode,
  type FamilyConfig,
  type AssetSubtype,
  type AcquisitionMode,
  type FormSection,
} from '@/lib/inventory/family-config-types'

export interface BulkEquipmentFormProps {
  onSuccess?: (result: any) => void
  onCancel?: () => void
  prefillData?: Partial<z.infer<typeof bulkEquipmentInputSchema>>
  defaultFamilyId?: string
}

interface FamilyDepreciationConfig {
  defaultDepreciationMethod: string | null
  defaultUsefulLifeYears: number | null
  defaultResidualValuePct: number | null
}

const ACQUISITION_MODES: { value: AcquisitionMode; label: string; help: string }[] = [
  {
    value: 'FIXED_ASSET',
    label: 'Compra directa (Activo Fijo)',
    help: 'Es propiedad de la empresa, se deprecia.',
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

const DEP_HELP: Record<string, string> = {
  LINEAR: 'Descuenta el mismo monto cada año. Ideal para mobiliario e infraestructura.',
  DECLINING_BALANCE:
    'Descuenta más en los primeros años. Ideal para tecnología que se vuelve obsoleta rápido.',
  UNITS_OF_PRODUCTION:
    'Descuenta según cuánto se usa el equipo. Ideal para generadores, vehículos, compresores.',
}

export function BulkEquipmentForm({
  onSuccess,
  onCancel,
  prefillData,
  defaultFamilyId,
}: BulkEquipmentFormProps) {
  const router = useRouter()

  // ── Pasos ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null)
  const [selectedFamilyCode, setSelectedFamilyCode] = useState<string | null>(null)
  const [selectedSubtype, setSelectedSubtype] = useState<AssetSubtype>('EQUIPMENT')
  const [familyConfig, setFamilyConfig] = useState<FamilyConfig | null>(null)
  const [loadingConfig, setLoadingConfig] = useState(false)
  const { families, loading: loadingFamilies } = useInventoryFamilies()

  // Datos de la familia seleccionada para el breadcrumb
  const selectedFamily = families.find(f => f.id === selectedFamilyId)

  // ── Estado del formulario ──────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successResult, setSuccessResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [warehouses, setWarehouses] = useState<
    { id: string; name: string; description?: string }[]
  >([])

  // ── Datos Comunes (igual que EquipmentAssetForm) ───────────────────────────
  const [acquisitionMode, setAcquisitionMode] = useState<AcquisitionMode>('FIXED_ASSET')
  const [supplierId, setSupplierId] = useState('')
  const [linkedContractId, setLinkedContractId] = useState<string | null>(null)
  const [purchaseDate, setPurchaseDate] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState('')
  const [accessories, setAccessories] = useState<string[]>([])
  const [customFieldValues, setCustomFieldValues] = useState<
    Array<{ fieldName: string; fieldValue: string }>
  >([])
  const [warehouseId, setWarehouseId] = useState('')
  // Modelo seleccionado del catálogo
  const [selectedModelId, setSelectedModelId] = useState('')
  const [selectedModelData, setSelectedModelData] = useState<any>(null)
  // Depreciación
  const [depreciationMethod, setDepreciationMethod] = useState('LINEAR')
  const [usefulLifeYears, setUsefulLifeYears] = useState('')
  const [residualValue, setResidualValue] = useState('')
  const [totalUnits, setTotalUnits] = useState('')
  const [usedUnits, setUsedUnits] = useState('')
  const [unitLabel, setUnitLabel] = useState('horas')
  const [depreciationPreviewOpen, setDepreciationPreviewOpen] = useState(false)
  const [familyDepConfig, setFamilyDepConfig] = useState<FamilyDepreciationConfig | null>(null)

  const { departments: allDepartments } = useActiveDepartments()
  const initialized = useRef(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(bulkEquipmentInputSchema) as any,
    defaultValues: {
      quantity: prefillData?.quantity || 1,
      codeMode: prefillData?.codeMode || 'auto',
      brand: prefillData?.brand || '',
      model: prefillData?.model || '',
      typeId: prefillData?.typeId || '',
      departmentId: prefillData?.departmentId || '',
      condition: prefillData?.condition || 'NEW',
      ownershipType: 'FIXED_ASSET',
      ...prefillData,
    },
  })

  // cast necesario por incompatibilidad de tipos entre versiones de react-hook-form

  const quantity = watch('quantity')
  const codeMode = watch('codeMode')
  const manualCodesText = watch('manualCodes')
  const serialNumbersText = watch('serialNumbers')
  const selectedTypeId = watch('typeId')
  const selectedDepartmentId = watch('departmentId')

  // ── Secciones visibles ─────────────────────────────────────────────────────
  const resolvedSections = familyConfig
    ? resolveSectionsForMode(familyConfig, acquisitionMode)
    : {
        visible: ['FINANCIAL', 'DEPRECIATION', 'WAREHOUSE'] as FormSection[],
        required: [] as FormSection[],
      }
  const isVisible = (s: string) => resolvedSections.visible.includes(s as any)
  const isRequired = (s: string) => resolvedSections.required.includes(s as any)
  const selectedCondition = watch('condition') as 'NEW' | 'USED' | 'DAMAGED'
  const requireFinancialForNew = familyConfig?.requireFinancialForNew ?? true
  const showFinancial =
    isVisible('FINANCIAL') && acquisitionMode === 'FIXED_ASSET' && selectedCondition !== 'DAMAGED'
  const financialRequired =
    showFinancial &&
    (isRequired('FINANCIAL') || (requireFinancialForNew && selectedCondition === 'NEW'))
  const showDepreciation = isVisible('DEPRECIATION') && acquisitionMode === 'FIXED_ASSET'

  // ── Valor residual sugerido ────────────────────────────────────────────────
  const suggestedResidualValue = useMemo(() => {
    const price = parseFloat(purchasePrice)
    if (!price || !familyDepConfig?.defaultResidualValuePct) return null
    return Math.round(price * (familyDepConfig.defaultResidualValuePct / 100) * 100) / 100
  }, [purchasePrice, familyDepConfig])

  // ── Preview de depreciación ────────────────────────────────────────────────
  const depreciationPreview = useMemo(() => {
    const price = parseFloat(purchasePrice)
    const years = parseFloat(usefulLifeYears)
    const residual = parseFloat(residualValue) || 0
    if (!price || !years || years <= 0) return null
    const method = depreciationMethod as DepreciationMethod
    if (method === 'UNITS_OF_PRODUCTION') {
      const total = parseFloat(totalUnits)
      if (!total || total <= 0) return null
      const checkYears = [1, 3, 5].filter(y => y <= years)
      return checkYears.map(year => {
        const simulatedUsed = Math.min((total / years) * year, total)
        const ratePerUnit = (price - residual) / total
        return {
          year,
          bookValue: Math.round(Math.max(price - ratePerUnit * simulatedUsed, residual)),
        }
      })
    }
    const baseDateObj = purchaseDate ? new Date(purchaseDate) : new Date()
    if (isNaN(baseDateObj.getTime())) return null
    const checkYears = [1, 3, 5].filter(y => y <= years)
    return checkYears.map(year => {
      const refDate = new Date(baseDateObj)
      refDate.setFullYear(refDate.getFullYear() + year)
      const result = calculateDepreciation(price, baseDateObj, years, residual, refDate, method)
      return { year, bookValue: result.bookValue }
    })
  }, [purchasePrice, purchaseDate, usefulLifeYears, residualValue, depreciationMethod, totalUnits])

  // ── Paso 1: selección de familia ───────────────────────────────────────────
  const handleFamilySelect = async (familyId: string) => {
    setSelectedFamilyId(familyId)
    const fam = families.find(f => f.id === familyId)
    setSelectedFamilyCode(fam?.code ?? null)
    setValue('typeId', '')
    setValue('departmentId', '')
    setLoadingConfig(true)
    try {
      const res = await fetch(`/api/inventory/family-config/${familyId}`)
      if (res.ok) {
        const json = await res.json()
        const config: FamilyConfig = json.data ?? json
        setFamilyConfig(config)
        const depCfg: FamilyDepreciationConfig = {
          defaultDepreciationMethod: normalizeDepreciationMethod(config.defaultDepreciationMethod),
          defaultUsefulLifeYears: config.defaultUsefulLifeYears ?? null,
          defaultResidualValuePct: config.defaultResidualValuePct ?? null,
        }
        setFamilyDepConfig(depCfg)
        if (depCfg.defaultDepreciationMethod)
          setDepreciationMethod(depCfg.defaultDepreciationMethod)
        else if (fam?.code) setDepreciationMethod(getRecommendedDepreciationMethod(fam.code))
        if (depCfg.defaultUsefulLifeYears != null)
          setUsefulLifeYears(String(depCfg.defaultUsefulLifeYears))
        else if (fam?.code && DEFAULT_USEFUL_LIFE_YEARS[fam.code] > 0)
          setUsefulLifeYears(String(DEFAULT_USEFUL_LIFE_YEARS[fam.code]))
        const subtypes = config.allowedSubtypes ?? []
        // En lotes, las licencias no aplican (son individuales por naturaleza)
        const batchSubtypes = subtypes.filter(s => s !== 'LICENSE')
        setStep(batchSubtypes.length <= 1 ? 3 : 2)
      }
    } finally {
      setLoadingConfig(false)
    }
  }

  const handleSubtypeSelect = (subtype: AssetSubtype) => {
    setSelectedSubtype(subtype)
    setStep(3)
  }

  // handleBack: si vino con defaultFamilyId, "cambiar familia" navega a /inventory/new
  // Si no vino con defaultFamilyId, retrocede al paso anterior internamente
  const handleBack = () => {
    if (step === 3) {
      if (familyConfig && (familyConfig.allowedSubtypes ?? []).length > 1) {
        setStep(2)
      } else if (defaultFamilyId) {
        // Vino con familia preseleccionada → volver a selección de modalidad
        onCancel?.()
      } else {
        setStep(1)
        setSelectedFamilyId(null)
        setSelectedFamilyCode(null)
        setFamilyConfig(null)
      }
    } else if (step === 2) {
      if (defaultFamilyId) {
        // Vino con familia preseleccionada → volver a selección de modalidad
        onCancel?.()
      } else {
        setStep(1)
        setSelectedFamilyId(null)
        setSelectedFamilyCode(null)
        setFamilyConfig(null)
      }
    }
  }

  useEffect(() => {
    if (!initialized.current && defaultFamilyId) {
      initialized.current = true
      handleFamilySelect(defaultFamilyId)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cargar bodegas filtradas por familia ───────────────────────────────────
  useEffect(() => {
    if (!selectedFamilyId) return
    fetch(`/api/inventory/warehouses?familyId=${selectedFamilyId}`)
      .then(r => r.json())
      .then(d => setWarehouses(d.warehouses ?? d ?? []))
      .catch(() => setWarehouses([]))
  }, [selectedFamilyId])

  // ── Departamentos filtrados por familia ────────────────────────────────────
  const filteredDepartments = selectedFamilyId
    ? allDepartments.filter(d => d.familyId === selectedFamilyId)
    : allDepartments

  useEffect(() => {
    if (selectedDepartmentId) {
      const dept = allDepartments.find(d => d.id === selectedDepartmentId)
      if (dept && selectedFamilyId && dept.familyId !== selectedFamilyId)
        setValue('departmentId', '')
    }
  }, [selectedFamilyId, selectedDepartmentId, allDepartments, setValue])

  // ── Validaciones de cantidad ───────────────────────────────────────────────
  const manualCodesRaw = Array.isArray(manualCodesText)
    ? manualCodesText.join('\n')
    : manualCodesText || ''
  const serialNumbersRaw = Array.isArray(serialNumbersText)
    ? serialNumbersText.join('\n')
    : serialNumbersText || ''
  const manualCodesCount = manualCodesRaw
    ? manualCodesRaw.split('\n').filter((l: string) => l.trim()).length
    : 0
  const manualCodesValid = codeMode === 'manual' ? manualCodesCount === quantity : true
  const serialNumbersCount = serialNumbersRaw
    ? serialNumbersRaw.split('\n').filter((l: string) => l.trim()).length
    : 0
  const serialNumbersValid = serialNumbersCount === 0 || serialNumbersCount === quantity

  // ── Submit ─────────────────────────────────────────────────────────────────
  const onSubmit = async (data: any) => {
    if (!selectedModelId) {
      setError('Debes seleccionar un modelo del catálogo')
      return
    }
    if (!data.departmentId) {
      setError('Selecciona el departamento responsable del lote')
      return
    }
    if (!manualCodesValid) {
      setError(`Debes ingresar exactamente ${quantity} códigos en modo manual`)
      return
    }
    if (!serialNumbersValid) {
      setError(`Los números de serie deben ser 0 o exactamente ${quantity}`)
      return
    }
    if ((acquisitionMode === 'RENTAL' || acquisitionMode === 'LOAN') && !supplierId) {
      setError(
        acquisitionMode === 'RENTAL'
          ? 'Selecciona el proveedor del arrendamiento'
          : 'Selecciona el propietario del bien'
      )
      return
    }
    if (financialRequired && !purchasePrice) {
      setError('El precio unitario es obligatorio')
      return
    }
    if (isRequired('DEPRECIATION') && showDepreciation) {
      if (!depreciationMethod) {
        setError('Selecciona el método de depreciación')
        return
      }
      if (!usefulLifeYears || parseFloat(usefulLifeYears) <= 0) {
        setError('Ingresa la vida útil en años')
        return
      }
    }
    if (isRequired('WAREHOUSE') && isVisible('WAREHOUSE') && !warehouseId) {
      setError('Selecciona la bodega de almacenamiento')
      return
    }
    if (
      isRequired('CONTRACT') &&
      isVisible('CONTRACT') &&
      acquisitionMode === 'RENTAL' &&
      !linkedContractId
    ) {
      setError('Selecciona el contrato de arrendamiento')
      return
    }

    const brandName =
      typeof selectedModelData?.brand === 'string'
        ? selectedModelData.brand
        : selectedModelData?.brand?.name || data.brand
    const modelName = selectedModelData?.model || data.model
    if (!brandName || !modelName) {
      setError('El modelo seleccionado no tiene marca o nombre válido')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const manualCodes =
        data.codeMode === 'manual' && data.manualCodes
          ? Array.isArray(data.manualCodes)
            ? data.manualCodes
            : String(data.manualCodes)
                .split('\n')
                .filter((l: string) => l.trim())
          : undefined
      const serialNumbers = data.serialNumbers
        ? Array.isArray(data.serialNumbers)
          ? data.serialNumbers
          : String(data.serialNumbers)
              .split('\n')
              .filter((l: string) => l.trim())
        : undefined
      const response = await fetch('/api/inventory/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Identificación
          modelId: selectedModelId,
          quantity: data.quantity,
          codeMode: data.codeMode,
          manualCodes,
          serialNumbers,
          familyId: selectedFamilyId,
          // Datos del equipo (del modelo seleccionado)
          brand: brandName,
          model: modelName,
          typeId: selectedModelData?.type?.id || data.typeId,
          departmentId: data.departmentId || undefined,
          condition: data.condition,
          warehouseId: warehouseId || undefined,
          accessories: accessories.length ? accessories : undefined,
          customValues: customFieldValues.length ? customFieldValues : undefined,
          notes: data.notes || undefined,
          // Adquisición
          acquisitionMode,
          ownershipType: acquisitionMode,
          supplierId: supplierId || undefined,
          contractId: linkedContractId || undefined,
          purchaseDate: purchaseDate || undefined,
          purchasePrice: purchasePrice ? parseFloat(purchasePrice) : undefined,
          invoiceNumber: invoiceNumber || undefined,
          purchaseOrderNumber: purchaseOrderNumber || undefined,
          // Depreciación (solo FIXED_ASSET)
          depreciationMethod: acquisitionMode === 'FIXED_ASSET' ? depreciationMethod : undefined,
          usefulLifeYears:
            acquisitionMode === 'FIXED_ASSET' && usefulLifeYears
              ? parseFloat(usefulLifeYears)
              : undefined,
          residualValue:
            acquisitionMode === 'FIXED_ASSET' && residualValue
              ? parseFloat(residualValue)
              : undefined,
          ...(acquisitionMode === 'FIXED_ASSET' &&
            depreciationMethod === 'UNITS_OF_PRODUCTION' && {
              totalUnits: totalUnits ? parseFloat(totalUnits) : undefined,
              usedUnits: usedUnits ? parseFloat(usedUnits) : undefined,
            }),
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        const detail = result.details?.[0]?.message
        throw new Error(
          result.error || detail || result.message || 'Error al crear equipos por lote'
        )
      }
      setSuccessResult(result)
      toast.success(result.summary?.message || 'Lote creado exitosamente')
      if (onSuccess) onSuccess(result)
    } catch (err: any) {
      setError(err.message || 'Error desconocido')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Pantalla de éxito ──────────────────────────────────────────────────────
  if (successResult) {
    return (
      <div className='space-y-4'>
        <Button variant='ghost' size='sm' onClick={() => router.back()}>
          <ArrowLeft className='mr-2 h-4 w-4' />
          Volver
        </Button>
        <div className='rounded-lg border border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800 p-6'>
          <div className='flex items-start gap-4'>
            <div className='rounded-full bg-green-100 dark:bg-green-900 p-3'>
              <CheckCircle2 className='h-6 w-6 text-green-600 dark:text-green-400' />
            </div>
            <div className='flex-1 space-y-3'>
              <div>
                <h2 className='text-xl font-semibold text-green-900 dark:text-green-100'>
                  Equipos creados exitosamente
                </h2>
                <p className='text-sm text-green-700 dark:text-green-300 mt-1'>
                  Se crearon {successResult.summary?.totalEquipment ?? successResult.summary?.total}{' '}
                  equipos
                  {successResult.batch?.batchCode && ` — Lote: ${successResult.batch.batchCode}`}
                </p>
              </div>
              <div className='rounded-md bg-white dark:bg-green-900/30 p-4 space-y-2 text-sm'>
                <p className='text-muted-foreground'>
                  <strong>Primer código:</strong> {successResult.summary.firstCode}
                </p>
                <p className='text-muted-foreground'>
                  <strong>Último código:</strong> {successResult.summary.lastCode}
                </p>
              </div>
              <div className='flex gap-2 pt-2'>
                <Button onClick={() => router.push('/inventory/equipment')} className='flex-1'>
                  Ver inventario
                </Button>
                <Button
                  variant='outline'
                  onClick={() => {
                    setSuccessResult(null)
                    setError(null)
                    setStep(1)
                  }}
                  className='flex-1'
                >
                  Crear otro lote
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Paso 1: Selección de familia ───────────────────────────────────────────
  if (step === 1) {
    return (
      <div className='space-y-6'>
        <StepHeader
          mode='bulk'
          step={1}
          description='Elige el área de la organización a la que pertenecen los activos del lote.'
        />{' '}
        {loadingFamilies ? (
          <div className='flex items-center justify-center h-32'>
            <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
          </div>
        ) : (
          <FamilySelector
            families={families}
            selectedId={selectedFamilyId}
            onSelect={handleFamilySelect}
            disabled={loadingConfig}
          />
        )}
        {loadingConfig && (
          <p className='text-sm text-muted-foreground'>Cargando configuración...</p>
        )}
      </div>
    )
  }

  // ── Paso 2: Selección de subtipo ───────────────────────────────────────────
  if (step === 2 && familyConfig) {
    return (
      <div className='space-y-6'>
        <StepHeader
          mode='bulk'
          step={2}
          description='Indica si el lote es de equipos físicos o materiales consumibles.'
          familyName={selectedFamily?.name}
          familyColor={selectedFamily?.color}
          backLabel='Cambiar familia'
          onBack={handleBack}
        />
        <SubtypeSelector
          allowedSubtypes={familyConfig.allowedSubtypes.filter(s => s !== 'LICENSE')}
          onSelect={handleSubtypeSelect}
        />
      </div>
    )
  }

  // ── Paso 3: Formulario del lote ────────────────────────────────────────────
  // Para MRO: formulario simplificado de consumibles en lote
  if (step === 3 && selectedSubtype === 'MRO' && familyConfig) {
    return (
      <BulkMROForm
        familyId={selectedFamilyId!}
        familyConfig={familyConfig}
        familyName={selectedFamily?.name}
        familyColor={selectedFamily?.color ?? undefined}
        onBack={handleBack}
        onCancel={onCancel}
        onSuccess={onSuccess}
      />
    )
  }

  // Para EQUIPMENT: formulario completo de lote de equipos
  return (
    <form onSubmit={(handleSubmit as any)(onSubmit)} className='space-y-6'>
      {/* Header estandarizado + contador de equipos */}
      <div className='flex items-start justify-between gap-4'>
        <div className='flex-1 min-w-0'>
          <StepHeader
            mode='bulk'
            step={3}
            description='Completa los datos comunes a todas las unidades del lote.'
            familyName={selectedFamily?.name}
            familyColor={selectedFamily?.color}
            subtypeName={selectedSubtype}
            backLabel='Cambiar tipo'
            onBack={handleBack}
          />
        </div>
        <div className='text-right shrink-0'>
          <div className='text-3xl font-bold text-primary'>{quantity}</div>
          <div className='text-xs text-muted-foreground'>
            {quantity === 1 ? 'equipo' : 'equipos'}
          </div>
        </div>
      </div>

      {error && (
        <Alert variant='destructive'>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ── SECCIÓN 1: Cantidad y Códigos ─────────────────────────────────── */}
      <div className='rounded-lg border bg-card p-5 space-y-4'>
        <div>
          <h3 className='font-semibold mb-1'>Cantidad y Códigos</h3>
          <p className='text-xs text-muted-foreground'>
            Define cuántas unidades crear y cómo generar sus códigos
          </p>
        </div>
        <div className='grid grid-cols-2 gap-4'>
          <div className='space-y-1.5'>
            <Label htmlFor='quantity'>
              Cantidad <span className='text-destructive'>*</span>
            </Label>
            <Input
              id='quantity'
              type='number'
              min={1}
              max={100}
              {...register('quantity', { valueAsNumber: true })}
            />
            {errors.quantity && (
              <p className='text-xs text-destructive'>{errors.quantity.message}</p>
            )}
          </div>
          <div className='space-y-1.5'>
            <Label>
              Modo de códigos <span className='text-destructive'>*</span>
            </Label>
            <RadioGroup
              value={codeMode}
              onValueChange={v => setValue('codeMode', v as 'auto' | 'manual')}
              className='flex gap-4 pt-2'
            >
              <div className='flex items-center space-x-2'>
                <RadioGroupItem value='auto' id='auto' />
                <Label htmlFor='auto' className='font-normal cursor-pointer text-sm'>
                  Auto
                </Label>
              </div>
              <div className='flex items-center space-x-2'>
                <RadioGroupItem value='manual' id='manual' />
                <Label htmlFor='manual' className='font-normal cursor-pointer text-sm'>
                  Manual
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>
        {codeMode === 'manual' && (
          <div className='space-y-1.5'>
            <Label htmlFor='manualCodes'>
              Códigos (uno por línea) <span className='text-destructive'>*</span>
            </Label>
            <Textarea
              id='manualCodes'
              placeholder={'LAP-001\nLAP-002\nLAP-003'}
              rows={Math.min(quantity, 8)}
              {...register('manualCodes')}
              className='font-mono text-sm'
            />
            <div className='flex items-center justify-between text-xs'>
              <span className={manualCodesValid ? 'text-muted-foreground' : 'text-destructive'}>
                {manualCodesCount} de {quantity} códigos
              </span>
              {!manualCodesValid && (
                <span className='text-destructive'>Faltan {quantity - manualCodesCount}</span>
              )}
            </div>
          </div>
        )}
        <div className='space-y-1.5'>
          <Label htmlFor='serialNumbers'>Números de serie (opcional, uno por línea)</Label>
          <Textarea
            id='serialNumbers'
            placeholder={'SN123456\nSN789012'}
            rows={Math.min(quantity, 6)}
            {...register('serialNumbers')}
            className='font-mono text-sm'
          />
          <div className='flex items-center justify-between text-xs'>
            <span className={serialNumbersValid ? 'text-muted-foreground' : 'text-destructive'}>
              {serialNumbersCount} números de serie
            </span>
            {!serialNumbersValid && (
              <span className='text-destructive'>
                Debe ser 0 o {quantity} (tienes {serialNumbersCount})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── SECCIÓN 2: Datos Comunes del Equipo ───────────────────────────── */}
      <div className='rounded-lg border bg-card p-5 space-y-5'>
        <div>
          <h3 className='font-semibold mb-1'>Datos Comunes del Equipo</h3>
          <p className='text-xs text-muted-foreground'>
            Información compartida por todas las unidades del lote
          </p>
        </div>

        {/* Selector de modelo del catálogo */}
        <div className='space-y-1.5'>
          <Label>
            Modelo del catálogo <span className='text-destructive'>*</span>
          </Label>
          <ModelSelector
            value={selectedModelId}
            familyId={selectedFamilyId ?? undefined}
            onValueChange={(modelId, model) => {
              setSelectedModelId(modelId)
              setSelectedModelData(model)
              if (model) {
                const brand =
                  typeof model.brand === 'string' ? model.brand : ((model as any).brand?.name ?? '')
                setValue('brand', brand)
                setValue('model', model.model)
                setValue('typeId', model.type.id, { shouldValidate: true })
                if (model.standardPrice && !purchasePrice) {
                  setPurchasePrice(String(model.standardPrice))
                }
              }
            }}
            placeholder='Buscar por marca, modelo o SKU...'
          />
          {!selectedModelId && (
            <p className='text-xs text-muted-foreground'>
              Busca el modelo en el catálogo. Si no existe, créalo primero en{' '}
              <a href='/inventory/models' className='text-primary hover:underline' target='_blank'>
                Modelos
              </a>
              .
            </p>
          )}
          {selectedModelData && (
            <div className='rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground'>
              <span className='font-medium text-foreground'>
                {selectedModelData.brand} {selectedModelData.model}
              </span>
              {selectedModelData.type && (
                <span className='ml-2'>· {selectedModelData.type.name}</span>
              )}
              {selectedModelData.sku && (
                <span className='ml-2'>· SKU: {selectedModelData.sku}</span>
              )}
            </div>
          )}
        </div>

        {/* Atributos dinámicos por tipo — se activan al seleccionar modelo */}
        {(selectedModelData?.type?.id || selectedTypeId) && (
          <div className='space-y-2'>
            <Label className='text-sm font-medium'>Atributos del Tipo</Label>
            <TypeAttributesInput
              typeId={selectedModelData?.type?.id || selectedTypeId}
              assetType='equipment'
              values={customFieldValues}
              onChange={setCustomFieldValues}
            />
          </div>
        )}

        {/* Stock indicator */}
        {selectedModelId && selectedModelData && (
          <StockIndicatorBadge
            brand={selectedModelData.brand}
            model={selectedModelData.model}
            typeId={selectedModelData.type?.id || selectedTypeId || ''}
          />
        )}

        {/* Departamento — filtrado por familia */}
        <div className='space-y-1.5'>
          <Label>
            Departamento <span className='text-destructive'>*</span>
          </Label>
          <SearchableSelect
            options={filteredDepartments.map(
              (d): SearchableSelectOption => ({ id: d.id, name: d.name })
            )}
            value={selectedDepartmentId || ''}
            onChange={v => setValue('departmentId', v, { shouldValidate: true })}
            placeholder={
              filteredDepartments.length === 0
                ? 'No hay departamentos para esta familia'
                : 'Buscar departamento...'
            }
          />
          {errors.departmentId && (
            <p className='text-xs text-destructive'>{errors.departmentId.message}</p>
          )}
        </div>

        {/* Condición + Bodega */}
        <div className='grid grid-cols-2 gap-4'>
          <div className='space-y-1.5'>
            <Label>
              Condición <span className='text-destructive'>*</span>
            </Label>
            <SimpleSelect
              value={watch('condition')}
              onChange={e => setValue('condition', e.target.value as any)}
            >
              <option value='NEW'>Nuevo</option>
              <option value='USED'>Usado</option>
              <option value='DAMAGED'>Dañado</option>
            </SimpleSelect>
          </div>
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
                createForm={({ onSuccess: onWS, onCancel: onWC }) => (
                  <WarehouseInlineForm
                    defaultFamilyId={selectedFamilyId ?? undefined}
                    onSuccess={item => {
                      setWarehouses(prev => [...prev, item])
                      onWS(item)
                    }}
                    onCancel={onWC}
                  />
                )}
              />
            </div>
          )}
        </div>

        {/* Accesorios comunes */}
        <AccessoriesSection accessories={accessories} onChange={setAccessories} inline />
      </div>

      {/* ── SECCIÓN 3: Adquisición ────────────────────────────────────────── */}
      <div className='rounded-lg border bg-card p-5 space-y-4'>
        <div>
          <h3 className='font-semibold mb-1'>Adquisición</h3>
          <p className='text-xs text-muted-foreground'>
            Modalidad, proveedor e información de compra del lote
          </p>
        </div>

        {/* Modalidad */}
        <div className='space-y-1.5'>
          <Label>¿Cómo se adquirió este lote?</Label>
          <SimpleSelect
            value={acquisitionMode}
            onChange={e => setAcquisitionMode(e.target.value as AcquisitionMode)}
            options={ACQUISITION_MODES}
          />
          <p className='text-xs text-muted-foreground'>
            {ACQUISITION_MODES.find(m => m.value === acquisitionMode)?.help}
          </p>
        </div>

        {/* Proveedor */}
        <div className='space-y-1.5'>
          <Label>
            {acquisitionMode === 'RENTAL'
              ? 'Proveedor del Arrendamiento'
              : acquisitionMode === 'LOAN'
                ? 'Propietario del Bien'
                : 'Proveedor'}
            {(acquisitionMode === 'RENTAL' || acquisitionMode === 'LOAN') && (
              <span className='text-destructive ml-1'>*</span>
            )}
          </Label>
          <SupplierSelect
            value={supplierId || null}
            onChange={v => setSupplierId(v || '')}
            familyId={selectedFamilyId ?? undefined}
          />
        </div>

        {isVisible('CONTRACT') && acquisitionMode === 'RENTAL' && (
          <div className='rounded-md border border-border p-4 space-y-3'>
            <p className='text-sm font-medium'>
              Contrato de arrendamiento
              {isRequired('CONTRACT') && <span className='text-destructive'> *</span>}
            </p>
            <ContractPicker
              value={linkedContractId}
              onChange={setLinkedContractId}
              supplierId={supplierId || null}
              familyId={selectedFamilyId ?? undefined}
            />
          </div>
        )}

        {/* Financiero */}
        {showFinancial && (
          <fieldset className='rounded-lg border border-border p-4 space-y-3'>
            <legend className='px-2 text-sm font-semibold'>
              Información Financiera
              {financialRequired && <span className='text-destructive'> *</span>}
            </legend>
            <div className='grid grid-cols-2 gap-3'>
              <div className='space-y-1'>
                <Label>
                  Precio Unitario
                  {financialRequired && <span className='text-destructive'> *</span>}
                </Label>
                <Input
                  type='number'
                  min='0'
                  step='0.01'
                  value={purchasePrice}
                  onChange={e => setPurchasePrice(e.target.value)}
                  placeholder='Precio sin impuestos'
                />
              </div>
              <div className='space-y-1'>
                <Label>Fecha de Compra</Label>
                <Input
                  type='date'
                  value={purchaseDate}
                  onChange={e => setPurchaseDate(e.target.value)}
                />
              </div>
              <div className='space-y-1'>
                <Label>N° de Factura</Label>
                <Input
                  value={invoiceNumber}
                  onChange={e => setInvoiceNumber(e.target.value)}
                  placeholder='FAC-2024-0123'
                />
              </div>
              <div className='space-y-1'>
                <Label>Orden de Compra</Label>
                <Input
                  value={purchaseOrderNumber}
                  onChange={e => setPurchaseOrderNumber(e.target.value)}
                  placeholder='OC-2024-0456'
                />
              </div>
            </div>
            {purchasePrice && quantity > 1 && (
              <p className='text-xs text-muted-foreground'>
                Total del lote:{' '}
                <strong>${(parseFloat(purchasePrice) * quantity).toFixed(2)}</strong> ({quantity} ×
                ${parseFloat(purchasePrice).toFixed(2)})
              </p>
            )}
          </fieldset>
        )}
      </div>

      {/* ── SECCIÓN 4: Depreciación ───────────────────────────────────────── */}
      {showDepreciation && (
        <div className='rounded-lg border bg-card p-5 space-y-4'>
          <div>
            <h3 className='font-semibold mb-1'>
              Depreciación
              {isRequired('DEPRECIATION') && <span className='text-destructive'> *</span>}
            </h3>
            <p className='text-xs text-muted-foreground'>
              Aplica a todos los equipos del lote por igual
            </p>
          </div>
          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1 col-span-2'>
              <Label>Método de Depreciación</Label>
              <SimpleSelect
                value={depreciationMethod}
                onChange={e => setDepreciationMethod(e.target.value)}
                options={DEPRECIATION_METHODS}
              />
              {DEP_HELP[depreciationMethod] && (
                <p className='text-xs text-muted-foreground'>{DEP_HELP[depreciationMethod]}</p>
              )}
            </div>
            <div className='space-y-1'>
              <Label>Vida Útil (años)</Label>
              <Input
                type='number'
                min='1'
                value={usefulLifeYears}
                onChange={e => setUsefulLifeYears(e.target.value)}
              />
              <p className='text-xs text-muted-foreground'>
                Ej: laptops 3-5 años, servidores 5-7 años.
              </p>
            </div>
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
            {depreciationMethod === 'UNITS_OF_PRODUCTION' && (
              <>
                <div className='space-y-1 col-span-2'>
                  <Label>Unidad de medida</Label>
                  <div className='flex gap-2 flex-wrap'>
                    {['horas', 'km', 'ciclos'].map(u => (
                      <button
                        key={u}
                        type='button'
                        onClick={() => setUnitLabel(u)}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${unitLabel === u ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted border-border hover:border-primary/50'}`}
                      >
                        {u}
                      </button>
                    ))}
                    <Input
                      value={['horas', 'km', 'ciclos'].includes(unitLabel) ? '' : unitLabel}
                      onChange={e => setUnitLabel(e.target.value || 'horas')}
                      placeholder='Otra...'
                      className='h-7 text-xs flex-1 min-w-24'
                    />
                  </div>
                </div>
                <div className='space-y-1'>
                  <Label>
                    Capacidad total ({unitLabel}) <span className='text-destructive'>*</span>
                  </Label>
                  <Input
                    type='number'
                    min='1'
                    value={totalUnits}
                    onChange={e => setTotalUnits(e.target.value)}
                    placeholder={`Ej: 10000 ${unitLabel}`}
                  />
                </div>
                <div className='space-y-1'>
                  <Label>
                    {unitLabel.charAt(0).toUpperCase() + unitLabel.slice(1)} ya utilizados
                  </Label>
                  <Input
                    type='number'
                    min='0'
                    value={usedUnits}
                    onChange={e => setUsedUnits(e.target.value)}
                    placeholder='0 si es nuevo'
                  />
                </div>
              </>
            )}
          </div>
          {depreciationPreview && depreciationPreview.length > 0 && (
            <div className='rounded-md border border-border bg-muted/30'>
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
                  <p className='text-xs text-muted-foreground'>Valor libro estimado por equipo:</p>
                  <div className='grid grid-cols-3 gap-2'>
                    {depreciationPreview.map(({ year, bookValue }) => (
                      <div
                        key={year}
                        className='rounded-md bg-background border border-border p-2 text-center'
                      >
                        <p className='text-xs text-muted-foreground'>Año {year}</p>
                        <p className='text-sm font-semibold'>
                          ${bookValue.toLocaleString('es-CL', { maximumFractionDigits: 0 })}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isVisible('DEPRECIATION') && acquisitionMode !== 'FIXED_ASSET' && (
        <div className='rounded-md border border-border bg-muted/40 px-4 py-3'>
          <p className='text-sm font-medium'>Sin depreciación</p>
          <p className='text-xs text-muted-foreground mt-1'>
            {acquisitionMode === 'RENTAL'
              ? 'Los equipos arrendados no se deprecian — el proveedor es el propietario.'
              : 'Los activos de tercero no se deprecian — el propietario original conserva la titularidad.'}
          </p>
        </div>
      )}

      {/* ── Botones ───────────────────────────────────────────────────────── */}
      <div className='flex gap-3 pt-2'>
        {onCancel && (
          <Button type='button' variant='outline' onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
        )}
        <Button
          type='submit'
          disabled={
            isSubmitting ||
            !manualCodesValid ||
            !serialNumbersValid ||
            !selectedModelId ||
            !selectedDepartmentId
          }
          className='flex-1'
        >
          {isSubmitting ? (
            <>
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              Creando {quantity} {quantity === 1 ? 'equipo' : 'equipos'}...
            </>
          ) : (
            <>
              <Package className='mr-2 h-4 w-4' />
              Crear {quantity} {quantity === 1 ? 'equipo' : 'equipos'}
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
