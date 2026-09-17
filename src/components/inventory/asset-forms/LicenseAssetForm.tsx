'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select'
import { InlineCreateSelect } from '@/components/ui/inline-create-select'
import { SimpleSelect } from '@/components/ui/simple-select'
import { FileUploadZone } from '@/components/ui/file-upload-zone'
import { ContractPicker } from '@/components/contracts/contract-picker'
import {
  formatContractAmount,
  resolveLicenseFinancialFromContract,
} from '@/lib/contracts/license-financial-from-contract'
import type { Contract } from '@/types/contracts'
import { SupplierSelect } from '@/components/inventory/suppliers/SupplierSelect'
import { CatalogTypeInlineForm } from '@/components/inventory/asset-forms/CatalogTypeInlineForm'
import { inlineSelectFeedback } from '@/lib/utils/inline-select-feedback'
import { isDirectFormSubmit } from '@/lib/utils/inline-form-guard'
import { TypeAttributesInput } from '@/components/inventory/custom-fields/type-attributes-input'
import { AttributeManagerDialog } from '@/components/settings/inventory/attribute-manager-dialog'
import type { InlineSelectOption } from '@/components/ui/inline-create-select'
import type { FamilyConfig } from '@/lib/inventory/family-config-types'
import { useFetch } from '@/hooks/common/use-fetch'
import { useActiveDepartments } from '@/contexts/departments-context'
import {
  FormDraftKeys,
  clearFormDraft,
  peekFormDraft,
  useFormDraft,
} from '@/hooks/common/use-form-draft'
import { FormDraftBanner } from '@/components/common/form-draft-banner'
import { toLocalDateInputValue } from '@/lib/forms/form-date'
import { parseMoneyInput } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { AssignableUserSelect } from '@/components/inventory/shared/AssignableUserSelect'
import { FinancialInfoSection } from '@/components/inventory/shared/FinancialInfoSection'
import {
  LICENSE_ACQUISITION_TYPE_OPTIONS,
  LICENSE_ACQUISITION_TYPE_LABELS,
  LICENSE_RENEWAL_FREQUENCY_OPTIONS,
  CONTRACT_CATEGORY_TO_ACQUISITION_TYPE,
  addRenewalInterval,
} from '@/lib/inventory/license-labels'
import { KeyRound, RefreshCw } from 'lucide-react'

interface LicenseAssetFormProps {
  familyId: string
  familyConfig: FamilyConfig
  onSubmit: (payload: Record<string, unknown>) => void
  onBack: () => void
  submitting: boolean
  submitError: string | null
  maxFileSizeMB?: number
  isEditMode?: boolean
  initialLicense?: Record<string, unknown>
  licenseId?: string
}

type Scope = 'Individual' | 'Departamento' | 'Empresa'

type LicenseDraft = {
  name: string
  licenseTypeId: string
  // licenseKey NO se guarda en borrador (secreto)
  scope: Scope
  userId: string
  departmentId: string
  supplierId: string
  purchaseDate: string
  expirationDate: string
  cost: string
  invoiceNumber: string
  purchaseOrderNumber: string
  renewalCost: string
  renewalFrequency: string
  customFrequencyMonths: string
  hasRecurring: boolean
  linkedContractId: string | null
  notes: string
  customFieldValues: Array<{ fieldName: string; fieldValue: string }>
  acquisitionType: string
}

/** Borrador útil (evita que un draft solo con scope=Empresa vacíe el editar). */
function isUsefulLicenseDraft(d: Partial<LicenseDraft> | null | undefined): boolean {
  if (!d) return false
  return Boolean(
    (typeof d.name === 'string' && d.name.trim()) ||
    (typeof d.licenseTypeId === 'string' && d.licenseTypeId.trim()) ||
    (typeof d.purchaseDate === 'string' && d.purchaseDate.trim()) ||
    (typeof d.notes === 'string' && d.notes.trim()) ||
    (typeof d.userId === 'string' && d.userId.trim()) ||
    (typeof d.departmentId === 'string' && d.departmentId.trim())
  )
}

const SCOPE_FROM_API: Record<string, Scope> = {
  INDIVIDUAL: 'Individual',
  DEPARTMENT: 'Departamento',
  COMPANY: 'Empresa',
  Individual: 'Individual',
  Departamento: 'Departamento',
  Empresa: 'Empresa',
}

