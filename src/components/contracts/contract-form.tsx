'use client'

import { useState, useEffect, useMemo } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { Plus, Trash2, RefreshCw, FileText, Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { useInventoryFamilies } from '@/contexts/families-context'
import { useFetch } from '@/hooks/common/use-fetch'
import { FileUploadZone } from '@/components/ui/file-upload-zone'
import { ContractPaymentsPanel } from '@/components/contracts/contract-payments-panel'
import { ContractAssignmentsPanel } from '@/components/contracts/contract-assignments-panel'
import { ContractAmendmentsPanel } from '@/components/contracts/contract-amendments-panel'
import { ContractFormSection } from '@/components/contracts/contract-form-section'
import { FormDraftBanner } from '@/components/common/form-draft-banner'
import { FormDraftKeys, useFormDraft } from '@/hooks/common/use-form-draft'
import { parseMoneyInput } from '@/lib/utils'
import {
  CONTRACT_CATEGORY_LABELS,
  CONTRACT_LINE_TYPE_LABELS,
  BILLING_CYCLE_LABELS,
  SUBSCRIPTION_USAGE_STATUS_LABELS,
  PAYMENT_CARD_BRAND_LABELS,
  PAYMENT_METHOD_TYPE_LABELS,
  SUBSCRIPTION_SERVICE_TYPE_LABELS,
  type Contract,
  type ContractFormData,
} from '@/types/contracts'
import type { ContractPickerPrefill } from '@/lib/contracts/contract-picker-prefill'
import { applyContractFormPrefill, lineTypeForCategory } from '@/lib/contracts/apply-contract-prefill'

interface ContractAttachment {
  id: string
  originalName: string
  mimeType: string
  size: number
  path: string
  createdAt: string
}

interface Props {
  contract?: Contract | null
  onSuccess: (contract: Contract) => void
  onCancel: () => void
  readOnly?: boolean
  embedMode?: boolean
  prefill?: ContractPickerPrefill | null
  /** Notifica si el formulario tiene cambios sin guardar (para confirmar al cerrar). */
  onDirtyChange?: (dirty: boolean) => void
  /** Clave sessionStorage para borrador (página o embebido). */
  draftKey?: string
}

const EMPTY_LINE = {
  type: 'SERVICE' as const,
  description: '',
  quantity: '1',
  unitPrice: '',
  equipmentId: '',
  licenseId: '',
  notes: '',
  order: 0,
}

export function ContractForm({
  contract,
  onSuccess,
  onCancel,
  readOnly = false,
  embedMode = false,
  prefill = null,
  onDirtyChange,
  draftKey,
}: Props) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const isEditing = !!contract

  // ── Adjuntos ──────────────────────────────────────────────────────────────
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [existingAttachments, setExistingAttachments] = useState<ContractAttachment[]>(
    (contract as any)?.attachments ?? []
  )
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null)
  const [maxFileSize, setMaxFileSize] = useState(10)

  useEffect(() => {
    fetch('/api/config/upload')
      .then(r => r.json())
      .then(d => {
        if (d.maxFileSize) setMaxFileSize(d.maxFileSize)
      })
      .catch(() => {})
  }, [])

  // Recargar adjuntos cuando se edita un contrato existente
  useEffect(() => {
    if (!contract?.id) return
    fetch(`/api/inventory/contracts/${contract.id}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d?.attachments) setExistingAttachments(d.attachments)
      })
      .catch(() => {})
  }, [contract?.id])

  const handleDeleteAttachment = async (attachmentId: string) => {
    setDeletingAttachmentId(attachmentId)
    try {
      const res = await fetch(
        `/api/inventory/contracts/${contract!.id}/attachments?attachmentId=${attachmentId}`,
        { method: 'DELETE' }
      )
      if (!res.ok) throw new Error((await res.json()).error)
      setExistingAttachments(prev => prev.filter(a => a.id !== attachmentId))
      toast({ title: 'Adjunto eliminado' })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setDeletingAttachmentId(null)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const { families: rawFamilies } = useInventoryFamilies()

  // Memoizar las opciones para evitar recalcular en cada render
  const familyOptions = useMemo(
    () => [
      { value: '', label: 'Sin área específica' },
      ...rawFamilies.map(f => ({
        value: f.id,
        label: f.name,
        color: f.color || undefined,
      })),
    ],
    [rawFamilies]
  )

  const { data: suppliers } = useFetch<{
    id: string
    name: string
    email?: string | null
    phone?: string | null
    contactName?: string | null
    website?: string | null
  }>('/api/inventory/suppliers', {
    params: { active: 'true', limit: 100 },
    transform: d => d.suppliers ?? d ?? [],
    showErrorToast: false,
  })

  const supplierOptions = useMemo(
    () => [
      { value: '', label: 'Sin proveedor' },
      ...suppliers.map(s => ({
        value: s.id,
        label: s.name,
      })),
    ],
    [suppliers]
  )

  const { data: assignableUsers } = useFetch<{
    id: string
    name: string
    email: string
    role: string
  }>('/api/inventory/assignable-users', {
    transform: d => d.users ?? [],
    showErrorToast: false,
  })

  const custodianOptions = useMemo(
    () => [
      { value: '', label: 'Sin custodio' },
      ...assignableUsers
        .filter(u => u.role === 'ADMIN' || u.role === 'TECHNICIAN')
        .map(u => ({
          value: u.id,
          label: `${u.name} (${u.email})`,
        })),
    ],
    [assignableUsers]
  )

  const categoryOptions = useMemo(
    () =>
      Object.entries(CONTRACT_CATEGORY_LABELS).map(([k, v]) => ({
        value: k,
        label: v,
      })),
    []
  )

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isDirty },
    reset,
    getValues,
  } = useForm<ContractFormData>({
    defaultValues: {
      contractNumber: contract?.contractNumber ?? '',
      name: contract?.name ?? '',
      description: contract?.description ?? '',
      category: contract?.category ?? 'SERVICE',
      serviceSubtype: contract?.serviceSubtype ?? '',
      supplierId: contract?.supplierId ?? '',
      familyId: contract?.familyId ?? '',
      startDate: contract?.startDate ? contract.startDate.slice(0, 10) : '',
      endDate: contract?.endDate ? contract.endDate.slice(0, 10) : '',
      autoRenew: contract?.autoRenew ?? false,
      renewalNoticeDays:
        contract?.renewalNoticeDays ?? (contract?.category === 'EQUIPMENT_RENTAL' ? 120 : 30),
      billingCycle: contract?.billingCycle ?? 'MONTHLY',
      totalValue: contract?.totalValue != null ? String(contract.totalValue) : '',
      monthlyCost: contract?.monthlyCost != null ? String(contract.monthlyCost) : '',
      currency: contract?.currency ?? 'USD',
      contactName: contract?.contactName ?? '',
      contactEmail: contract?.contactEmail ?? '',
      contactPhone: contract?.contactPhone ?? '',
      notes: contract?.notes ?? '',
      termsUrl: contract?.termsUrl ?? '',
      paymentMethodType: contract?.paymentMethodType ?? 'CORPORATE_CARD',
      paymentAccountRef: contract?.paymentAccountRef ?? '',
      custodianUserId: contract?.custodianUserId ?? '',
      backupCustodianUserId: contract?.backupCustodianUserId ?? '',
      billingAccountEmail: contract?.billingAccountEmail ?? '',
      billingPortalUrl: contract?.billingPortalUrl ?? '',
      vendorAccountId: contract?.vendorAccountId ?? '',
      paymentCardBrand: (contract?.paymentCardBrand as ContractFormData['paymentCardBrand']) ?? '',
      paymentCardLast4: contract?.paymentCardLast4 ?? '',
      paymentCardBank: contract?.paymentCardBank ?? '',
      paymentCardExpiry: contract?.paymentCardExpiry ?? '',
      corporateCardLabel: contract?.corporateCardLabel ?? '',
      lastChargeDate: contract?.lastChargeDate ? contract.lastChargeDate.slice(0, 10) : '',
      lastChargeAmount: contract?.lastChargeAmount != null ? String(contract.lastChargeAmount) : '',
      lastTransactionRef: contract?.lastTransactionRef ?? '',
      subscriptionUsageStatus: contract?.subscriptionUsageStatus ?? 'ACTIVE',
      cancellationNoticeDays:
        contract?.cancellationNoticeDays != null ? String(contract.cancellationNoticeDays) : '',
      lines:
        contract?.lines?.map(l => ({
          id: l.id,
          type: l.type,
          description: l.description,
          quantity: String(l.quantity),
          unitPrice: l.unitPrice != null ? String(l.unitPrice) : '',
          equipmentId: l.equipmentId ?? '',
          licenseId: l.licenseId ?? '',
          notes: l.notes ?? '',
          order: l.order,
        })) ?? [],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  useEffect(() => {
    return () => onDirtyChange?.(false)
  }, [onDirtyChange])

  const resolvedDraftKey =
    draftKey ??
    (isEditing && contract?.id ? FormDraftKeys.contractEdit(contract.id) : FormDraftKeys.contractNew())

  const watchedDraft = watch()
  const draftSnapshot = useMemo(() => {
    const v = watchedDraft
    return {
      name: v.name ?? '',
      contractNumber: v.contractNumber ?? '',
      description: v.description ?? '',
      category: v.category ?? 'SERVICE',
      serviceSubtype: v.serviceSubtype ?? '',
      supplierId: v.supplierId ?? '',
      familyId: v.familyId ?? '',
      startDate: v.startDate ?? '',
      endDate: v.endDate ?? '',
      autoRenew: !!v.autoRenew,
      renewalNoticeDays: v.renewalNoticeDays ?? 30,
      billingCycle: v.billingCycle ?? 'MONTHLY',
      totalValue: v.totalValue ?? '',
      monthlyCost: v.monthlyCost ?? '',
      currency: v.currency ?? 'USD',
      contactName: v.contactName ?? '',
      contactEmail: v.contactEmail ?? '',
      contactPhone: v.contactPhone ?? '',
      notes: v.notes ?? '',
      termsUrl: v.termsUrl ?? '',
      paymentMethodType: v.paymentMethodType ?? 'CORPORATE_CARD',
      lines: (v.lines ?? []).map(l => ({
        type: l.type,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        notes: l.notes,
        order: l.order,
      })),
    }
  }, [watchedDraft])

  const { clearDraft, wasRestored, dismissRestoredBanner } = useFormDraft({
    key: resolvedDraftKey,
    values: draftSnapshot,
    enabled: !readOnly && !submitting,
    onRestore: data => {
      reset({
        ...getValues(),
        ...data,
        lines: Array.isArray(data.lines) ? data.lines : getValues('lines'),
      } as ContractFormData)
    },
  })

  useEffect(() => {
    if (contract || !prefill) return
    applyContractFormPrefill(prefill, setValue, line => append(line), fields.length)
  }, [contract, prefill, setValue, append, fields.length])

  const autoRenew = watch('autoRenew')
  const selectedCategory = watch('category')
  const familyId = watch('familyId')
  const paymentMethodType = watch('paymentMethodType')
  const selectedSupplierId = watch('supplierId')
  const billingCycle = watch('billingCycle')
  const startDateValue = watch('startDate')
  const isRecurringBilling = billingCycle !== 'ONE_TIME'

  const recurringCostLabel =
    billingCycle === 'QUARTERLY'
      ? 'Costo trimestral'
      : billingCycle === 'SEMIANNUAL'
        ? 'Costo semestral'
        : billingCycle === 'ANNUAL'
          ? 'Costo anual'
          : 'Costo mensual / recurrente'

  /** Densidad de grilla: 3 columnas en modal amplio (embed) */
  const formGrid = embedMode
    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
    : 'grid grid-cols-1 sm:grid-cols-2 gap-4'

  const { data: licenses } = useFetch<{ id: string; name: string; vendor?: string | null }>(
    '/api/inventory/licenses',
    {
      params: { familyId: familyId || undefined, limit: 100 },
      transform: d => d.licenses ?? [],
      enabled: !!familyId,
      showErrorToast: false,
    }
  )

  const licenseOptions = useMemo(
    () => [
      { value: '', label: 'Sin licencia vinculada' },
      ...licenses.map(l => ({
        value: l.id,
        label: l.vendor ? `${l.name} (${l.vendor})` : l.name,
      })),
    ],
    [licenses]
  )
  const contactName = watch('contactName')
  const contactEmail = watch('contactEmail')
  const contactPhone = watch('contactPhone')
  const termsUrl = watch('termsUrl')

  // Auto-rellenar datos de contacto cuando se selecciona un proveedor
  useEffect(() => {
    if (!selectedSupplierId || !suppliers.length) return

    const supplier = suppliers.find(s => s.id === selectedSupplierId)
    if (!supplier) return

    // Solo auto-rellenar si los campos están vacíos
    if (!contactName && supplier.contactName) {
      setValue('contactName', supplier.contactName)
    }
    if (!contactEmail && supplier.email) {
      setValue('contactEmail', supplier.email)
    }
    if (!contactPhone && supplier.phone) {
      setValue('contactPhone', supplier.phone)
    }
    if (!termsUrl && supplier.website) {
      setValue('termsUrl', supplier.website)
    }
  }, [selectedSupplierId, suppliers, contactName, contactEmail, contactPhone, termsUrl, setValue])

  const emptyToUndef = (v: string | null | undefined) => {
    if (v == null || v === '') return undefined
    return v
  }

  const onSubmit = async (data: ContractFormData) => {
    if (readOnly) return

    const start = emptyToUndef(data.startDate)
    const end = emptyToUndef(data.endDate)
    if (start && end && end < start) {
      toast({
        title: 'Fechas inválidas',
        description: 'La fecha de vencimiento no puede ser anterior al inicio.',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)
    try {
      const recurring = data.billingCycle !== 'ONE_TIME'
      const monthlyCost = parseMoneyInput(data.monthlyCost)
      const totalValue = parseMoneyInput(data.totalValue)
      // Payload limpio (sin spread de RHF) para evitar campos basura / ids de field-array
      const payload = {
        name: data.name.trim(),
        contractNumber: emptyToUndef(data.contractNumber),
        description: emptyToUndef(data.description),
        category: data.category,
        supplierId: emptyToUndef(data.supplierId),
        familyId: emptyToUndef(data.familyId),
        startDate: start,
        endDate: end,
        autoRenew: data.autoRenew,
        billingCycle: data.billingCycle,
        currency: data.currency,
        contactName: emptyToUndef(data.contactName),
        contactEmail: emptyToUndef(data.contactEmail),
        contactPhone: emptyToUndef(data.contactPhone),
        notes: emptyToUndef(data.notes),
        termsUrl: emptyToUndef(data.termsUrl),
        totalValue: !recurring ? totalValue : undefined,
        monthlyCost: recurring ? monthlyCost : undefined,
        renewalNoticeDays: Number(data.renewalNoticeDays) || 30,
        lastChargeDate: emptyToUndef(data.lastChargeDate),
        lastChargeAmount: parseMoneyInput(data.lastChargeAmount),
        lastTransactionRef: emptyToUndef(data.lastTransactionRef),
        cancellationNoticeDays: data.cancellationNoticeDays
          ? Number(data.cancellationNoticeDays)
          : undefined,
        serviceSubtype: emptyToUndef(data.serviceSubtype) ?? null,
        paymentMethodType: data.paymentMethodType,
        paymentAccountRef: emptyToUndef(data.paymentAccountRef) ?? null,
        custodianUserId: emptyToUndef(data.custodianUserId) ?? null,
        backupCustodianUserId: emptyToUndef(data.backupCustodianUserId) ?? null,
        billingAccountEmail: emptyToUndef(data.billingAccountEmail),
        billingPortalUrl: emptyToUndef(data.billingPortalUrl),
        vendorAccountId: emptyToUndef(data.vendorAccountId),
        paymentCardBrand: emptyToUndef(data.paymentCardBrand) ?? null,
        paymentCardLast4: emptyToUndef(data.paymentCardLast4) ?? null,
        paymentCardBank: emptyToUndef(data.paymentCardBank),
        paymentCardExpiry: emptyToUndef(data.paymentCardExpiry),
        corporateCardLabel: emptyToUndef(data.corporateCardLabel),
        subscriptionUsageStatus: data.subscriptionUsageStatus,
        lines: data.lines
          .filter(l => l.description?.trim())
          .map((l, i) => ({
            type: l.type || lineTypeForCategory(data.category),
            description: l.description.trim(),
            quantity: parseMoneyInput(l.quantity) ?? 1,
            unitPrice: parseMoneyInput(l.unitPrice),
            equipmentId: emptyToUndef(l.equipmentId),
            licenseId: emptyToUndef(l.licenseId),
            notes: emptyToUndef(l.notes),
            order: i,
          })),
      }

      const url = isEditing
        ? `/api/inventory/contracts/${contract!.id}`
        : '/api/inventory/contracts'
      const method = isEditing ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const fieldHint = err.field ? ` (${err.field})` : ''
        throw new Error((err.error ?? `Error ${res.status}`) + fieldHint)
      }

      const saved = await res.json()

      // Subir archivos pendientes
      if (pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          try {
            const fd = new FormData()
            fd.append('file', file)
            await fetch(`/api/inventory/contracts/${saved.id}/attachments`, {
              method: 'POST',
              body: fd,
            })
          } catch {
            // No bloquear si falla un adjunto individual
          }
        }
        setPendingFiles([])
      }

      toast({ title: isEditing ? 'Contrato actualizado' : 'Contrato creado' })
      clearDraft()
      onSuccess(saved)
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='space-y-4'>
      <FormDraftBanner
        visible={wasRestored}
        onDismiss={dismissRestoredBanner}
        onDiscard={() => {
          clearDraft()
          dismissRestoredBanner()
        }}
      />
      <p className='text-xs text-muted-foreground'>
        Empieza por <strong>Datos generales</strong>. Abre las demás secciones solo cuando las
        necesites; así el formulario no se siente sobrecargado.
      </p>
      <fieldset disabled={readOnly} className={readOnly ? 'space-y-4' : 'contents'}>
        {/* ── 1. Datos generales ──────────────────────────────────────────── */}
        <ContractFormSection
          title='1. Datos generales'
          description='Identificación del contrato y vínculo con área / proveedor.'
          collapsible={false}
        >
          <div className={formGrid}>
            <div className='space-y-1 lg:col-span-2'>
              <Label>
                Nombre del contrato <span className='text-destructive'>*</span>
              </Label>
              <Input
                {...register('name', { required: true })}
                placeholder='Ej: Arrendamiento servidores 2026'
              />
              {errors.name && <p className='text-xs text-destructive'>Requerido</p>}
            </div>

            <div className='space-y-1'>
              <Label>N° de contrato</Label>
              <Input {...register('contractNumber')} placeholder='Ej: CONT-2026-001' />
            </div>

            <div className='space-y-1'>
              <Label>
                Categoría <span className='text-destructive'>*</span>
              </Label>
              <Combobox
                value={watch('category')}
                onValueChange={v => {
                  // Nunca limpiar la categoría — si el Combobox envía '' (deselección) se ignora
                  if (v && v !== '') {
                    setValue('category', v as any)
                    // Renta de equipos: aviso típico de 120 días (solo al crear / si aún está en 30)
                    if (
                      v === 'EQUIPMENT_RENTAL' &&
                      !contract &&
                      Number(watch('renewalNoticeDays')) === 30
                    ) {
                      setValue('renewalNoticeDays', 120)
                    }
                  }
                }}
                options={categoryOptions}
                placeholder='Seleccionar categoría'
                searchPlaceholder='Buscar categoría...'
              />
            </div>

            {(selectedCategory === 'SERVICE' ||
              selectedCategory === 'SOFTWARE_LICENSE' ||
              selectedCategory === 'SUPPORT') && (
              <div className='space-y-1'>
                <Label>Tipo de servicio</Label>
                <Select
                  value={watch('serviceSubtype') || 'none'}
                  onValueChange={v =>
                    setValue(
                      'serviceSubtype',
                      v === 'none' ? '' : (v as ContractFormData['serviceSubtype'])
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Ej: Redes, IA, Canvas...' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='none'>Sin especificar</SelectItem>
                    {Object.entries(SUBSCRIPTION_SERVICE_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className='space-y-1'>
              <Label>Área / Familia</Label>
              <Combobox
                value={watch('familyId') || ''}
                onValueChange={v => setValue('familyId', v || '')}
                options={familyOptions}
                placeholder='Todas las áreas'
                searchPlaceholder='Buscar familia...'
                emptyText='No se encontraron familias'
              />
            </div>

            <div className='space-y-1'>
              <Label>Proveedor</Label>
              <Combobox
                value={watch('supplierId') || ''}
                onValueChange={v => setValue('supplierId', v || '')}
                options={supplierOptions}
                placeholder='Seleccionar proveedor'
                searchPlaceholder='Buscar proveedor...'
                emptyText='No se encontraron proveedores'
              />
            </div>

            <div className='sm:col-span-2 lg:col-span-3 space-y-1'>
              <Label>Descripción</Label>
              <Textarea
                {...register('description')}
                rows={2}
                placeholder='Descripción del contrato...'
              />
            </div>
          </div>
        </ContractFormSection>

        {/* ── 2. Vigencia y costos ────────────────────────────────────────── */}
        <ContractFormSection
          title='2. Vigencia y costos'
          description='Fechas, ciclo de facturación y monto según el ciclo (recurrente o pago único).'
          defaultOpen={false}
        >
          <div className={formGrid}>
            <div className='space-y-1'>
              <Label>Fecha de inicio</Label>
              <DateInput
                value={startDateValue}
                onChange={e =>
                  setValue('startDate', e.target.value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                clearable
              />
            </div>

            <div className='space-y-1'>
              <Label>Fecha de vencimiento</Label>
              <DateInput
                value={watch('endDate')}
                onChange={e =>
                  setValue('endDate', e.target.value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                clearable
                min={startDateValue || undefined}
              />
            </div>

            <div className='space-y-1'>
              <Label>Ciclo de facturación</Label>
              <Select
                value={billingCycle}
                onValueChange={v => {
                  if (!v) return
                  setValue('billingCycle', v as ContractFormData['billingCycle'])
                  // Evitar costos duplicados al cambiar entre recurrente y pago único
                  if (v === 'ONE_TIME') {
                    setValue('monthlyCost', '')
                  } else {
                    setValue('totalValue', '')
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(BILLING_CYCLE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className='space-y-1'>
              <Label>Moneda</Label>
              <Select value={watch('currency')} onValueChange={v => setValue('currency', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='USD'>USD — Dólar</SelectItem>
                  <SelectItem value='EUR'>EUR — Euro</SelectItem>
                  <SelectItem value='CLP'>CLP — Peso chileno</SelectItem>
                  <SelectItem value='MXN'>MXN — Peso mexicano</SelectItem>
                  <SelectItem value='COP'>COP — Peso colombiano</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isRecurringBilling ? (
              <div className='space-y-1'>
                <Label>{recurringCostLabel}</Label>
                <Input
                  type='text'
                  inputMode='decimal'
                  autoComplete='off'
                  {...register('monthlyCost')}
                  placeholder='0.00'
                />
                <p className='text-[10px] text-muted-foreground'>
                  Acepta punto o coma decimal (ej. 24.50 o 24,50).
                </p>
              </div>
            ) : (
              <div className='space-y-1'>
                <Label>Valor total del contrato</Label>
                <Input
                  type='text'
                  inputMode='decimal'
                  autoComplete='off'
                  {...register('totalValue')}
                  placeholder='0.00'
                />
                <p className='text-[10px] text-muted-foreground'>
                  Acepta punto o coma decimal (ej. 1200 o 1.200,00).
                </p>
              </div>
            )}

            <div className='flex items-center justify-between rounded-lg border p-3 sm:col-span-2 lg:col-span-3'>
              <div>
                <p className='text-sm font-medium'>Renovación automática</p>
                <p className='text-xs text-muted-foreground'>
                  El contrato se renueva automáticamente al vencer (notificación y auditoría
                  programadas).
                </p>
              </div>
              <Switch checked={autoRenew} onCheckedChange={v => setValue('autoRenew', v)} />
            </div>

            {(autoRenew || selectedCategory === 'EQUIPMENT_RENTAL') && (
              <div className='space-y-1'>
                <Label>
                  {selectedCategory === 'EQUIPMENT_RENTAL'
                    ? 'Días de aviso antes del fin de renta'
                    : 'Días de aviso antes de renovar'}
                </Label>
                <Input type='number' min='1' max='365' {...register('renewalNoticeDays')} />
                {selectedCategory === 'EQUIPMENT_RENTAL' && (
                  <p className='text-xs text-muted-foreground'>
                    Recomendado 120 días según contrato de arrendamiento (notificación al cliente).
                  </p>
                )}
              </div>
            )}
          </div>
        </ContractFormSection>

        {/* ── 3. Contacto ─────────────────────────────────────────────────── */}
        <ContractFormSection
          title='3. Contacto del proveedor'
          description='Se auto-completa con el proveedor seleccionado.'
          badge='Opcional'
          defaultOpen={false}
        >
          <div className={formGrid}>
            <div className='space-y-1'>
              <Label>Nombre</Label>
              <Input {...register('contactName')} placeholder='Nombre del contacto' />
            </div>
            <div className='space-y-1'>
              <Label>Email</Label>
              <Input
                type='email'
                {...register('contactEmail')}
                placeholder='contacto@proveedor.com'
              />
            </div>
            <div className='space-y-1'>
              <Label>Teléfono</Label>
              <Input {...register('contactPhone')} placeholder='+1-555-0123' />
            </div>
            <div className='sm:col-span-2 lg:col-span-3 space-y-1'>
              <Label>URL de términos / contrato</Label>
              <Input {...register('termsUrl')} placeholder='https://...' />
            </div>
          </div>
        </ContractFormSection>

        {/* ── 4. Facturación y responsables ───────────────────────────────── */}
        <ContractFormSection
          title='4. Facturación y responsables'
          description='Custodios, método de pago y trazabilidad de cargos (auditoría).'
          badge='Opcional'
          defaultOpen={false}
        >
          <div className={formGrid}>
            <div className='space-y-1 sm:col-span-2 lg:col-span-3'>
              <Label>Método de pago</Label>
              <Select
                value={paymentMethodType}
                onValueChange={v =>
                  setValue('paymentMethodType', v as ContractFormData['paymentMethodType'])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(paymentMethodType === 'PAYPAL' ||
              paymentMethodType === 'CRYPTO' ||
              paymentMethodType === 'BANK_TRANSFER' ||
              paymentMethodType === 'OTHER') && (
              <div className='space-y-1 sm:col-span-2 lg:col-span-3'>
                <Label>
                  {paymentMethodType === 'CRYPTO'
                    ? 'Dirección wallet / red'
                    : paymentMethodType === 'PAYPAL'
                      ? 'Email o ID PayPal'
                      : 'Cuenta / referencia de pago'}
                </Label>
                <Input
                  {...register('paymentAccountRef')}
                  placeholder={
                    paymentMethodType === 'CRYPTO'
                      ? '0x… o dirección + red (ETH, BTC…)'
                      : paymentMethodType === 'PAYPAL'
                        ? 'cuenta@empresa.com'
                        : 'N° cuenta, IBAN o alias'
                  }
                />
              </div>
            )}

            <div className='space-y-1'>
              <Label>Custodio principal</Label>
              <Combobox
                options={custodianOptions}
                value={watch('custodianUserId')}
                onValueChange={v => setValue('custodianUserId', v)}
                placeholder='Responsable del servicio...'
              />
            </div>
            <div className='space-y-1'>
              <Label>Custodio de respaldo</Label>
              <Combobox
                options={custodianOptions}
                value={watch('backupCustodianUserId')}
                onValueChange={v => setValue('backupCustodianUserId', v)}
                placeholder='Respaldo para offboarding...'
              />
            </div>
            <div className='space-y-1'>
              <Label>Email cuenta de facturación</Label>
              <Input
                type='email'
                {...register('billingAccountEmail')}
                placeholder='portal@proveedor.com'
              />
            </div>
            <div className='space-y-1'>
              <Label>URL portal de facturación</Label>
              <Input {...register('billingPortalUrl')} placeholder='https://billing...' />
            </div>
            <div className='space-y-1'>
              <Label>ID cuenta en proveedor</Label>
              <Input {...register('vendorAccountId')} placeholder='Opcional' />
            </div>

            {paymentMethodType === 'CORPORATE_CARD' && (
              <>
                <div className='space-y-1'>
                  <Label>Etiqueta tarjeta corporativa</Label>
                  <Input {...register('corporateCardLabel')} placeholder='Ej: Marketing Corp' />
                </div>
                <div className='space-y-1'>
                  <Label>Marca de tarjeta</Label>
                  <Select
                    value={watch('paymentCardBrand') || 'none'}
                    onValueChange={v =>
                      setValue(
                        'paymentCardBrand',
                        v === 'none' ? '' : (v as ContractFormData['paymentCardBrand'])
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder='Seleccionar' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='none'>Sin especificar</SelectItem>
                      {Object.entries(PAYMENT_CARD_BRAND_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-1'>
                  <Label>Últimos 4 dígitos</Label>
                  <Input {...register('paymentCardLast4')} maxLength={4} placeholder='1234' />
                </div>
                <div className='space-y-1'>
                  <Label>Banco / entidad</Label>
                  <Input {...register('paymentCardBank')} placeholder='Ej: Banco Estado' />
                </div>
                <div className='space-y-1'>
                  <Label>Vencimiento tarjeta (MM/YYYY)</Label>
                  <Input {...register('paymentCardExpiry')} placeholder='12/2027' />
                </div>
              </>
            )}
            <div className='space-y-1'>
              <Label>Estado de uso</Label>
              <Select
                value={watch('subscriptionUsageStatus')}
                onValueChange={v =>
                  setValue(
                    'subscriptionUsageStatus',
                    v as ContractFormData['subscriptionUsageStatus']
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SUBSCRIPTION_USAGE_STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1'>
              <Label>Días aviso de cancelación</Label>
              <Input
                type='number'
                min='0'
                {...register('cancellationNoticeDays')}
                placeholder='30'
              />
            </div>
            <div className='space-y-1'>
              <Label>Último cargo (fecha)</Label>
              <DateInput
                value={watch('lastChargeDate')}
                onChange={e =>
                  setValue('lastChargeDate', e.target.value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                clearable
              />
            </div>
            <div className='space-y-1'>
              <Label>Último cargo (monto)</Label>
              <Input
                type='text'
                inputMode='decimal'
                autoComplete='off'
                {...register('lastChargeAmount')}
                placeholder='0.00'
              />
            </div>
            <div className='sm:col-span-2 lg:col-span-3 space-y-1'>
              <Label>Referencia última transacción</Label>
              <Input {...register('lastTransactionRef')} placeholder='ID transacción bancaria' />
            </div>
          </div>
        </ContractFormSection>

        {/* ── 5. Líneas del contrato ──────────────────────────────────────── */}
        <ContractFormSection
          title='5. Líneas adicionales'
          description={
            embedMode
              ? 'El activo que estás creando se vinculará al guardar. Aquí solo agrega otros ítems del mismo contrato.'
              : 'Ítems del contrato (equipos, software, servicios). No duplica la categoría del contrato.'
          }
          defaultOpen={false}
          badge='Opcional'
        >
          <div className='space-y-3'>
            {embedMode && (
              <p className='text-xs rounded-md border border-dashed px-3 py-2 text-muted-foreground'>
                La categoría en Datos generales ya define el tipo de contrato. No hace falta repetir
                «Software» / «Licencia de software» aquí: al guardar el activo se crea el vínculo
                automáticamente.
              </p>
            )}
            <div className='flex justify-end'>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() =>
                  append({
                    ...EMPTY_LINE,
                    type: lineTypeForCategory(selectedCategory),
                    description: watch('name')?.trim()
                      ? `${watch('name').trim()} (ítem adicional)`
                      : '',
                    unitPrice:
                      billingCycle !== 'ONE_TIME'
                        ? watch('monthlyCost') || ''
                        : watch('totalValue') || '',
                    order: fields.length,
                  })
                }
                disabled={readOnly}
              >
                <Plus className='h-4 w-4 mr-1' /> Agregar ítem
              </Button>
            </div>
            {fields.length === 0 && (
              <p className='text-sm text-muted-foreground text-center py-4'>
                {embedMode
                  ? 'Sin ítems adicionales. Puedes crear el contrato y vincular el activo al guardar.'
                  : 'Sin líneas. Agrega ítems incluidos en este contrato si aplica.'}
              </p>
            )}
            {fields.map((field, i) => (
              <div key={field.id} className='rounded-lg border p-3 space-y-3'>
                <div className='flex items-center justify-between'>
                  <span className='text-xs font-medium text-muted-foreground'>Línea {i + 1}</span>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => remove(i)}
                    disabled={readOnly}
                    className='h-7 w-7 p-0 text-destructive hover:text-destructive'
                  >
                    <Trash2 className='h-3.5 w-3.5' />
                  </Button>
                </div>
                <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
                  <div className='space-y-1'>
                    <Label className='text-xs'>Tipo</Label>
                    <Select
                      value={watch(`lines.${i}.type`)}
                      onValueChange={v => setValue(`lines.${i}.type`, v as any)}
                    >
                      <SelectTrigger className='h-8 text-sm'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CONTRACT_LINE_TYPE_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className='sm:col-span-2 space-y-1'>
                    <Label className='text-xs'>
                      Descripción <span className='text-destructive'>*</span>
                    </Label>
                    <Input
                      className='h-8 text-sm'
                      {...register(`lines.${i}.description`)}
                      placeholder='Ej: Servidor Dell rack 2U — no repetir la categoría'
                    />
                  </div>
                  <div className='space-y-1'>
                    <Label className='text-xs'>Cantidad</Label>
                    <Input
                      className='h-8 text-sm'
                      type='number'
                      min='0'
                      step='0.01'
                      {...register(`lines.${i}.quantity`)}
                      placeholder='1'
                    />
                  </div>
                  <div className='space-y-1'>
                    <Label className='text-xs'>Precio unitario</Label>
                    <Input
                      className='h-8 text-sm'
                      type='text'
                      inputMode='decimal'
                      autoComplete='off'
                      {...register(`lines.${i}.unitPrice`)}
                      placeholder='0.00'
                    />
                  </div>
                  <div className='space-y-1'>
                    <Label className='text-xs'>Notas</Label>
                    <Input
                      className='h-8 text-sm'
                      {...register(`lines.${i}.notes`)}
                      placeholder='Opcional'
                    />
                  </div>
                  {watch(`lines.${i}.type`) === 'SOFTWARE' && (
                    <div className='sm:col-span-3 space-y-1'>
                      <Label className='text-xs'>Licencia vinculada</Label>
                      <Combobox
                        value={watch(`lines.${i}.licenseId`) || ''}
                        onValueChange={v => setValue(`lines.${i}.licenseId`, v || '')}
                        options={licenseOptions}
                        placeholder={familyId ? 'Seleccionar licencia' : 'Asigna un área primero'}
                        searchPlaceholder='Buscar licencia...'
                        emptyText={
                          familyId ? 'No hay licencias en esta área' : 'Selecciona un área'
                        }
                        disabled={!familyId}
                      />
                      <p className='text-[10px] text-muted-foreground'>
                        Al guardar, sincroniza vigencia y costo de renovación con el contrato.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ContractFormSection>

        {/* ── 6. Documentos ───────────────────────────────────────────────── */}
        <ContractFormSection
          title='6. Documentos adjuntos'
          description='Contrato físico en PDF u otros documentos relacionados.'
          badge='Opcional'
          defaultOpen={false}
        >
          <div className='space-y-4'>
            {/* Adjuntos existentes (solo en edición) */}
            {isEditing && existingAttachments.length > 0 && (
              <div className='space-y-2'>
                <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
                  Archivos guardados ({existingAttachments.length})
                </p>
                <ul className='space-y-1.5'>
                  {existingAttachments.map(att => (
                    <li
                      key={att.id}
                      className='flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm'
                    >
                      <FileText className='h-3.5 w-3.5 shrink-0 text-muted-foreground' />
                      <span className='flex-1 truncate text-foreground'>{att.originalName}</span>
                      <span className='shrink-0 text-xs text-muted-foreground'>
                        {formatSize(att.size)}
                      </span>
                      <a
                        href={att.path}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='shrink-0 rounded p-0.5 hover:bg-muted'
                        title='Descargar'
                      >
                        <Download className='h-3.5 w-3.5 text-muted-foreground' />
                      </a>
                      <button
                        type='button'
                        title='Eliminar adjunto'
                        disabled={deletingAttachmentId === att.id}
                        onClick={() => handleDeleteAttachment(att.id)}
                        className='shrink-0 rounded p-0.5 hover:bg-muted disabled:opacity-50'
                      >
                        <X className='h-3.5 w-3.5 text-muted-foreground hover:text-destructive' />
                      </button>
                    </li>
                  ))}
                </ul>
                <Separator />
              </div>
            )}

            {/* Subir nuevos archivos */}
            <FileUploadZone
              files={pendingFiles}
              onChange={setPendingFiles}
              maxFileSizeMB={maxFileSize}
              label={isEditing ? 'Agregar nuevos documentos' : 'Documentos del contrato'}
              accept='application/pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png'
              onSizeError={(name, max) =>
                toast({
                  title: 'Archivo muy grande',
                  description: `"${name}" supera ${max}MB`,
                  variant: 'destructive',
                })
              }
            />
            {!isEditing && pendingFiles.length > 0 && (
              <p className='text-xs text-muted-foreground'>
                Los archivos se subirán al guardar el contrato.
              </p>
            )}
          </div>
        </ContractFormSection>
      </fieldset>

      {!isEditing && embedMode && (
        <p className='text-xs text-muted-foreground rounded-md border border-dashed px-3 py-2'>
          Al crear y vincular, el contrato queda en borrador con auditoría. Al guardar el activo se
          activa el vínculo (líneas equipo/licencia). Adendums, asignaciones y pagos se gestionan
          después con <strong>Completar</strong> o desde Contratos.
        </p>
      )}

      {isEditing && contract?.id && (
        <>
          <ContractAmendmentsPanel
            contractId={contract.id}
            canManage={!readOnly}
            onContractUpdated={() => {
              fetch(`/api/inventory/contracts/${contract.id}`)
                .then(r => (r.ok ? r.json() : null))
                .then(d => {
                  if (d) onSuccess(d)
                })
                .catch(() => {})
            }}
          />
          <ContractAssignmentsPanel contract={contract} canManage={!readOnly} />
          {!readOnly && (
            <ContractPaymentsPanel
              contractId={contract.id}
              hasBillingDates={!!(contract.startDate && contract.endDate)}
            />
          )}
        </>
      )}

      {/* ── 7. Notas ─────────────────────────────────────────────────────── */}
      <fieldset disabled={readOnly} className={readOnly ? 'block' : 'contents'}>
        <ContractFormSection
          title='7. Notas internas'
          badge='Opcional'
          defaultOpen={false}
        >
          <div className='space-y-1'>
            <Label>Notas</Label>
            <Textarea
              {...register('notes')}
              rows={3}
              placeholder='Observaciones, condiciones especiales...'
            />
          </div>
        </ContractFormSection>
      </fieldset>

      {/* ── Acciones ────────────────────────────────────────────────────── */}
      <div className='sticky bottom-0 z-10 flex justify-end gap-3 pt-3 pb-1 bg-background/95 backdrop-blur border-t mt-2'>
        <Button type='button' variant='outline' onClick={onCancel} disabled={submitting}>
          {readOnly || embedMode ? 'Volver' : 'Cancelar'}
        </Button>
        {!readOnly && (
          <Button type='submit' disabled={submitting}>
            {submitting && <RefreshCw className='h-4 w-4 mr-2 animate-spin' />}
            {embedMode
              ? isEditing
                ? 'Guardar y volver'
                : 'Crear y vincular'
              : isEditing
                ? 'Guardar cambios'
                : 'Crear contrato'}
          </Button>
        )}
      </div>
    </form>
  )
}
