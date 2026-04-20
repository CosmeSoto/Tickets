'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InlineCreateSelect } from '@/components/ui/inline-create-select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { CatalogTypeInlineForm } from '@/components/inventory/asset-forms/CatalogTypeInlineForm'
import { useFormSubmit } from '@/hooks/common/use-form-submit'
import { useFetch } from '@/hooks/common/use-fetch'

const supplierSchema = z.object({
  name: z.string().min(1, 'El nombre del proveedor es obligatorio').max(200),
  typeId: z.string().optional().or(z.literal('')),
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

interface SupplierType { id: string; name: string; description?: string }

interface SupplierFormProps {
  supplier?: any
  /** Si se pasa, pre-selecciona la familia y filtra tipos de proveedor */
  defaultFamilyId?: string
  onSuccess?: (supplier: any) => void
  onCancel?: () => void
}

export function SupplierForm({ supplier, defaultFamilyId, onSuccess, onCancel }: SupplierFormProps) {
  const isEdit = !!supplier?.id
  const [typeId, setTypeId] = useState<string>(supplier?.typeId ?? '')
  const [familyId, setFamilyId] = useState<string>(supplier?.familyId ?? defaultFamilyId ?? '')

  // Cargar tipos filtrados por familia
  const { data: supplierTypes, setData: setSupplierTypes } = useFetch<SupplierType>(
    '/api/inventory/supplier-types',
    { params: familyId ? { familyId } : undefined }
  )

  // Cargar familias
  const { data: familiesRaw } = useFetch('/api/inventory/families', {
    transform: (d) => d.families ?? [],
  })
  const families = familiesRaw as { id: string; name: string }[]

  const { submit, loading } = useFormSubmit(
    isEdit ? `/api/inventory/suppliers/${supplier.id}` : '/api/inventory/suppliers',
    {
      method: isEdit ? 'PUT' : 'POST',
      successMessage: isEdit ? 'Proveedor actualizado' : 'Proveedor creado',
      onSuccess,
    }
  )

  const { register, handleSubmit, formState: { errors } } = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: supplier?.name || '',
      typeId: supplier?.typeId || '',
      taxId: supplier?.taxId || '',
      email: supplier?.email || '',
      phone: supplier?.phone || '',
      address: supplier?.address || '',
      website: supplier?.website || '',
      contactName: supplier?.contactName || '',
    },
  })

  const onSubmit = async (data: SupplierFormData) => {
    await submit({ ...data, typeId: typeId || null, familyId: familyId || null })
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
          <Label>Familia <span className="text-xs font-normal text-muted-foreground">(opcional — vacío = proveedor global)</span></Label>
          <SearchableSelect
            options={families}
            value={familyId}
            onChange={setFamilyId}
            placeholder="Global (todas las familias)"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Sin familia: visible para todos. Con familia: aparece primero al crear activos de esa familia.
          </p>
        </div>

        <div>
          <Label>Tipo de proveedor</Label>
          <InlineCreateSelect
            options={supplierTypes}
            value={typeId}
            onChange={setTypeId}
            placeholder="Seleccionar tipo..."
            allowClear
            createLabel="Crear tipo de proveedor"
            createTitle="Nuevo tipo de proveedor"
            editTitle="Editar tipo de proveedor"
            deleteConfirmMessage="¿Eliminar este tipo? Si tiene proveedores asociados, se desactivará."
            createForm={({ item, onSuccess: onTypeSuccess, onCancel: onTypeCancel }) => (
              <CatalogTypeInlineForm
                apiEndpoint="/api/inventory/supplier-types"
                item={item}
                onSuccess={(newItem) => {
                  if (item) setSupplierTypes(prev => prev.map(t => t.id === newItem.id ? newItem : t))
                  else setSupplierTypes(prev => [...prev, newItem])
                  onTypeSuccess(newItem)
                }}
                onCancel={onTypeCancel}
              />
            )}
            onDelete={async (id) => {
              const res = await fetch(`/api/inventory/supplier-types/${id}`, { method: 'DELETE' })
              if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error') }
              setSupplierTypes(prev => prev.filter(t => t.id !== id))
            }}
          />
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
