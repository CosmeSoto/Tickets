'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

const supplierSchema = z.object({
  name: z.string().min(1, 'El nombre del proveedor es obligatorio').max(200),
  type: z.enum(['EQUIPMENT', 'CONSUMABLE', 'LICENSE', 'MIXED'], { required_error: 'El tipo es obligatorio' }),
  taxId: z.string().max(20).optional().or(z.literal('')),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().max(30).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  website: z.string().max(200).optional().or(z.literal('')),
  contactName: z.string().max(200).optional().or(z.literal('')),
}).refine(d => d.email || d.phone, {
  message: 'Se requiere al menos email o teléfono',
  path: ['email'],
})

type SupplierFormData = z.infer<typeof supplierSchema>

const TYPE_LABELS: Record<string, string> = {
  EQUIPMENT: 'Equipos',
  CONSUMABLE: 'Consumibles',
  LICENSE: 'Licencias',
  MIXED: 'Mixto',
}

interface SupplierFormProps {
  supplier?: any
  onSuccess?: (supplier: any) => void
  onCancel?: () => void
}

export function SupplierForm({ supplier, onSuccess, onCancel }: SupplierFormProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const isEdit = !!supplier?.id

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: supplier?.name || '',
      type: supplier?.type || undefined,
      taxId: supplier?.taxId || '',
      email: supplier?.email || '',
      phone: supplier?.phone || '',
      address: supplier?.address || '',
      website: supplier?.website || '',
      contactName: supplier?.contactName || '',
    },
  })

  const typeValue = watch('type')

  const onSubmit = async (data: SupplierFormData) => {
    setLoading(true)
    try {
      const url = isEdit ? `/api/inventory/suppliers/${supplier.id}` : '/api/inventory/suppliers'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al guardar proveedor')
      toast({ title: isEdit ? 'Proveedor actualizado' : 'Proveedor creado', description: json.name })
      onSuccess?.(json)
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="name">Nombre *</Label>
          <Input id="name" {...register('name')} placeholder="Nombre del proveedor" />
          {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div>
          <Label htmlFor="type">Tipo *</Label>
          <Select value={typeValue} onValueChange={v => setValue('type', v as any)}>
            <SelectTrigger id="type">
              <SelectValue placeholder="Seleccionar tipo" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TYPE_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.type && <p className="mt-1 text-xs text-destructive">{errors.type.message}</p>}
        </div>

        <div>
          <Label htmlFor="taxId">RUC / NIT</Label>
          <Input id="taxId" {...register('taxId')} placeholder="Ej: 1234567890001" maxLength={20} />
        </div>

        <div>
          <Label htmlFor="email">Email de contacto</Label>
          <Input id="email" type="email" {...register('email')} placeholder="contacto@empresa.com" />
          {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div>
          <Label htmlFor="phone">Teléfono</Label>
          <Input id="phone" {...register('phone')} placeholder="+593 99 999 9999" />
        </div>

        <div>
          <Label htmlFor="contactName">Nombre del contacto</Label>
          <Input id="contactName" {...register('contactName')} placeholder="Nombre del representante" />
        </div>

        <div>
          <Label htmlFor="website">Sitio web</Label>
          <Input id="website" {...register('website')} placeholder="https://empresa.com" />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="address">Dirección</Label>
          <Input id="address" {...register('address')} placeholder="Dirección del proveedor" />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEdit ? 'Guardar cambios' : 'Crear proveedor'}
        </Button>
      </div>
    </form>
  )
}
