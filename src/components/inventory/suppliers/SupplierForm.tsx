'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { InlineCreateSelect } from '@/components/ui/inline-create-select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { CatalogTypeInlineForm } from '@/components/inventory/asset-forms/CatalogTypeInlineForm'
import { ContractFormSection } from '@/components/contracts/contract-form-section'
import { FormDraftBanner } from '@/components/common/form-draft-banner'
import { inlineSelectFeedback } from '@/lib/utils/inline-select-feedback'
import { isDirectFormSubmit } from '@/lib/utils/inline-form-guard'
import { useFormSubmit } from '@/hooks/common/use-form-submit'
import { FormDraftKeys, useFormDraft } from '@/hooks/common/use-form-draft'
import { inventoryToast } from '@/lib/utils/inventory-toast'
import { useFetch } from '@/hooks/common/use-fetch'
import { useFamilyOptions } from '@/hooks/use-family-options'
import {
  supplierFormSchema,
  SUPPLIER_PAYMENT_TERMS_OPTIONS,
  SUPPLIER_BANK_ACCOUNT_TYPE_LABELS,
  SUPPLIER_BANK_ACCOUNT_TYPES,
  type SupplierFormInput,
} from '@/lib/validations/inventory/supplier'
import { PAYMENT_METHOD_TYPE_LABELS } from '@/types/contracts'
import type { Supplier } from '@/types/inventory/supplier'

type SupplierDraft = SupplierFormInput & {
  typeId: string
  familyId: string
}

interface SupplierType {
  id: string
  name: string
  description?: string
}

interface SupplierFormProps {
  supplier?: Supplier | null
  /** Si se pasa, pre-selecciona la familia y filtra tipos de proveedor */
  defaultFamilyId?: string
  /** Dentro de SupplierSelect: el padre muestra el toast contextual */
  embedded?: boolean
  onSuccess?: (supplier: Supplier) => void
  onCancel?: () => void
  /** Avisa al padre si hay cambios sin guardar (modal / Escape). */
  onDirtyChange?: (dirty: boolean) => void
}

