'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { FamilyConfig } from '@/lib/inventory/family-config-types'
import { X, Upload, Search } from 'lucide-react'

interface LicenseAssetFormProps {
  familyId: string
  familyConfig: FamilyConfig
  onSubmit: (payload: Record<string, unknown>) => void
  onBack: () => void
  submitting: boolean
  submitError: string | null
  maxFileSizeMB?: number
}

interface SelectOption { id: string; name: string }

type Scope = 'Individual' | 'Departamento' | 'Empresa'

function SearchSelect({ options, value, onChange, placeholder = 'Seleccionar...', disabled }: {
  options: SelectOption[]; value: string; onChange: (v: string) => void
  placeholder?: string; disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const filtered = q ? options.filter(o => o.name.toLowerCase().includes(q.toLowerCase())) : options
  const selected = options.find(o => o.id === value)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button type="button" disabled={disabled} onClick={() => setOpen(o => !o)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm disabled:opacity-50">
        <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>{selected?.name ?? placeholder}</span>
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input autoFocus className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              placeholder="Buscar..." value={q} onChange={e => setQ(e.target.value)} />
            {q && <button type="button" onClick={() => setQ('')}><X className="h-3 w-3" /></button>}
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            <button type="button" onClick={() => { onChange(''); setOpen(false); setQ('') }}
              className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-accent">
              {placeholder}
            </button>
            {filtered.map(o => (
              <button key={o.id} type="button"
                onClick={() => { onChange(o.id); setOpen(false); setQ('') }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-accent ${o.id === value ? 'bg-accent/50 font-medium' : ''}`}>
                {o.name}
              </button>
            ))}
            {filtered.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</p>}
          </div>
        </div>
      )}
    </div>
  )
}

export function LicenseAssetForm({
  familyId, familyConfig, onSubmit, onBack, submitting, submitError, maxFileSizeMB = 10,
}: LicenseAssetFormProps) {
  const [name, setName] = useState('')
  const [licenseTypeId, setLicenseTypeId] = useState('')
  const [licenseTypes, setLicenseTypes] = useState<SelectOption[]>([])
  const [licenseKey, setLicenseKey] = useState('')
  const [scope, setScope] = useState<Scope>('Empresa')
  const [userId, setUserId] = useState('')
  const [users, setUsers] = useState<SelectOption[]>([])
  const [departmentId, setDepartmentId] = useState('')
  const [departments, setDepartments] = useState<SelectOption[]>([])
  const [vendor, setVendor] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [expirationDate, setExpirationDate] = useState('')
  const [cost, setCost] = useState('')
  const [contractNumber, setContractNumber] = useState('')
  const [contractStartDate, setContractStartDate] = useState('')
  const [contractEndDate, setContractEndDate] = useState('')
  const [renewalCost, setRenewalCost] = useState('')
  const [notes, setNotes] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isVisible = (s: string) => familyConfig.visibleSections.includes(s as never)

  useEffect(() => {
    fetch(`/api/inventory/license-types?familyId=${familyId}`)
      .then(r => r.json()).then(d => setLicenseTypes(d.types ?? d ?? []))
  }, [familyId])

  useEffect(() => {
    if (scope === 'Individual') {
      fetch('/api/users?limit=200').then(r => r.json()).then(d => {
        const list = d.users ?? d ?? []
        setUsers(list.map((u: { id: string; name?: string; email?: string }) => ({ id: u.id, name: u.name ?? u.email ?? u.id })))
      })
    } else if (scope === 'Departamento') {
      fetch('/api/departments').then(r => r.json()).then(d => {
        const list = d.departments ?? d ?? []
        setDepartments(list.map((dep: { id: string; name: string }) => ({ id: dep.id, name: dep.name })))
      })
    }
  }, [scope])

  const addFiles = (files: FileList | null) => {
    if (!files) return
    setAttachments(prev => {
      const next = [...prev]
      Array.from(files).forEach(f => {
        if (f.size > maxFileSizeMB * 1024 * 1024) return
        if (!next.find(x => x.name === f.name && x.size === f.size)) next.push(f)
      })
      return next
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload: Record<string, unknown> = {
      name,
      licenseTypeId: licenseTypeId || undefined,
      key: licenseKey || undefined,
      scope,
      assignedUserId: scope === 'Individual' ? (userId || undefined) : undefined,
      assignedDepartmentId: scope === 'Departamento' ? (departmentId || undefined) : undefined,
      vendor: vendor || undefined,
      purchaseDate: purchaseDate || undefined,
      expirationDate: expirationDate || undefined,
      cost: cost ? parseFloat(cost) : undefined,
      contractNumber: contractNumber || undefined,
      contractStartDate: contractStartDate || undefined,
      contractEndDate: contractEndDate || undefined,
      renewalCost: renewalCost ? parseFloat(renewalCost) : undefined,
      notes: notes || undefined,
    }
    onSubmit(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Nombre */}
      <div className="space-y-1">
        <Label>Nombre <span className="text-destructive">*</span></Label>
        <Input value={name} onChange={e => setName(e.target.value)} required placeholder="Ej: Microsoft Office 365" />
      </div>

      {/* Tipo de licencia */}
      <div className="space-y-1">
        <Label>Tipo de Licencia / Contrato</Label>
        <SearchSelect options={licenseTypes} value={licenseTypeId} onChange={setLicenseTypeId} placeholder="Buscar tipo..." />
      </div>

      {/* Clave */}
      <div className="space-y-1">
        <Label>Clave de Licencia <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
        <Input value={licenseKey} onChange={e => setLicenseKey(e.target.value)} placeholder="Ej: XXXXX-XXXXX-XXXXX" />
      </div>

      {/* Alcance */}
      <div className="space-y-1">
        <Label>Alcance</Label>
        <select value={scope} onChange={e => setScope(e.target.value as Scope)}
          className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <option value="Individual">Individual</option>
          <option value="Departamento">Departamento</option>
          <option value="Empresa">Empresa</option>
        </select>
      </div>

      {/* Asignación según alcance */}
      {scope === 'Individual' && (
        <div className="space-y-1">
          <Label>Usuario Asignado</Label>
          <SearchSelect options={users} value={userId} onChange={setUserId} placeholder="Buscar usuario..." />
        </div>
      )}
      {scope === 'Departamento' && (
        <div className="space-y-1">
          <Label>Departamento Asignado</Label>
          <SearchSelect options={departments} value={departmentId} onChange={setDepartmentId} placeholder="Buscar departamento..." />
        </div>
      )}

      {/* Proveedor/Vendedor */}
      <div className="space-y-1">
        <Label>Proveedor / Vendedor <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
        <Input value={vendor} onChange={e => setVendor(e.target.value)} placeholder="Ej: Microsoft, Adobe..." />
      </div>

      {/* Fechas y costo */}
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

      {/* Sección CONTRACT */}
      {isVisible('CONTRACT') && (
        <fieldset className="rounded-lg border border-border p-4 space-y-3">
          <legend className="px-2 text-sm font-semibold text-foreground">Contrato</legend>
          <div className="space-y-1">
            <Label>Número de Contrato</Label>
            <Input value={contractNumber} onChange={e => setContractNumber(e.target.value)} placeholder="Ej: CONT-2024-001" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Inicio del Contrato</Label>
              <Input type="date" value={contractStartDate} onChange={e => setContractStartDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Fin del Contrato</Label>
              <Input type="date" value={contractEndDate} onChange={e => setContractEndDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Costo de Renovación</Label>
            <Input type="number" min="0" step="0.01" value={renewalCost} onChange={e => setRenewalCost(e.target.value)} placeholder="0.00" />
          </div>
        </fieldset>
      )}

      {/* Observaciones */}
      <div className="space-y-1">
        <Label>Observaciones</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Notas adicionales..." />
      </div>

      {/* Adjuntos */}
      <div className="space-y-2">
        <Label>Adjuntos</Label>
        <div
          className="flex flex-col items-center justify-center rounded-md border-2 border-dashed border-border p-5 cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
        >
          <Upload className="h-7 w-7 text-muted-foreground mb-1" />
          <p className="text-sm text-muted-foreground">Arrastra archivos o <span className="text-primary font-medium">haz clic</span></p>
          <p className="text-xs text-muted-foreground mt-0.5">Máx. {maxFileSizeMB} MB por archivo</p>
        </div>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
        {attachments.length > 0 && (
          <div className="space-y-1">
            {attachments.map((f, i) => (
              <div key={i} className="flex items-center justify-between rounded-md border border-border px-3 py-1.5 text-sm">
                <span className="truncate">{f.name}</span>
                <button type="button" onClick={() => setAttachments(p => p.filter((_, j) => j !== i))}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

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