function LicenseTypeAttributesSection({
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
  if (!typeId) return null
  return (
    <div className='space-y-2'>
      <Label>Atributos del Tipo</Label>
      <TypeAttributesInput
        typeId={typeId}
        assetType='license'
        values={values}
        onChange={onChange}
        reloadToken={reloadToken}
      />
    </div>
  )
}

export function LicenseAssetForm({
  familyId,
  familyConfig,
  onSubmit,
  onBack,
  submitting,
  submitError,
  maxFileSizeMB = 10,
  isEditMode = false,
  initialLicense,
  licenseId,
}: LicenseAssetFormProps) {
  const { toast } = useToast()
  const { data: session } = useSession()
  const isSuperAdmin = (session?.user as { isSuperAdmin?: boolean })?.isSuperAdmin === true
  const hasCredentials =
    isSuperAdmin || (session?.user as { credentialsEnabled?: boolean })?.credentialsEnabled === true

  const [name, setName] = useState('')
  const [licenseTypeId, setLicenseTypeId] = useState('')
  const [licenseTypes, setLicenseTypes] = useState<{ id: string; name: string }[]>([])
  const [customFieldValues, setCustomFieldValues] = useState<
    Array<{ fieldName: string; fieldValue: string }>
  >([])
  // Gestor de atributos del tipo, encadenado desde el mismo selector (crear/editar tipo)
  const [manageAttributesFor, setManageAttributesFor] = useState<InlineSelectOption | null>(null)
  const [manageAttributesAutoCreate, setManageAttributesAutoCreate] = useState(false)
  const [attributesReloadToken, setAttributesReloadToken] = useState(0)
  const [licenseKey, setLicenseKey] = useState('')
  const [scope, setScope] = useState<Scope>('Empresa')
  /** Cantidad > 1 crea un lote (N licencias idénticas, sin asignar) en vez de
   * una sola — mismo formulario, ver isBatchMode más abajo. */
  const [quantity, setQuantity] = useState('1')
  const [userId, setUserId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  /** En edición: no guardar borrador hasta hidratar desde el servidor */
  const [hydrated, setHydrated] = useState(!isEditMode)

  const { departments: rawDepartments } = useActiveDepartments()
  const departments: SearchableSelectOption[] = useMemo(
    () => rawDepartments.map(d => ({ id: d.id, name: d.name })),
    [rawDepartments]
  )
  const [supplierId, setSupplierId] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [cost, setCost] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState('')
  const [renewalCost, setRenewalCost] = useState('')
  const [renewalFrequency, setRenewalFrequency] = useState('')
  const [customFrequencyMonths, setCustomFrequencyMonths] = useState('')
  /** "Fecha de próxima renovación" ya no se pide aparte — para una licencia sin
   * contrato, vencimiento y próxima renovación son el mismo momento. Este flag
   * evita que el auto-cálculo de vencimiento (a partir de fecha de compra +
   * frecuencia) pise una fecha que el usuario ya editó a mano. */
  const [expirationDateTouched, setExpirationDateTouched] = useState(isEditMode)
  const [acquisitionType, setAcquisitionType] = useState('')
  const [hasRecurring, setHasRecurring] = useState(false)
  const [linkedContractId, setLinkedContractId] = useState<string | null>(null)
  /** Costo de renta capturado al vincular a un contrato YA EXISTENTE — ver el equivalente
   * en EquipmentAssetForm. */
  const [linkCost, setLinkCost] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])

  const isVisible = (section: string) => familyConfig.visibleSections.includes(section as never)
  const isRequired = (section: string) => familyConfig.requiredSections.includes(section as never)
  const isBatchMode = !isEditMode && (parseInt(quantity, 10) || 1) > 1

  const draftKey =
    isEditMode && licenseId
      ? FormDraftKeys.licenseEdit(licenseId)
      : FormDraftKeys.licenseNew(familyId)

  const draftValues: LicenseDraft = useMemo(
    () => ({
      name,
      licenseTypeId,
      scope,
      userId,
      departmentId,
      supplierId,
      purchaseDate,
      expirationDate,
      cost,
      invoiceNumber,
      purchaseOrderNumber,
      renewalCost,
      renewalFrequency,
      customFrequencyMonths,
      hasRecurring,
      linkedContractId,
      notes,
      customFieldValues,
      acquisitionType,
    }),
    [
      name,
      licenseTypeId,
      scope,
      userId,
      departmentId,
      supplierId,
      purchaseDate,
      expirationDate,
      cost,
      invoiceNumber,
      purchaseOrderNumber,
      renewalCost,
      renewalFrequency,
      customFrequencyMonths,
      hasRecurring,
      linkedContractId,
      notes,
      customFieldValues,
      acquisitionType,
    ]
  )

  const applyDraft = (d: LicenseDraft) => {
    if (d.name != null) setName(String(d.name))
    if (d.licenseTypeId != null) setLicenseTypeId(String(d.licenseTypeId))
    if (d.scope) setScope(d.scope)
    if (d.userId != null) setUserId(String(d.userId))
    if (d.departmentId != null) setDepartmentId(String(d.departmentId))
    if (d.supplierId != null) setSupplierId(String(d.supplierId))
    if (d.purchaseDate != null) setPurchaseDate(String(d.purchaseDate))
    if (d.expirationDate != null) {
      setExpirationDate(String(d.expirationDate))
      setExpirationDateTouched(true)
    }
    if (d.cost != null) setCost(String(d.cost))
    if (d.invoiceNumber != null) setInvoiceNumber(String(d.invoiceNumber))
    if (d.purchaseOrderNumber != null) setPurchaseOrderNumber(String(d.purchaseOrderNumber))
    if (d.renewalCost != null) setRenewalCost(String(d.renewalCost))
    if (d.renewalFrequency != null) setRenewalFrequency(String(d.renewalFrequency))
    if (d.customFrequencyMonths != null) setCustomFrequencyMonths(String(d.customFrequencyMonths))
    if (typeof d.hasRecurring === 'boolean') setHasRecurring(d.hasRecurring)
    if (d.linkedContractId !== undefined) setLinkedContractId(d.linkedContractId)
    if (d.notes != null) setNotes(String(d.notes))
    if (d.acquisitionType != null) setAcquisitionType(String(d.acquisitionType))
    if (Array.isArray(d.customFieldValues)) setCustomFieldValues(d.customFieldValues)
  }

  const { clearDraft, wasRestored, dismissRestoredBanner } = useFormDraft({
    key: draftKey,
    values: draftValues,
    enabled: !submitting && hydrated,
    onRestore: applyDraft,
  })

  const prevSubmitting = useRef(false)
  useEffect(() => {
    if (prevSubmitting.current && !submitting && !submitError) {
      clearDraft()
    }
    prevSubmitting.current = submitting
  }, [submitting, submitError, clearDraft])

  useEffect(() => {
    fetch(`/api/inventory/license-types?familyId=${familyId}`)
      .then(r => r.json())
      .then(d => setLicenseTypes(d.types ?? d ?? []))
      .catch(() => {})
  }, [familyId])

  useEffect(() => {
    if (!isEditMode) {
      setHydrated(true)
      return
    }
    if (!initialLicense) return

    const draft = peekFormDraft<LicenseDraft>(draftKey)
    if (isUsefulLicenseDraft(draft)) {
      // useFormDraft restaurará el borrador al habilitar hydrated
      setHydrated(true)
      return
    }

    // Draft vacío/basura: cargar servidor y limpiar sessionStorage
    clearFormDraft(draftKey)

    setName(String(initialLicense.name ?? ''))
    const typeId =
      (initialLicense.licenseType as { id?: string })?.id ??
      (initialLicense.typeId as string | undefined) ??
      ''
    setLicenseTypeId(typeId)
    setLicenseKey(
      initialLicense.key && initialLicense.key !== '••••••••' ? String(initialLicense.key) : ''
    )
    const scopeValue = initialLicense.licenseScope ?? initialLicense.scope
    setScope(SCOPE_FROM_API[String(scopeValue)] ?? 'Empresa')
    const assignedUser =
      (initialLicense.assignedToUser as string | undefined) ??
      (initialLicense.user as { id?: string } | undefined)?.id ??
      ''
    setUserId(String(assignedUser))
    const assignedDept =
      (initialLicense.assignedToDepartment as string | undefined) ??
      (initialLicense.department as { id?: string } | undefined)?.id ??
      ''
    setDepartmentId(String(assignedDept))
    setSupplierId(
      String((initialLicense.supplier as { id?: string })?.id ?? initialLicense.supplierId ?? '')
    )
    setPurchaseDate(toLocalDateInputValue(initialLicense.purchaseDate))
    setExpirationDate(toLocalDateInputValue(initialLicense.expirationDate))
    setCost(initialLicense.cost != null ? String(initialLicense.cost) : '')
    setInvoiceNumber(String(initialLicense.invoiceNumber ?? ''))
    setPurchaseOrderNumber(String(initialLicense.purchaseOrderNumber ?? ''))
    setRenewalCost(initialLicense.renewalCost != null ? String(initialLicense.renewalCost) : '')
    setRenewalFrequency(String(initialLicense.renewalFrequency ?? ''))
    setCustomFrequencyMonths(
      initialLicense.customFrequencyMonths != null
        ? String(initialLicense.customFrequencyMonths)
        : ''
    )
    setHasRecurring(
      initialLicense.renewalCost != null ||
        initialLicense.renewalDate != null ||
        initialLicense.acquisitionType === 'SOFTWARE'
    )
    setLinkedContractId((initialLicense.linkedContractId as string | null) ?? null)
    setAcquisitionType(String(initialLicense.acquisitionType ?? ''))
    setNotes(String(initialLicense.notes ?? ''))
    setCustomFieldValues(
      (initialLicense.customValues as Array<{ fieldName: string; fieldValue: string }>) ?? []
    )
    setHydrated(true)
  }, [isEditMode, initialLicense, draftKey])

  const { data: linkedContracts } = useFetch<Contract>(
    linkedContractId ? `/api/inventory/contracts/${linkedContractId}` : '/api/inventory/contracts',
    {
      enabled: !!linkedContractId,
      transform: d => (d.id ? [d] : []),
      showErrorToast: false,
    }
  )
  const linkedContract = linkedContracts[0] ?? null

  const contractFinancial = useMemo(
    () =>
      linkedContract ? resolveLicenseFinancialFromContract(linkedContract, hasRecurring) : null,
    [linkedContract, hasRecurring]
  )

  const contractPrefill = useMemo(
    () => ({
      name: name.trim() || undefined,
      supplierId: supplierId || null,
      familyId,
      startDate: purchaseDate || undefined,
      endDate: expirationDate || undefined,
      cost: cost || renewalCost || undefined,
      monthlyCost: hasRecurring ? renewalCost || cost : undefined,
      totalValue: !hasRecurring ? cost : undefined,
      hasRecurring,
      suggestedLineDescription: name.trim() || undefined,
      category: 'SOFTWARE_LICENSE' as const,
    }),
    [name, supplierId, familyId, purchaseDate, expirationDate, cost, renewalCost, hasRecurring]
  )

  useEffect(() => {
    if (!linkedContract || !contractFinancial) {
      if (!linkedContractId) setRenewalCost('')
      return
    }

    if (hasRecurring) {
      setRenewalCost(
        contractFinancial.renewalCost != null ? String(contractFinancial.renewalCost) : ''
      )
      // La fecha de vencimiento del contrato ES la próxima renovación — un
      // solo campo, sin pedirlo dos veces (ver expirationDateTouched).
      if (contractFinancial.expirationDate) {
        setExpirationDate(contractFinancial.expirationDate)
        setExpirationDateTouched(true)
      }
    } else {
      setRenewalCost('')
      if (contractFinancial.cost != null) setCost(String(contractFinancial.cost))
      if (contractFinancial.expirationDate) {
        setExpirationDate(contractFinancial.expirationDate)
        setExpirationDateTouched(true)
      }
    }
  }, [linkedContract, linkedContractId, contractFinancial, hasRecurring])

  // Auto-completa la fecha de vencimiento a partir de fecha de compra +
  // frecuencia de renovación — solo mientras el usuario no la haya editado a
  // mano (ver expirationDateTouched) y solo sin contrato vinculado (con
  // contrato, la fecha viene de arriba). Vaciar el campo reactiva el cálculo.
  useEffect(() => {
    if (expirationDateTouched || linkedContract || !purchaseDate || !renewalFrequency) return
    const computed = addRenewalInterval(purchaseDate, renewalFrequency, customFrequencyMonths)
    if (computed) setExpirationDate(computed)
  }, [expirationDateTouched, linkedContract, purchaseDate, renewalFrequency, customFrequencyMonths])

  // Al vincular un contrato, su categoría manda sobre la "Modalidad de
  // adquisición" de la licencia (ver applyContractLinkSideEffects, que hace lo
  // mismo del lado del servidor) — evita que ambos campos puedan decir cosas
  // distintas para el mismo vínculo.
  useEffect(() => {
    if (!linkedContract) return
    const derived = CONTRACT_CATEGORY_TO_ACQUISITION_TYPE[linkedContract.category]
    if (derived) setAcquisitionType(derived)
  }, [linkedContract])

  const handleContractChange = (contractId: string | null) => {
    setLinkedContractId(contractId)
    if (!contractId) setRenewalCost('')
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!isDirectFormSubmit(e)) return

    if (!name.trim()) {
      toast({ title: 'El nombre es obligatorio', variant: 'destructive' })
      return
    }
    if (!licenseTypeId) {
      toast({ title: 'Selecciona el tipo de licencia', variant: 'destructive' })
      return
    }
    // En alta: asignación obligatoria. En edición se puede completar luego con «Asignar».
    // En modo lote no aplica: las N licencias nacen sin asignar y se reparten
    // después, una por una, con el mismo botón «Asignar» de siempre.
    if (!isEditMode && !isBatchMode && scope === 'Individual' && !userId) {
      toast({ title: 'Selecciona el usuario asignado', variant: 'destructive' })
      return
    }
    if (!isEditMode && !isBatchMode && scope === 'Departamento' && !departmentId) {
      toast({ title: 'Selecciona el departamento asignado', variant: 'destructive' })
      return
    }
    if (isRequired('FINANCIAL') && !purchaseDate) {
      toast({ title: 'La fecha de compra es obligatoria', variant: 'destructive' })
      return
    }
    if (purchaseDate && expirationDate && expirationDate < purchaseDate) {
      toast({
        title: 'Fechas inválidas',
        description: 'El vencimiento no puede ser anterior a la compra.',
        variant: 'destructive',
      })
      return
    }

    const parsedCost = parseMoneyInput(cost)
    const parsedRenewal = parseMoneyInput(renewalCost)

    const payload: Record<string, unknown> = {
      name: name.trim(),
      quantity: isBatchMode ? parseInt(quantity, 10) || 1 : undefined,
      licenseTypeId: licenseTypeId || undefined,
      typeId: licenseTypeId || undefined,
      key: licenseKey || undefined,
      scope,
      supplierId: supplierId || undefined,
      purchaseDate: purchaseDate || undefined,
      expirationDate: expirationDate || undefined,
      cost: parsedCost,
      invoiceNumber: invoiceNumber || undefined,
      purchaseOrderNumber: purchaseOrderNumber || undefined,
      renewalCost: parsedRenewal,
      // "Próxima renovación" ya no se pide aparte — es la misma fecha de
      // vencimiento (ver expirationDateTouched más arriba).
      renewalDate: expirationDate || undefined,
      renewalFrequency: linkedContractId || hasRecurring ? null : renewalFrequency || null,
      customFrequencyMonths:
        !linkedContractId && !hasRecurring && renewalFrequency === 'CUSTOM' && customFrequencyMonths
          ? parseInt(customFrequencyMonths, 10)
          : null,
      acquisitionType: acquisitionType || null,
      contractId: linkedContractId || undefined,
      contractLineCost: linkCost ?? undefined,
      notes: notes || undefined,
      customValues: customFieldValues.length ? customFieldValues : undefined,
      // Los adjuntos se suben por endpoint aparte; no van en el PUT de licencia
    }

    // El responsable solo se fija aquí al CREAR. Cambiarlo después de creada la licencia
    // pasa exclusivamente por el diálogo "Asignar" (deja historial + acta de entrega) —
    // este formulario de edición ya no reescribe el asignatario para no tener dos caminos
    // silenciosos hacia el mismo dato (ver LicenseAssignDialog / license-assignment.service).
    if (!isEditMode && !isBatchMode) {
      if (scope === 'Individual' && userId) {
        payload.assignedToUser = userId
        payload.assignedToDepartment = null
        payload.assignedToEquipment = null
      } else if (scope === 'Departamento' && departmentId) {
        payload.assignedToDepartment = departmentId
        payload.assignedToUser = null
        payload.assignedToEquipment = null
      } else if (scope === 'Empresa') {
        payload.assignedToUser = null
        payload.assignedToDepartment = null
        payload.assignedToEquipment = null
      }
    }

    onSubmit(payload)
  }

  const handleDiscardDraft = () => {
    clearDraft()
    dismissRestoredBanner()
    if (isEditMode && initialLicense) {
      // Recargar desde servidor
      setName(String(initialLicense.name ?? ''))
      // ... simplified: reload page fields via effect by forcing - just clear banner
    } else {
      setName('')
      setLicenseTypeId('')
      setLicenseKey('')
      setScope('Empresa')
      setUserId('')
      setDepartmentId('')
      setSupplierId('')
      setPurchaseDate('')
      setExpirationDate('')
      setCost('')
      setInvoiceNumber('')
      setPurchaseOrderNumber('')
      setRenewalCost('')
      setExpirationDateTouched(false)
      setHasRecurring(false)
      setLinkedContractId(null)
      setNotes('')
      setCustomFieldValues([])
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className='space-y-5'>
        <FormDraftBanner
          visible={wasRestored}
          onDismiss={dismissRestoredBanner}
          onDiscard={handleDiscardDraft}
        />
        {hasCredentials && (
          <div className='rounded-lg border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground flex items-start gap-2'>
            <KeyRound className='h-3.5 w-3.5 shrink-0 mt-0.5' />
            <span>
              Contraseñas de acceso (portal del proveedor, admin del SaaS, VPN, etc.) no van en este
              formulario: tras crear la licencia, úsalas en la tarjeta{' '}
              <strong className='text-foreground'>Credenciales</strong> del detalle (bóveda con
              auditoría). La clave de producto / licencia sí se registra abajo en este formulario.
            </span>
          </div>
        )}

        <div className='grid grid-cols-1 md:grid-cols-3 gap-4 [&>*]:min-w-0'>
          <div className='space-y-1'>
            <Label>
              Nombre <span className='text-destructive'>*</span>
            </Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder='Ej: Microsoft Office 365'
            />
          </div>

          <div className='space-y-1'>
            <Label>
              Tipo de Licencia / Contrato <span className='text-destructive'>*</span>
            </Label>
            <InlineCreateSelect
              options={licenseTypes}
              value={licenseTypeId}
              onChange={setLicenseTypeId}
              placeholder='Buscar tipo...'
              createLabel='Crear tipo de licencia'
              createTitle='Nuevo tipo de licencia'
              {...inlineSelectFeedback('Tipo de licencia')}
              createForm={({ item, onSuccess, onCancel }) => (
                <CatalogTypeInlineForm
                  apiEndpoint='/api/inventory/license-types'
                  familyId={familyId}
                  item={item}
                  onSuccess={newItem => {
                    if (item) {
                      setLicenseTypes(prev => prev.map(t => (t.id === newItem.id ? newItem : t)))
                    } else {
                      setLicenseTypes(prev => [...prev, newItem])
                    }
                    onSuccess(newItem)
                  }}
                  onCancel={onCancel}
                />
              )}
              onCreated={item => {
                // Al crear un tipo de licencia nuevo, ir directo a definir sus atributos
                setManageAttributesFor(item)
                setManageAttributesAutoCreate(true)
              }}
              onManageAttributes={item => {
                setManageAttributesFor(item)
                setManageAttributesAutoCreate(false)
              }}
              manageAttributesTooltip='Gestionar atributos'
            />
          </div>

          <div className='space-y-1'>
            <Label>
              Clave de Licencia{' '}
              <span className='text-xs font-normal text-muted-foreground'>(opcional)</span>
            </Label>
            <Input
              value={licenseKey}
              onChange={e => setLicenseKey(e.target.value)}
              placeholder='Ej: XXXXX-XXXXX-XXXXX'
              type='text'
              autoComplete='off'
              spellCheck={false}
              className='font-mono'
            />
            <p className='text-xs text-muted-foreground pt-1'>
              Clave de producto o serial de la licencia.
            </p>
          </div>

          {!isEditMode && (
            <div className='space-y-1'>
              <Label>Cantidad</Label>
              <Input
                type='number'
                min={1}
                max={500}
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
              />
              <p className='text-xs text-muted-foreground pt-1'>
                {isBatchMode
                  ? `Se crearán ${parseInt(quantity, 10) || 1} licencias idénticas, sin asignar — asígnalas después una por una.`
                  : 'Más de 1 crea un lote (ej. "34 licencias de Microsoft 365") en vez de una sola licencia.'}
              </p>
            </div>
          )}
        </div>

        <LicenseTypeAttributesSection
          typeId={licenseTypeId}
          values={customFieldValues}
          onChange={setCustomFieldValues}
          reloadToken={attributesReloadToken}
        />

        <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
          {!isBatchMode && (
            <div className='space-y-1'>
              <Label>Alcance</Label>
              <SimpleSelect
                value={scope}
                onChange={e => setScope(e.target.value as Scope)}
                disabled={isEditMode}
              >
                <option value='Individual'>Individual</option>
                <option value='Departamento'>Departamento</option>
                <option value='Empresa'>Empresa</option>
              </SimpleSelect>
              {isEditMode && (
                <p className='text-xs text-muted-foreground'>
                  Para cambiar el responsable usa el botón «Asignar» en el detalle de la licencia.
                </p>
              )}
            </div>
          )}

          <div className='space-y-1'>
            <Label>
              Proveedor / Vendedor{' '}
              <span className='text-xs font-normal text-muted-foreground'>(opcional)</span>
            </Label>
            <SupplierSelect
              value={supplierId || null}
              onChange={v => setSupplierId(v || '')}
              familyId={familyId}
            />
          </div>

          <div className='space-y-1'>
            <Label>
              Modalidad de adquisición{' '}
              <span className='text-xs font-normal text-muted-foreground'>(opcional)</span>
            </Label>
            <SimpleSelect
              value={acquisitionType}
              onChange={e => setAcquisitionType(e.target.value)}
              disabled={!!linkedContract}
            >
              <option value=''>Sin especificar</option>
              {LICENSE_ACQUISITION_TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </SimpleSelect>
            <p className='text-xs text-muted-foreground'>
              {linkedContract
                ? `Viene de la categoría del contrato vinculado${acquisitionType ? `: ${LICENSE_ACQUISITION_TYPE_LABELS[acquisitionType] ?? acquisitionType}` : ''}.`
                : 'Es solo una clasificación de la licencia; no crea ni requiere un contrato formal. Para vincular un contrato real, usa la sección de abajo.'}
            </p>
          </div>

          {!linkedContractId && !hasRecurring && (
            <div className='space-y-1'>
              <Label>
                Frecuencia de renovación{' '}
                <span className='text-xs font-normal text-muted-foreground'>(opcional)</span>
              </Label>
              <SimpleSelect
                value={renewalFrequency}
                onChange={e => setRenewalFrequency(e.target.value)}
              >
                <option value=''>Sin especificar</option>
                {LICENSE_RENEWAL_FREQUENCY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </SimpleSelect>
              {renewalFrequency === 'CUSTOM' && (
                <div className='flex items-center gap-2 pt-1'>
                  <Input
                    type='number'
                    min={1}
                    value={customFrequencyMonths}
                    onChange={e => setCustomFrequencyMonths(e.target.value)}
                    placeholder='Ej. 24'
                    className='w-24'
                  />
                  <span className='text-xs text-muted-foreground'>meses entre cada renovación</span>
                </div>
              )}
              {renewalFrequency && (
                <p className='text-xs text-muted-foreground pt-1'>
                  Con fecha de compra, la fecha de vencimiento (más abajo, en Información
                  Financiera) se calcula sola según esta frecuencia — la podés editar si hace falta.
                </p>
              )}
            </div>
          )}

          {scope === 'Individual' && !isEditMode && !isBatchMode && (
            <div className='space-y-1 md:col-span-2'>
              <AssignableUserSelect
                familyId={familyId}
                value={userId}
                onChange={setUserId}
                label='Usuario asignado'
                required
              />
            </div>
          )}
          {scope === 'Departamento' && !isEditMode && !isBatchMode && (
            <div className='space-y-1'>
              <Label>
                Departamento Asignado <span className='text-destructive'>*</span>
              </Label>
              <SearchableSelect
                options={departments}
                value={departmentId}
                onChange={setDepartmentId}
                placeholder='Buscar departamento...'
              />
            </div>
          )}
        </div>

        {isVisible('CONTRACT') && (
          <div className='rounded-lg border border-border p-4 space-y-3'>
            <p className='text-xs text-muted-foreground'>
              El contrato es la fuente de verdad para costos y vigencia. Los campos financieros
              duplicados se ocultan al vincular. Use <strong>Completar</strong> para abrir el
              formulario completo sin salir.
            </p>
            <label className='flex items-center gap-3 cursor-pointer select-none'>
              <button
                type='button'
                role='switch'
                aria-checked={hasRecurring}
                onClick={() => setHasRecurring(v => !v)}
                className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${hasRecurring ? 'bg-primary' : 'bg-muted'}`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transition-transform ${hasRecurring ? 'translate-x-4' : 'translate-x-0'}`}
                />
              </button>
              <div>
                <span className='text-sm font-medium flex items-center gap-1.5'>
                  <RefreshCw className='h-3.5 w-3.5 text-muted-foreground' />
                  Tiene suscripción / pago recurrente
                </span>
                <p className='text-xs text-muted-foreground'>
                  Activa si el software se paga mensual o anualmente (SaaS, arrendamiento)
                </p>
              </div>
            </label>

            {hasRecurring ? (
              <>
                <p className='text-xs text-muted-foreground rounded-md bg-muted/40 px-3 py-2'>
                  {isBatchMode
                    ? 'Las licencias de este lote tienen pago recurrente. Vincula el contrato del módulo de Contratos — quedará una línea del contrato por cada licencia generada, para mantener trazabilidad financiera y operativa.'
                    : 'Esta licencia tiene pago recurrente. Vincula el contrato del módulo de Contratos para mantener trazabilidad financiera y operativa.'}
                </p>

                <div className='space-y-2'>
                  <Label>
                    Contrato vinculado{' '}
                    <span className='text-xs font-normal text-muted-foreground'>(opcional)</span>
                  </Label>
                  <ContractPicker
                    value={linkedContractId}
                    onChange={handleContractChange}
                    onLinkCost={setLinkCost}
                    supplierId={supplierId || null}
                    familyId={familyId}
                    context='license'
                    prefill={contractPrefill}
                    draftParentKey={draftKey}
                  />
                </div>
              </>
            ) : (
              <p className='text-xs text-muted-foreground rounded-md bg-muted/40 px-3 py-2'>
                Sin pago recurrente no hay contrato que vincular — seguí completando los datos de
                abajo (frecuencia de renovación, costo, fechas).
              </p>
            )}

            {hasRecurring &&
              (linkedContract && contractFinancial ? (
                <div className='rounded-md border bg-muted/30 px-3 py-2.5 space-y-1'>
                  <p className='text-xs text-muted-foreground'>{contractFinancial.amountLabel}</p>
                  <p className='text-sm font-medium font-mono'>
                    {formatContractAmount(
                      contractFinancial.displayAmount,
                      contractFinancial.currency
                    )}
                  </p>
                  <p className='text-[11px] text-muted-foreground'>
                    Tomado automáticamente del contrato vinculado. Se guardará como costo de
                    renovación.
                  </p>
                </div>
              ) : (
                <p className='text-xs text-muted-foreground rounded-md bg-muted/40 px-3 py-2'>
                  Vincula un contrato para cargar el costo automáticamente según el pago recurrente.
                </p>
              ))}
          </div>
        )}

        {isVisible('FINANCIAL') &&
          (() => {
            // Costo/vigencia/renovación vienen del contrato vinculado cuando
            // aplica — mismo criterio que ya existía, solo que ahora pasa por
            // el componente compartido en vez de JSX suelto. Fecha de compra,
            // N° de factura y N° de OC son datos propios de la licencia y
            // siguen editables aunque haya contrato vinculado.
            const hiddenFields = [
              'supplier' as const,
              // "Fecha de próxima renovación" nunca se pide aparte — es la
              // misma fecha de vencimiento, ver expirationDateTouched arriba.
              'renewalDate' as const,
              ...(linkedContract
                ? (['expirationDate', 'purchasePrice', 'renewalCost'] as const)
                : []),
            ]

            if (isEditMode) {
              // En edición: solo lectura — precio/fecha/factura ahora se
              // administran desde "Facturas / Pagos de adquisición" en la
              // ficha de la licencia (se sincronizan solos hacia estos mismos
              // campos), no aquí.
              return (
                <div className='space-y-1'>
                  <FinancialInfoSection
                    hiddenFields={hiddenFields}
                    purchasePrice={cost ? parseFloat(cost) : null}
                    purchaseDate={purchaseDate || null}
                    expirationDate={expirationDate || null}
                    invoiceNumber={invoiceNumber}
                    purchaseOrderNumber={purchaseOrderNumber}
                    renewalCost={renewalCost ? parseFloat(renewalCost) : null}
                    renewalDate={expirationDate || null}
                    showExpiration
                    showRenewal
                    collapsible={false}
                    readOnly
                  />
                  <p className='text-xs text-muted-foreground'>
                    Para modificar el costo, la fecha o el N° de factura, edítalo en &quot;Facturas
                    / Pagos de adquisición&quot;, en la ficha de la licencia.
                  </p>
                </div>
              )
            }

            return (
              <>
                {linkedContract && (
                  <div className='rounded-lg border border-blue-200/80 bg-blue-50/50 dark:bg-blue-500/10 px-3 py-2 text-xs text-muted-foreground'>
                    Costo y vigencia provienen del contrato vinculado. Aquí solo registra datos
                    propios de la licencia (factura, orden de compra, fecha de compra).
                  </div>
                )}
                <FinancialInfoSection
                  hiddenFields={hiddenFields}
                  required={isRequired('FINANCIAL')}
                  purchasePrice={cost ? parseFloat(cost) : null}
                  purchaseDate={purchaseDate || null}
                  expirationDate={expirationDate || null}
                  invoiceNumber={invoiceNumber}
                  purchaseOrderNumber={purchaseOrderNumber}
                  renewalCost={renewalCost ? parseFloat(renewalCost) : null}
                  renewalDate={expirationDate || null}
                  showExpiration
                  showRenewal
                  collapsible={false}
                  onChange={(field, value) => {
                    if (field === 'purchasePrice') setCost(value != null ? String(value) : '')
                    else if (field === 'purchaseDate') setPurchaseDate(value ?? '')
                    else if (field === 'expirationDate') {
                      setExpirationDate(value ?? '')
                      setExpirationDateTouched(true)
                    } else if (field === 'invoiceNumber') setInvoiceNumber(value ?? '')
                    else if (field === 'purchaseOrderNumber') setPurchaseOrderNumber(value ?? '')
                    else if (field === 'renewalCost')
                      setRenewalCost(value != null ? String(value) : '')
                  }}
                />
              </>
            )
          })()}

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
            {submitting ? 'Guardando...' : isEditMode ? 'Guardar cambios' : 'Crear Licencia'}
          </Button>
        </div>
      </form>

      {/* Gestor de atributos encadenado desde el selector de Tipo de Licencia */}
      {manageAttributesFor && (
        <AttributeManagerDialog
          open={!!manageAttributesFor}
          onOpenChange={o => {
            if (!o) {
              setManageAttributesFor(null)
              setManageAttributesAutoCreate(false)
            }
          }}
          typeKind='license'
          typeId={manageAttributesFor.id}
          typeName={manageAttributesFor.name}
          autoOpenCreate={manageAttributesAutoCreate}
          onAttributesChange={() => setAttributesReloadToken(t => t + 1)}
        />
      )}
    </>
  )
}
