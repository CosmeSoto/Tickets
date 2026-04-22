'use client'

import { useState, useEffect, useMemo } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { Plus, Trash2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { useInventoryFamilies } from '@/contexts/families-context'
import { useFetch } from '@/hooks/common/use-fetch'
import {
  CONTRACT_CATEGORY_LABELS,
  CONTRACT_LINE_TYPE_LABELS,
  BILLING_CYCLE_LABELS,
  type Contract,
  type ContractFormData,
} from '@/types/contracts'

interface Props {
  contract?: Contract | null
  onSuccess: (contract: Contract) => void
  onCancel: () => void
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

export function ContractForm({ contract, onSuccess, onCancel }: Props) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const isEditing = !!contract

  const { families: rawFamilies } = useInventoryFamilies()
  
  // Memoizar las opciones para evitar recalcular en cada render
  const familyOptions = useMemo(() => [
    { value: '', label: 'Sin área específica' },
    ...rawFamilies.map(f => ({
      value: f.id,
      label: f.name,
      color: f.color || undefined,
    }))
  ], [rawFamilies])

  const { data: suppliers } = useFetch<{ 
    id: string
    name: string
    email?: string | null
    phone?: string | null
    contactName?: string | null
    website?: string | null
  }>(
    '/api/inventory/suppliers',
    { params: { active: 'true', limit: 500 }, transform: d => d.suppliers ?? d ?? [] }
  )

  const supplierOptions = useMemo(() => [
    { value: '', label: 'Sin proveedor' },
    ...suppliers.map(s => ({
      value: s.id,
      label: s.name,
    }))
  ], [suppliers])

  const categoryOptions = useMemo(() => 
    Object.entries(CONTRACT_CATEGORY_LABELS).map(([k, v]) => ({
      value: k,
      label: v,
    }))
  , [])

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<ContractFormData>({
    defaultValues: {
      contractNumber:    contract?.contractNumber    ?? '',
      name:              contract?.name              ?? '',
      description:       contract?.description       ?? '',
      category:          contract?.category          ?? 'SERVICE',
      supplierId:        contract?.supplierId        ?? '',
      familyId:          contract?.familyId          ?? '',
      startDate:         contract?.startDate ? contract.startDate.slice(0, 10) : '',
      endDate:           contract?.endDate   ? contract.endDate.slice(0, 10)   : '',
      autoRenew:         contract?.autoRenew         ?? false,
      renewalNoticeDays: contract?.renewalNoticeDays ?? 30,
      billingCycle:      contract?.billingCycle      ?? 'MONTHLY',
      totalValue:        contract?.totalValue  != null ? String(contract.totalValue)  : '',
      monthlyCost:       contract?.monthlyCost != null ? String(contract.monthlyCost) : '',
      currency:          contract?.currency          ?? 'USD',
      contactName:       contract?.contactName       ?? '',
      contactEmail:      contract?.contactEmail      ?? '',
      contactPhone:      contract?.contactPhone      ?? '',
      notes:             contract?.notes             ?? '',
      termsUrl:          contract?.termsUrl          ?? '',
      lines: contract?.lines?.map(l => ({
        id:          l.id,
        type:        l.type,
        description: l.description,
        quantity:    String(l.quantity),
        unitPrice:   l.unitPrice != null ? String(l.unitPrice) : '',
        equipmentId: l.equipmentId ?? '',
        licenseId:   l.licenseId   ?? '',
        notes:       l.notes       ?? '',
        order:       l.order,
      })) ?? [],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' })
  const autoRenew = watch('autoRenew')
  const selectedSupplierId = watch('supplierId')
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

  const onSubmit = async (data: ContractFormData) => {
    setSubmitting(true)
    try {
      const payload = {
        ...data,
        totalValue:  data.totalValue  ? parseFloat(data.totalValue)  : undefined,
        monthlyCost: data.monthlyCost ? parseFloat(data.monthlyCost) : undefined,
        renewalNoticeDays: Number(data.renewalNoticeDays),
        lines: data.lines.map((l, i) => ({
          ...l,
          quantity:  parseFloat(l.quantity) || 1,
          unitPrice: l.unitPrice ? parseFloat(l.unitPrice) : undefined,
          order:     i,
        })),
      }

      const url    = isEditing ? `/api/contracts/${contract!.id}` : '/api/contracts'
      const method = isEditing ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Error al guardar')
      }

      const saved = await res.json()
      toast({ title: isEditing ? 'Contrato actualizado' : 'Contrato creado' })
      onSuccess(saved)
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

      {/* ── Datos generales ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader><CardTitle className="text-base">Datos generales</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <div className="space-y-1">
            <Label>Nombre del contrato <span className="text-destructive">*</span></Label>
            <Input {...register('name', { required: true })} placeholder="Ej: Arrendamiento servidores 2026" />
            {errors.name && <p className="text-xs text-destructive">Requerido</p>}
          </div>

          <div className="space-y-1">
            <Label>N° de contrato</Label>
            <Input {...register('contractNumber')} placeholder="Ej: CONT-2026-001" />
          </div>

          <div className="space-y-1">
            <Label>Categoría <span className="text-destructive">*</span></Label>
            <Combobox
              value={watch('category')}
              onValueChange={v => setValue('category', v as any)}
              options={categoryOptions}
              placeholder="Seleccionar categoría"
              searchPlaceholder="Buscar categoría..."
            />
          </div>

          <div className="space-y-1">
            <Label>Área / Familia</Label>
            <Combobox
              value={watch('familyId') || ''}
              onValueChange={v => setValue('familyId', v || '')}
              options={familyOptions}
              placeholder="Todas las áreas"
              searchPlaceholder="Buscar familia..."
              emptyText="No se encontraron familias"
            />
          </div>

          <div className="space-y-1">
            <Label>Proveedor</Label>
            <Combobox
              value={watch('supplierId') || ''}
              onValueChange={v => setValue('supplierId', v || '')}
              options={supplierOptions}
              placeholder="Seleccionar proveedor"
              searchPlaceholder="Buscar proveedor..."
              emptyText="No se encontraron proveedores"
            />
          </div>

          <div className="sm:col-span-2 space-y-1">
            <Label>Descripción</Label>
            <Textarea {...register('description')} rows={2} placeholder="Descripción del contrato..." />
          </div>
        </CardContent>
      </Card>

      {/* ── Vigencia y facturación ──────────────────────────────────────── */}
      <Card>
        <CardHeader><CardTitle className="text-base">Vigencia y facturación</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <div className="space-y-1">
            <Label>Fecha de inicio</Label>
            <Input type="date" {...register('startDate')} />
          </div>

          <div className="space-y-1">
            <Label>Fecha de vencimiento</Label>
            <Input type="date" {...register('endDate')} />
          </div>

          <div className="space-y-1">
            <Label>Ciclo de facturación</Label>
            <Select value={watch('billingCycle')} onValueChange={v => setValue('billingCycle', v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(BILLING_CYCLE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Moneda</Label>
            <Select value={watch('currency')} onValueChange={v => setValue('currency', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD — Dólar</SelectItem>
                <SelectItem value="EUR">EUR — Euro</SelectItem>
                <SelectItem value="CLP">CLP — Peso chileno</SelectItem>
                <SelectItem value="MXN">MXN — Peso mexicano</SelectItem>
                <SelectItem value="COP">COP — Peso colombiano</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Costo mensual</Label>
            <Input type="number" min="0" step="0.01" {...register('monthlyCost')} placeholder="0.00" />
          </div>

          <div className="space-y-1">
            <Label>Valor total del contrato</Label>
            <Input type="number" min="0" step="0.01" {...register('totalValue')} placeholder="0.00" />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
            <div>
              <p className="text-sm font-medium">Renovación automática</p>
              <p className="text-xs text-muted-foreground">El contrato se renueva automáticamente al vencer</p>
            </div>
            <Switch checked={autoRenew} onCheckedChange={v => setValue('autoRenew', v)} />
          </div>

          {autoRenew && (
            <div className="space-y-1">
              <Label>Días de aviso antes de renovar</Label>
              <Input type="number" min="1" max="365" {...register('renewalNoticeDays')} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Contacto ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contacto del proveedor</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Se auto-completa con los datos del proveedor seleccionado. Puedes modificarlos si es necesario.
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label>Nombre</Label>
            <Input {...register('contactName')} placeholder="Nombre del contacto" />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" {...register('contactEmail')} placeholder="contacto@proveedor.com" />
          </div>
          <div className="space-y-1">
            <Label>Teléfono</Label>
            <Input {...register('contactPhone')} placeholder="+1-555-0123" />
          </div>
          <div className="sm:col-span-3 space-y-1">
            <Label>URL de términos / contrato</Label>
            <Input {...register('termsUrl')} placeholder="https://..." />
          </div>
        </CardContent>
      </Card>

      {/* ── Líneas del contrato ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Líneas del contrato</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => append({ ...EMPTY_LINE, order: fields.length })}>
              <Plus className="h-4 w-4 mr-1" /> Agregar línea
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {fields.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Sin líneas. Agrega servicios, equipos o software incluidos en este contrato.
            </p>
          )}
          {fields.map((field, i) => (
            <div key={field.id} className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Línea {i + 1}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)}
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Tipo</Label>
                  <Select value={watch(`lines.${i}.type`)} onValueChange={v => setValue(`lines.${i}.type`, v as any)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CONTRACT_LINE_TYPE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-xs">Descripción <span className="text-destructive">*</span></Label>
                  <Input className="h-8 text-sm" {...register(`lines.${i}.description`, { required: true })}
                    placeholder="Descripción del servicio o ítem" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cantidad</Label>
                  <Input className="h-8 text-sm" type="number" min="0" step="0.01"
                    {...register(`lines.${i}.quantity`)} placeholder="1" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Precio unitario</Label>
                  <Input className="h-8 text-sm" type="number" min="0" step="0.01"
                    {...register(`lines.${i}.unitPrice`)} placeholder="0.00" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Notas</Label>
                  <Input className="h-8 text-sm" {...register(`lines.${i}.notes`)} placeholder="Opcional" />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Notas ───────────────────────────────────────────────────────── */}
      <div className="space-y-1">
        <Label>Notas internas</Label>
        <Textarea {...register('notes')} rows={3} placeholder="Observaciones, condiciones especiales..." />
      </div>

      {/* ── Acciones ────────────────────────────────────────────────────── */}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
          {isEditing ? 'Guardar cambios' : 'Crear contrato'}
        </Button>
      </div>
    </form>
  )
}
