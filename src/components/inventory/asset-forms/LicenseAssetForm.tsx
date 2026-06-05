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
import { SupplierSelect } from '@/components/inventory/suppliers/SupplierSelect'
import { CatalogTypeInlineForm } from '@/components/inventory/asset-forms/CatalogTypeInlineForm'
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
}

type Scope = 'Individual' | 'Departamento' | 'Empresa'

export function LicenseAssetForm({
  familyId,
  familyConfig,
  onSubmit,
  onBack,
  submitting,
  submitError,
  maxFileSizeMB = 10,
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
  const [contractNumber, setContractNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])

  void familyConfig

  useEffect(() => {
    fetch(`/api/inventory/license-types?familyId=${familyId}`)
      .then(r => r.json())
      .then(d => setLicenseTypes(d.types ?? d ?? []))
  }, [familyId])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
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
      ...(hasRecurring
        ? {
            contractId: linkedContractId || undefined,
          }
        : {
            contractNumber: contractNumber || undefined,
          }),
      notes: notes || undefined,
      customValues: customFieldValues.length ? customFieldValues : undefined,
    }
    onSubmit(payload)
  }

  function TypeAttributesSection({
    typeId,
    values,
    onChange,
  }: {
    typeId: string
    values: Array<{ fieldName: string; fieldValue: string }>
    onChange: (values: Array<{ fieldName: string; fieldValue: string }>) => void
  }) {
    if (!typeId) {
      return null
    }

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

      <TypeAttributesSection
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

      <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
        <div className='space-y-1'>
          <Label>Fecha de Compra</Label>
          <Input type='date' value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
        </div>
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
            Costo <span className='text-xs font-normal text-muted-foreground'>(opcional)</span>
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
        <div className='space-y-1'>
          <Label>
            Fecha de Renovación{' '}
            <span className='text-xs font-normal text-muted-foreground'>(opcional)</span>
          </Label>
          <Input type='date' value={renewalDate} onChange={e => setRenewalDate(e.target.value)} />
        </div>
      </div>

      <div className='rounded-lg border border-border p-4 space-y-3'>
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
          <ContractPicker
            value={linkedContractId}
            onChange={setLinkedContractId}
            supplierId={supplierId || null}
            familyId={familyId}
          />
        ) : (
          <div className='space-y-3'>
            <div className='space-y-1'>
              <Label>
                Número de Contrato{' '}
                <span className='text-xs font-normal text-muted-foreground'>(opcional)</span>
              </Label>
              <Input
                value={contractNumber}
                onChange={e => setContractNumber(e.target.value)}
                placeholder='Ej: CONT-2024-001'
              />
            </div>
            <div className='space-y-1'>
              <Label>
                Costo de Renovación{' '}
                <span className='text-xs font-normal text-muted-foreground'>(mensual o anual)</span>
              </Label>
              <Input
                type='number'
                min='0'
                step='0.01'
                value={renewalCost}
                onChange={e => setRenewalCost(e.target.value)}
                placeholder='0.00'
              />
            </div>
          </div>
        )}
      </div>

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
          {submitting ? 'Guardando...' : 'Crear Licencia'}
        </Button>
      </div>
    </form>
  )
}
