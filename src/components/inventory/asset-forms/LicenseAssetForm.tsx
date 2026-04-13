'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select'
import { InlineCreateSelect } from '@/components/ui/inline-create-select'
import { SimpleSelect } from '@/components/ui/simple-select'
import { FileUploadZone } from '@/components/ui/file-upload-zone'
import { ContractSection, type ContractData } from '@/components/inventory/contract-section'
import { SupplierSelect } from '@/components/inventory/suppliers/SupplierSelect'
import { CatalogTypeInlineForm } from '@/components/inventory/asset-forms/CatalogTypeInlineForm'
import type { FamilyConfig } from '@/lib/inventory/family-config-types'
import { RefreshCw } from 'lucide-react'

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
  familyId, familyConfig, onSubmit, onBack, submitting, submitError, maxFileSizeMB = 10,
}: LicenseAssetFormProps) {
  const [name, setName] = useState('')
  const [licenseTypeId, setLicenseTypeId] = useState('')
  const [licenseTypes, setLicenseTypes] = useState<{ id: string; name: string }[]>([])
  const [licenseKey, setLicenseKey] = useState('')
  const [scope, setScope] = useState<Scope>('Empresa')
  const [userId, setUserId] = useState('')
  const [users, setUsers] = useState<SearchableSelectOption[]>([])
  const [departmentId, setDepartmentId] = useState('')
  const [departments, setDepartments] = useState<SearchableSelectOption[]>([])
  const [supplierId, setSupplierId] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [cost, setCost] = useState('')
  // Toggle suscripción recurrente (tarea 21)
  const [hasRecurring, setHasRecurring] = useState(false)
  const [contractData, setContractData] = useState<ContractData | null>(null)
  // Campos simples de contrato (cuando no es recurrente)
  const [contractNumber, setContractNumber] = useState('')
  const [contractStartDate, setContractStartDate] = useState('')
  const [contractEndDate, setContractEndDate] = useState('')
  const [renewalCost, setRenewalCost] = useState('')
  const [notes, setNotes] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])

  // familyConfig no aplica a licencias — siempre mostramos todo
  void familyConfig

  useEffect(() => {
    fetch(`/api/inventory/license-types?familyId=${familyId}`)
      .then(r => r.json()).then(d => setLicenseTypes(d.types ?? d ?? []))
  }, [familyId])

  useEffect(() => {
    if (scope === 'Individual') {
      fetch('/api/users?limit=200').then(r => r.json()).then(d => {
        const list = d.data ?? d.users ?? []
        setUsers(list.map((u: { id: string; name?: string; email?: string }) => ({ id: u.id, name: u.name ?? u.email ?? u.id })))
      })
    } else if (scope === 'Departamento') {
      fetch('/api/departments').then(r => r.json()).then(d => {
        const list = d.data ?? d.departments ?? []
        setDepartments(list.map((dep: { id: string; name: string }) => ({ id: dep.id, name: dep.name })))
      })
    }
  }, [scope])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload: Record<string, unknown> = {
      name,
      licenseTypeId: licenseTypeId || undefined,
      key: licenseKey || undefined,
      scope,
      assignedUserId: scope === 'Individual' ? (userId || undefined) : undefined,
      assignedDepartmentId: scope === 'Departamento' ? (departmentId || undefined) : undefined,
      supplierId: supplierId || undefined,
      purchaseDate: purchaseDate || undefined,
      expirationDate: expirationDate || undefined,
      cost: cost ? parseFloat(cost) : undefined,
      ...(hasRecurring
        ? {
            contractAction: contractData?.action,
            contractId: contractData?.contractId,
            contractNumber: contractData?.contractNumber,
            contractStartDate: contractData?.startDate,
            contractEndDate: contractData?.endDate,
            contractMonthlyCost: contractData?.monthlyCost,
          }
        : {
            contractNumber: contractNumber || undefined,
            contractStartDate: contractStartDate || undefined,
            contractEndDate: contractEndDate || undefined,
            renewalCost: renewalCost ? parseFloat(renewalCost) : undefined,
          }),
      notes: notes || undefined,
    }
    onSubmit(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <button type="button" onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">← Atrás</button>

      <div className="space-y-1">
        <Label>Nombre <span className="text-destructive">*</span></Label>
        <Input value={name} onChange={e => setName(e.target.value)} required placeholder="Ej: Microsoft Office 365" />
      </div>

      <div className="space-y-1">
        <Label>Tipo de Licencia / Contrato</Label>
        <InlineCreateSelect
          options={licenseTypes}
          value={licenseTypeId}
          onChange={setLicenseTypeId}
          placeholder="Buscar tipo..."
          allowClear
          createLabel="Crear tipo de licencia"
          createTitle="Nuevo tipo de licencia"
          createForm={({ onSuccess, onCancel }) => (
            <CatalogTypeInlineForm
              apiEndpoint="/api/inventory/license-types"
              familyId={familyId}
              onSuccess={(item) => { setLicenseTypes(prev => [...prev, item]); onSuccess(item) }}
              onCancel={onCancel}
            />
          )}
        />
      </div>

      <div className="space-y-1">
        <Label>Clave de Licencia <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
        <Input value={licenseKey} onChange={e => setLicenseKey(e.target.value)} placeholder="Ej: XXXXX-XXXXX-XXXXX" />
      </div>

      <div className="space-y-1">
        <Label>Alcance</Label>
        <SimpleSelect value={scope} onChange={e => setScope(e.target.value as Scope)}>
          <option value="Individual">Individual</option>
          <option value="Departamento">Departamento</option>
          <option value="Empresa">Empresa</option>
        </SimpleSelect>
      </div>

      {scope === 'Individual' && (
        <div className="space-y-1">
          <Label>Usuario Asignado</Label>
          <SearchableSelect options={users} value={userId} onChange={setUserId} placeholder="Buscar usuario..." />
        </div>
      )}
      {scope === 'Departamento' && (
        <div className="space-y-1">
          <Label>Departamento Asignado</Label>
          <SearchableSelect options={departments} value={departmentId} onChange={setDepartmentId} placeholder="Buscar departamento..." />
        </div>
      )}

      <div className="space-y-1">
        <Label>Proveedor / Vendedor <span className="text-destructive">*</span></Label>
        <SupplierSelect value={supplierId || null} onChange={v => setSupplierId(v || '')} familyId={familyId} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Fecha de Compra</Label>
          <Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Fecha de Vencimiento</Label>
          <Input type="date" value={expirationDate} onChange={e => setExpirationDate(e.target.value)} />
        </div>
        <div className="space-y-1 col-span-2">
          <Label>Costo <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
          <Input type="number" min="0" step="0.01" value={cost} onChange={e => setCost(e.target.value)} placeholder="0.00" />
        </div>
      </div>

      {/* Contrato / Suscripción */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        {/* Toggle */}
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <button
            type="button"
            role="switch"
            aria-checked={hasRecurring}
            onClick={() => setHasRecurring(v => !v)}
            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${hasRecurring ? 'bg-primary' : 'bg-muted'}`}
          >
            <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transition-transform ${hasRecurring ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
          <div>
            <span className="text-sm font-medium flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
              Tiene suscripción / pago recurrente
            </span>
            <p className="text-xs text-muted-foreground">Activa si el software se paga mensual o anualmente (SaaS, arrendamiento)</p>
          </div>
        </label>

        {hasRecurring ? (
          <ContractSection
            acquisitionMode="RENTAL"
            supplierId={supplierId || null}
            onContractChange={setContractData}
          />
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Número de Contrato <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
              <Input value={contractNumber} onChange={e => setContractNumber(e.target.value)} placeholder="Ej: CONT-2024-001" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Inicio</Label>
                <Input type="date" value={contractStartDate} onChange={e => setContractStartDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Fin / Vencimiento</Label>
                <Input type="date" value={contractEndDate} onChange={e => setContractEndDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Costo de Renovación <span className="text-xs font-normal text-muted-foreground">(mensual o anual)</span></Label>
              <Input type="number" min="0" step="0.01" value={renewalCost} onChange={e => setRenewalCost(e.target.value)} placeholder="0.00" />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <Label>Observaciones</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Notas adicionales..." />
      </div>

      <FileUploadZone files={attachments} onChange={setAttachments} maxFileSizeMB={maxFileSizeMB} label="Adjuntos" />

      {submitError && <p className="text-sm text-destructive">{submitError}</p>}

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onBack} disabled={submitting}>← Atrás</Button>
        <Button type="submit" disabled={submitting} className="flex-1">
          {submitting ? 'Guardando...' : 'Crear Licencia'}
        </Button>
      </div>
    </form>
  )
}
