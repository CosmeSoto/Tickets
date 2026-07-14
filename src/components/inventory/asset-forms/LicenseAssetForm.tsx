'use client'

import { useState, useMemo, useEffect } from 'react'
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
import type { FamilyConfig } from '@/lib/inventory/family-config-types'
import { useFetch } from '@/hooks/common/use-fetch'
import { useActiveDepartments } from '@/contexts/departments-context'
import { RefreshCw, Tag } from 'lucide-react'

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

const SCOPE_FROM_API: Record<string, Scope> = {
  INDIVIDUAL: 'Individual',
  DEPARTMENT: 'Departamento',
  COMPANY: 'Empresa',
  Individual: 'Individual',
  Departamento: 'Departamento',
  Empresa: 'Empresa',
}

function formatDateInput(value: unknown): string {
  if (!value) return ''
  const d = new Date(String(value))
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

// ── Componente definido fuera del padre para evitar remount en cada render ───
function LicenseTypeAttributesSection({
  typeId,
  values,
  onChange,
}: {
  typeId: string
  values: Array<{ fieldName: string; fieldValue: string }>
  onChange: (values: Array<{ fieldName: string; fieldValue: string }>) => void
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
  const [name, setName] = useState('')
  const [licenseTypeId, setLicenseTypeId] = useState('')
  const [licenseTypes, setLicenseTypes] = useState<{ id: string; name: string }[]>([])
  const [customFieldValues, setCustomFieldValues] = useState<
    Array<{ fieldName: string; fieldValue: string }>
  >([])
  const [licenseKey, setLicenseKey] = useState('')
  const [scope, setScope] = useState<Scope>('Empresa')
  const [userId, setUserId] = useState('')
  const [departmentId, setDepartmentId] = useState('')

  const { data: rawUsers } = useFetch<{ id: string; name?: string; email?: string }>('/api/users', {
    params: { limit: 200 },
    enabled: scope === 'Individual',
  })
  const users: SearchableSelectOption[] = useMemo(
    () => rawUsers.map(u => ({ id: u.id, name: u.name ?? u.email ?? u.id })),
    [rawUsers]
  )

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
  const [renewalDate, setRenewalDate] = useState('')
  const [hasRecurring, setHasRecurring] = useState(false)
  const [linkedContractId, setLinkedContractId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])

  const isVisible = (section: string) => familyConfig.visibleSections.includes(section as never)
  const isRequired = (section: string) => familyConfig.requiredSections.includes(section as never)

  useEffect(() => {
    fetch(`/api/inventory/license-types?familyId=${familyId}`)
      .then(r => r.json())
      .then(d => setLicenseTypes(d.types ?? d ?? []))
  }, [familyId])

  useEffect(() => {
    if (!isEditMode || !initialLicense) return

    setName(String(initialLicense.name ?? ''))
    const typeId =
      (initialLicense.licenseType as { id?: string })?.id ??
      (initialLicense.typeId as string | undefined) ??
      ''
    setLicenseTypeId(typeId)
    setLicenseKey(String(initialLicense.key ?? ''))
    const scopeValue = initialLicense.licenseScope ?? initialLicense.scope
    setScope(SCOPE_FROM_API[String(scopeValue)] ?? 'Empresa')
    setUserId(String(initialLicense.assignedToUser ?? ''))
    setDepartmentId(String(initialLicense.assignedToDepartment ?? ''))
    setSupplierId(
      String(
        (initialLicense.supplier as { id?: string })?.id ?? initialLicense.supplierId ?? ''
      )
    )
    setPurchaseDate(formatDateInput(initialLicense.purchaseDate))
    setExpirationDate(formatDateInput(initialLicense.expirationDate))
    setCost(initialLicense.cost != null ? String(initialLicense.cost) : '')
    setInvoiceNumber(String(initialLicense.invoiceNumber ?? ''))
    setPurchaseOrderNumber(String(initialLicense.purchaseOrderNumber ?? ''))
    setRenewalCost(initialLicense.renewalCost != null ? String(initialLicense.renewalCost) : '')
    setRenewalDate(formatDateInput(initialLicense.renewalDate))
    setHasRecurring(
      initialLicense.renewalCost != null ||
        initialLicense.renewalDate != null ||
        initialLicense.contractType === 'RECURRING'
    )
    setLinkedContractId((initialLicense.linkedContractId as string | null) ?? null)
    setNotes(String(initialLicense.notes ?? ''))
    setCustomFieldValues(
      (initialLicense.customValues as Array<{ fieldName: string; fieldValue: string }>) ?? []
    )
  }, [isEditMode, initialLicense])

  const { data: linkedContracts } = useFetch<Contract>(
    linkedContractId ? `/api/inventory/contracts/${linkedContractId}` : '/api/inventory/contracts',
    {
      enabled: !!linkedContractId,
      transform: d => (d.id ? [d] : []),
    }
  )
  const linkedContract = linkedContracts[0] ?? null

  const contractFinancial = useMemo(
    () =>
      linkedContract
        ? resolveLicenseFinancialFromContract(linkedContract, hasRecurring)
        : null,
    [linkedContract, hasRecurring]
  )

  const contractPrefill = useMemo(
    () => ({
      name: name.trim() || undefined,
      supplierId: supplierId || null,
      familyId,
      startDate: purchaseDate || undefined,
      endDate: expirationDate || renewalDate || undefined,
      cost: cost || renewalCost || undefined,
      monthlyCost: hasRecurring ? renewalCost || cost : undefined,
      totalValue: !hasRecurring ? cost : undefined,
      hasRecurring,
      suggestedLineDescription: name.trim() || 'Licencia de software',
      category: 'SOFTWARE_LICENSE' as const,
    }),
    [
      name,
      supplierId,
      familyId,
      purchaseDate,
      expirationDate,
      renewalDate,
      cost,
      renewalCost,
      hasRecurring,
    ]
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
      if (contractFinancial.renewalDate) setRenewalDate(contractFinancial.renewalDate)
      if (contractFinancial.expirationDate) setExpirationDate(contractFinancial.expirationDate)
    } else {
      setRenewalCost('')
      if (contractFinancial.cost != null) setCost(String(contractFinancial.cost))
      if (contractFinancial.expirationDate) setExpirationDate(contractFinancial.expirationDate)
    }
  }, [linkedContract, linkedContractId, contractFinancial, hasRecurring])

  const handleContractChange = (contractId: string | null) => {
    setLinkedContractId(contractId)
    if (!contractId) setRenewalCost('')
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!isDirectFormSubmit(e)) return
    const payload: Record<string, unknown> = {
      name,
      licenseTypeId: licenseTypeId || undefined,
      typeId: licenseTypeId || undefined,
      key: licenseKey || undefined,
      scope,
      assignedToUser: scope === 'Individual' ? userId || undefined : undefined,
      assignedToDepartment: scope === 'Departamento' ? departmentId || undefined : undefined,
      supplierId: supplierId || undefined,
      purchaseDate: purchaseDate || undefined,
      expirationDate: expirationDate || undefined,
      cost: cost ? parseFloat(cost) : undefined,
      invoiceNumber: invoiceNumber || undefined,
      purchaseOrderNumber: purchaseOrderNumber || undefined,
      renewalCost: renewalCost ? parseFloat(renewalCost) : undefined,
      renewalDate: renewalDate || undefined,
      contractId: linkedContractId || undefined,
      notes: notes || undefined,
      customValues: customFieldValues.length ? customFieldValues : undefined,
      attachments: attachments.length ? attachments : undefined,
    }
    onSubmit(payload)
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-5'>
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
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
            createForm={({ onSuccess, onCancel }) => (
              <CatalogTypeInlineForm
                apiEndpoint='/api/inventory/license-types'
                familyId={familyId}
                onSuccess={item => {
                  setLicenseTypes(prev => [...prev, item])
                  onSuccess(item)
                }}
                onCancel={onCancel}
              />
            )}
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
          />
        </div>
      </div>

      <LicenseTypeAttributesSection
        typeId={licenseTypeId}
        values={customFieldValues}
        onChange={setCustomFieldValues}
      />

      <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
        <div className='space-y-1'>
          <Label>Alcance</Label>
          <SimpleSelect value={scope} onChange={e => setScope(e.target.value as Scope)}>
            <option value='Individual'>Individual</option>
            <option value='Departamento'>Departamento</option>
            <option value='Empresa'>Empresa</option>
          </SimpleSelect>
        </div>

        <div className='space-y-1'>
          <Label>
            Proveedor / Vendedor <span className='text-destructive'>*</span>
          </Label>
          <SupplierSelect
            value={supplierId || null}
            onChange={v => setSupplierId(v || '')}
            familyId={familyId}
          />
        </div>

        {scope === 'Individual' && (
          <div className='space-y-1'>
            <Label>Usuario Asignado</Label>
            <SearchableSelect
              options={users}
              value={userId}
              onChange={setUserId}
              placeholder='Buscar usuario...'
            />
          </div>
        )}
        {scope === 'Departamento' && (
          <div className='space-y-1'>
            <Label>Departamento Asignado</Label>
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
            <p className='text-xs text-muted-foreground rounded-md bg-muted/40 px-3 py-2'>
              Esta licencia tiene pago recurrente. Vincula el contrato del módulo de Contratos para
              mantener trazabilidad financiera y operativa.
            </p>
          ) : (
            <p className='text-xs text-muted-foreground rounded-md bg-muted/40 px-3 py-2'>
              Aunque no sea recurrente, puedes vincular el contrato de compra o soporte para evitar
              datos huérfanos y duplicados.
            </p>
          )}

          <div className='space-y-2'>
            <Label>
              Contrato vinculado{' '}
              <span className='text-xs font-normal text-muted-foreground'>(opcional)</span>
            </Label>
            <ContractPicker
              value={linkedContractId}
              onChange={handleContractChange}
              supplierId={supplierId || null}
              familyId={familyId}
              context='license'
              prefill={contractPrefill}
            />
          </div>

          {linkedContract && contractFinancial ? (
            <div className='rounded-md border bg-muted/30 px-3 py-2.5 space-y-1'>
              <p className='text-xs text-muted-foreground'>{contractFinancial.amountLabel}</p>
              <p className='text-sm font-medium font-mono'>
                {formatContractAmount(
                  contractFinancial.displayAmount,
                  contractFinancial.currency
                )}
              </p>
              <p className='text-[11px] text-muted-foreground'>
                Tomado automáticamente del contrato vinculado.{' '}
                {hasRecurring
                  ? 'Se guardará como costo de renovación.'
                  : 'Se guardará como costo de la licencia.'}
              </p>
            </div>
          ) : (
            <p className='text-xs text-muted-foreground rounded-md bg-muted/40 px-3 py-2'>
              Vincula un contrato para cargar el costo automáticamente según el tipo de pago
              {hasRecurring ? ' recurrente' : ' único'}.
            </p>
          )}
        </div>
      )}

      {isVisible('FINANCIAL') && (
        <>
          {linkedContract && (
            <div className='rounded-lg border border-blue-200/80 bg-blue-50/50 dark:bg-blue-500/10 px-3 py-2 text-xs text-muted-foreground'>
              Costo y vigencia provienen del contrato vinculado. Aquí solo registra datos propios de
              la licencia (factura, orden de compra, fecha de compra).
            </div>
          )}
          <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
            <div className='space-y-1'>
              <Label>
                Fecha de Compra
                {isRequired('FINANCIAL') && <span className='text-destructive'> *</span>}
              </Label>
              <Input
                type='date'
                value={purchaseDate}
                onChange={e => setPurchaseDate(e.target.value)}
                required={isRequired('FINANCIAL')}
              />
            </div>
            {!linkedContract && (
              <>
                <div className='space-y-1'>
                  <Label>Fecha de Vencimiento</Label>
                  <Input
                    type='date'
                    value={expirationDate}
                    onChange={e => setExpirationDate(e.target.value)}
                  />
                </div>
                <div className='space-y-1'>
                  <Label>
                    Costo{' '}
                    {!isRequired('FINANCIAL') && (
                      <span className='text-xs font-normal text-muted-foreground'>(opcional)</span>
                    )}
                  </Label>
                  <Input
                    type='number'
                    min='0'
                    step='0.01'
                    value={cost}
                    onChange={e => setCost(e.target.value)}
                    placeholder='0.00'
                  />
                </div>
              </>
            )}
          </div>

          <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
            <div className='space-y-1'>
              <Label>
                Número de Factura{' '}
                <span className='text-xs font-normal text-muted-foreground'>(opcional)</span>
              </Label>
              <Input
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
                placeholder='Ej: FACT-2024-001'
              />
            </div>
            <div className='space-y-1'>
              <Label>
                Número de Orden de Compra{' '}
                <span className='text-xs font-normal text-muted-foreground'>(opcional)</span>
              </Label>
              <Input
                value={purchaseOrderNumber}
                onChange={e => setPurchaseOrderNumber(e.target.value)}
                placeholder='Ej: OC-2024-001'
              />
            </div>
            {!linkedContract && (
              <div className='space-y-1'>
                <Label>
                  Fecha de Renovación{' '}
                  <span className='text-xs font-normal text-muted-foreground'>(opcional)</span>
                </Label>
                <Input
                  type='date'
                  value={renewalDate}
                  onChange={e => setRenewalDate(e.target.value)}
                />
              </div>
            )}
          </div>
        </>
      )}

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
          {submitting
            ? 'Guardando...'
            : isEditMode
              ? 'Guardar cambios'
              : 'Crear Licencia'}
        </Button>
      </div>
    </form>
  )
}