export function SupplierForm({
  supplier,
  defaultFamilyId,
  embedded = false,
  onSuccess,
  onCancel,
  onDirtyChange,
}: SupplierFormProps) {
  const isEdit = !!supplier?.id
  const initialTypeId = supplier?.typeId ?? ''
  const initialFamilyId = supplier?.familyId ?? defaultFamilyId ?? ''
  const [typeId, setTypeId] = useState<string>(initialTypeId)
  const [familyId, setFamilyId] = useState<string>(initialFamilyId)

  const { families } = useFamilyOptions()

  const { data: supplierTypes, setData: setSupplierTypes } = useFetch<SupplierType>(
    '/api/inventory/supplier-types',
    { params: familyId ? { familyId } : undefined, showErrorToast: false }
  )

  const clearDraftRef = useRef<(() => void) | null>(null)

  const { submit, loading } = useFormSubmit(
    isEdit ? `/api/inventory/suppliers/${supplier!.id}` : '/api/inventory/suppliers',
    {
      method: isEdit ? 'PUT' : 'POST',
      silentSuccess: true,
      onSuccess: data => {
        clearDraftRef.current?.()
        if (!embedded) {
          inventoryToast({
            title: isEdit ? 'Proveedor actualizado' : 'Proveedor creado',
            description: data?.name,
          })
        }
        onSuccess?.(data)
      },
    }
  )

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    getValues,
    formState: { errors, isDirty },
  } = useForm<SupplierFormInput>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: {
      name: supplier?.name || '',
      legalName: supplier?.legalName || '',
      typeId: supplier?.typeId || '',
      familyId: supplier?.familyId || '',
      taxId: supplier?.taxId || '',
      email: supplier?.email || '',
      phone: supplier?.phone || '',
      address: supplier?.address || '',
      city: supplier?.city || '',
      country: supplier?.country || '',
      website: supplier?.website || '',
      contactName: supplier?.contactName || '',
      paymentTermsDays:
        supplier?.paymentTermsDays != null ? Number(supplier.paymentTermsDays) : null,
      creditLimit: (supplier?.creditLimit != null ? String(supplier.creditLimit) : '') as never,
      creditCurrency: supplier?.creditCurrency || 'USD',
      preferredPaymentMethod:
        (supplier?.preferredPaymentMethod as SupplierFormInput['preferredPaymentMethod']) || null,
      bankName: supplier?.bankName || '',
      bankAccountNumber: supplier?.bankAccountNumber || '',
      bankAccountType: (supplier?.bankAccountType as SupplierFormInput['bankAccountType']) || null,
      bankSwift: supplier?.bankSwift || '',
      notes: supplier?.notes || '',
    },
  })

  const watched = watch()
  const paymentTermsDays = watched.paymentTermsDays
  const creditCurrency = watched.creditCurrency
  const preferredPaymentMethod = watched.preferredPaymentMethod
  const bankAccountType = watched.bankAccountType

  const draftKey = isEdit
    ? FormDraftKeys.supplierEdit(supplier!.id)
    : FormDraftKeys.supplierNew(defaultFamilyId || familyId || 'global')

  const draftSnapshot = useMemo(
    (): SupplierDraft => ({
      ...watched,
      typeId,
      familyId,
      creditLimit: (watched.creditLimit ?? '') as never,
    }),
    [watched, typeId, familyId]
  )

  const { clearDraft, wasRestored, dismissRestoredBanner } = useFormDraft({
    key: draftKey,
    values: draftSnapshot as unknown as Record<string, unknown>,
    enabled: !loading,
    onRestore: data => {
      const d = data as SupplierDraft
      const { typeId: draftTypeId, familyId: draftFamilyId, ...formFields } = d
      reset({
        ...getValues(),
        ...formFields,
        creditLimit: (formFields.creditLimit != null ? String(formFields.creditLimit) : '') as never,
      })
      if (typeof draftTypeId === 'string') setTypeId(draftTypeId)
      if (typeof draftFamilyId === 'string') setFamilyId(draftFamilyId)
    },
  })

  clearDraftRef.current = clearDraft

  const extrasDirty = typeId !== initialTypeId || familyId !== initialFamilyId
  const dirty = isDirty || extrasDirty

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  useEffect(() => {
    return () => onDirtyChange?.(false)
  }, [onDirtyChange])

  const onSubmit = async (data: SupplierFormInput) => {
    await submit({
      ...data,
      typeId: typeId || null,
      familyId: familyId || null,
      creditLimit:
        data.creditLimit === null || data.creditLimit === undefined ? null : data.creditLimit,
    })
  }

  const grid = 'grid grid-cols-1 sm:grid-cols-2 gap-4'

  return (
    <form
      onSubmit={e => {
        if (!isDirectFormSubmit(e)) return
        e.stopPropagation()
        handleSubmit(onSubmit)(e)
      }}
      className='space-y-4'
    >
      <FormDraftBanner
        visible={wasRestored}
        onDismiss={dismissRestoredBanner}
        onDiscard={() => {
          clearDraft()
          dismissRestoredBanner()
        }}
      />

      <p className='text-xs text-muted-foreground'>
        Maestro de proveedor para inventario y contratos. Los pagos y facturas puntuales viven en el
        contrato; aquí defines identidad, contacto, crédito y datos bancarios de referencia.
      </p>

      <ContractFormSection
        title='1. Identidad'
        description='Nombre comercial, razón social, RUC y alcance.'
        collapsible={false}
      >
        <div className={grid}>
          <div className='sm:col-span-2 space-y-1'>
            <Label htmlFor='name'>
              Nombre comercial <span className='text-destructive'>*</span>
            </Label>
            <Input id='name' {...register('name')} placeholder='Ej: Dell Technologies' />
            {errors.name && <p className='text-xs text-destructive'>{errors.name.message}</p>}
          </div>

          <div className='sm:col-span-2 space-y-1'>
            <Label htmlFor='legalName'>
              Razón social{' '}
              <span className='text-xs font-normal text-muted-foreground'>(opcional)</span>
            </Label>
            <Input
              id='legalName'
              {...register('legalName')}
              placeholder='Nombre legal registrado'
            />
          </div>

          <div className='space-y-1'>
            <Label>
              Familia / área{' '}
              <span className='text-xs font-normal text-muted-foreground'>
                (vacío = global)
              </span>
            </Label>
            <SearchableSelect
              options={families}
              value={familyId}
              onChange={setFamilyId}
              placeholder='Global (todas las familias)'
            />
            <p className='text-xs text-muted-foreground'>
              Sin familia: visible para todos. Con familia: prioridad al crear activos de esa área.
            </p>
          </div>

          <div className='space-y-1'>
            <Label>Tipo de proveedor</Label>
            <InlineCreateSelect
              options={supplierTypes}
              value={typeId}
              onChange={setTypeId}
              placeholder='Seleccionar tipo...'
              allowClear
              createLabel='Crear tipo de proveedor'
              createTitle='Nuevo tipo de proveedor'
              editTitle='Editar tipo de proveedor'
              deleteConfirmMessage='¿Eliminar este tipo? Si tiene proveedores asociados, se desactivará.'
              {...inlineSelectFeedback('Tipo de proveedor')}
              createForm={({ item, onSuccess: onTypeSuccess, onCancel: onTypeCancel }) => (
                <CatalogTypeInlineForm
                  apiEndpoint='/api/inventory/supplier-types'
                  familyId={familyId || undefined}
                  item={item}
                  onSuccess={newItem => {
                    if (item)
                      setSupplierTypes(prev => prev.map(t => (t.id === newItem.id ? newItem : t)))
                    else setSupplierTypes(prev => [...prev, newItem])
                    onTypeSuccess(newItem)
                  }}
                  onCancel={onTypeCancel}
                />
              )}
              onDelete={async id => {
                const res = await fetch(`/api/inventory/supplier-types/${id}`, { method: 'DELETE' })
                if (!res.ok) {
                  const d = await res.json()
                  throw new Error(d.error || 'Error')
                }
                setSupplierTypes(prev => prev.filter(t => t.id !== id))
              }}
            />
          </div>

          <div className='space-y-1'>
            <Label htmlFor='taxId'>RUC / NIT</Label>
            <Input id='taxId' {...register('taxId')} placeholder='Ej: 1234567890001' maxLength={20} />
          </div>
        </div>
      </ContractFormSection>

      <ContractFormSection
        title='2. Contacto y ubicación'
        description='Datos para comunicación y facturación. Se reutilizan al crear contratos.'
        defaultOpen={!embedded}
      >
        <div className={grid}>
          <div className='space-y-1'>
            <Label htmlFor='contactName'>Nombre del contacto</Label>
            <Input
              id='contactName'
              {...register('contactName')}
              placeholder='Representante o cuenta'
            />
          </div>
          <div className='space-y-1'>
            <Label htmlFor='email'>Email</Label>
            <Input
              id='email'
              type='email'
              {...register('email')}
              placeholder='contacto@empresa.com'
            />
            {errors.email && <p className='text-xs text-destructive'>{errors.email.message}</p>}
          </div>
          <div className='space-y-1'>
            <Label htmlFor='phone'>Teléfono</Label>
            <Input id='phone' {...register('phone')} placeholder='+593 99 999 9999' />
          </div>
          <div className='space-y-1'>
            <Label htmlFor='website'>Sitio web / portal</Label>
            <Input id='website' {...register('website')} placeholder='https://empresa.com' />
            {errors.website && (
              <p className='text-xs text-destructive'>{String(errors.website.message)}</p>
            )}
          </div>
          <div className='sm:col-span-2 space-y-1'>
            <Label htmlFor='address'>Dirección</Label>
            <Input id='address' {...register('address')} placeholder='Calle, número, referencia' />
          </div>
          <div className='space-y-1'>
            <Label htmlFor='city'>Ciudad</Label>
            <Input id='city' {...register('city')} placeholder='Ciudad' />
          </div>
          <div className='space-y-1'>
            <Label htmlFor='country'>País</Label>
            <Input id='country' {...register('country')} placeholder='País' />
          </div>
        </div>
      </ContractFormSection>

      <ContractFormSection
        title='3. Crédito y condiciones de pago'
        description='Referencia comercial (no es un ledger AP). Útil al negociar contratos y órdenes.'
        badge='Comercial'
        defaultOpen={false}
      >
        <div className={grid}>
          <div className='space-y-1'>
            <Label>Plazo de pago habitual</Label>
            <Select
              value={paymentTermsDays == null ? 'none' : String(paymentTermsDays)}
              onValueChange={v =>
                setValue('paymentTermsDays', v === 'none' ? null : Number(v), {
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder='Sin especificar' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='none'>Sin especificar</SelectItem>
                {SUPPLIER_PAYMENT_TERMS_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={String(o.value)}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-1'>
            <Label>Método de pago preferido</Label>
            <Select
              value={preferredPaymentMethod || 'none'}
              onValueChange={v =>
                setValue(
                  'preferredPaymentMethod',
                  v === 'none' ? null : (v as SupplierFormInput['preferredPaymentMethod']),
                  { shouldDirty: true }
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder='Sin especificar' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='none'>Sin especificar</SelectItem>
                {Object.entries(PAYMENT_METHOD_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className='text-xs text-muted-foreground'>
              Mismo catálogo que en contratos (transferencia, factura proveedor, tarjeta, etc.).
            </p>
          </div>

          <div className='space-y-1'>
            <Label htmlFor='creditLimit'>Límite de crédito</Label>
            <Input
              id='creditLimit'
              type='text'
              inputMode='decimal'
              autoComplete='off'
              {...register('creditLimit')}
              placeholder='0.00'
            />
            {errors.creditLimit && (
              <p className='text-xs text-destructive'>{String(errors.creditLimit.message)}</p>
            )}
          </div>

          <div className='space-y-1'>
            <Label>Moneda del crédito</Label>
            <Select
              value={creditCurrency || 'USD'}
              onValueChange={v => setValue('creditCurrency', v, { shouldDirty: true })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='USD'>USD</SelectItem>
                <SelectItem value='EUR'>EUR</SelectItem>
                <SelectItem value='CLP'>CLP</SelectItem>
                <SelectItem value='MXN'>MXN</SelectItem>
                <SelectItem value='COP'>COP</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </ContractFormSection>

      <ContractFormSection
        title='4. Datos bancarios'
        description='Referencia para transferencias. No almacena tarjetas (eso va en el contrato).'
        badge='Opcional'
        defaultOpen={false}
      >
        <div className={grid}>
          <div className='space-y-1'>
            <Label htmlFor='bankName'>Banco</Label>
            <Input id='bankName' {...register('bankName')} placeholder='Nombre del banco' />
          </div>
          <div className='space-y-1'>
            <Label>Tipo de cuenta</Label>
            <Select
              value={bankAccountType || 'none'}
              onValueChange={v =>
                setValue(
                  'bankAccountType',
                  v === 'none' ? null : (v as SupplierFormInput['bankAccountType']),
                  { shouldDirty: true }
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder='Sin especificar' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='none'>Sin especificar</SelectItem>
                {SUPPLIER_BANK_ACCOUNT_TYPES.map(k => (
                  <SelectItem key={k} value={k}>
                    {SUPPLIER_BANK_ACCOUNT_TYPE_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-1'>
            <Label htmlFor='bankAccountNumber'>N° de cuenta / IBAN</Label>
            <Input
              id='bankAccountNumber'
              {...register('bankAccountNumber')}
              placeholder='Cuenta o IBAN'
            />
          </div>
          <div className='space-y-1'>
            <Label htmlFor='bankSwift'>SWIFT / BIC</Label>
            <Input id='bankSwift' {...register('bankSwift')} placeholder='Opcional' />
          </div>
        </div>
      </ContractFormSection>

      <ContractFormSection
        title='5. Notas internas'
        badge='Opcional'
        defaultOpen={false}
      >
        <div className='space-y-1'>
          <Label htmlFor='notes'>Observaciones</Label>
          <Textarea
            id='notes'
            {...register('notes')}
            rows={3}
            placeholder='Condiciones especiales, contactos adicionales, historial…'
          />
        </div>
      </ContractFormSection>

      <div className='flex justify-end gap-2 pt-2 sticky bottom-0 bg-background/95 backdrop-blur border-t py-3'>
        {onCancel && (
          <Button type='button' variant='outline' onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
        )}
        <Button type='submit' disabled={loading}>
          {loading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
          {isEdit ? 'Guardar cambios' : 'Crear proveedor'}
        </Button>
      </div>
    </form>
  )
}
