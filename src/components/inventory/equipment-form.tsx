'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Plus, X } from 'lucide-react'
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { createEquipmentSchema, type CreateEquipmentInput } from '@/lib/validations/inventory/equipment'
import type { Equipment, EquipmentFormData } from '@/types/inventory/equipment'

interface EquipmentFormProps {
  equipment?: Equipment
  onSuccess?: (equipment: Equipment) => void
  onCancel?: () => void
}

const EQUIPMENT_TYPE_OPTIONS = [
  { value: 'LAPTOP', label: 'Laptop' },
  { value: 'DESKTOP', label: 'Desktop' },
  { value: 'MONITOR', label: 'Monitor' },
  { value: 'PRINTER', label: 'Impresora' },
  { value: 'PHONE', label: 'Teléfono' },
  { value: 'TABLET', label: 'Tablet' },
  { value: 'KEYBOARD', label: 'Teclado' },
  { value: 'MOUSE', label: 'Mouse' },
  { value: 'HEADSET', label: 'Audífonos' },
  { value: 'WEBCAM', label: 'Webcam' },
  { value: 'DOCKING_STATION', label: 'Docking Station' },
  { value: 'UPS', label: 'UPS' },
  { value: 'ROUTER', label: 'Router' },
  { value: 'SWITCH', label: 'Switch' },
  { value: 'OTHER', label: 'Otro' },
]

const EQUIPMENT_STATUS_OPTIONS = [
  { value: 'AVAILABLE', label: 'Disponible' },
  { value: 'ASSIGNED', label: 'Asignado' },
  { value: 'MAINTENANCE', label: 'Mantenimiento' },
  { value: 'DAMAGED', label: 'Dañado' },
  { value: 'RETIRED', label: 'Retirado' },
]

const EQUIPMENT_CONDITION_OPTIONS = [
  { value: 'NEW', label: 'Nuevo' },
  { value: 'LIKE_NEW', label: 'Como Nuevo' },
  { value: 'GOOD', label: 'Bueno' },
  { value: 'FAIR', label: 'Regular' },
  { value: 'POOR', label: 'Malo' },
]

const OWNERSHIP_TYPE_OPTIONS = [
  { value: 'FIXED_ASSET', label: 'Activo Fijo' },
  { value: 'RENTAL', label: 'Alquiler' },
  { value: 'LOAN', label: 'Préstamo' },
]

export function EquipmentForm({ equipment, onSuccess, onCancel }: EquipmentFormProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [accessories, setAccessories] = useState<string[]>(equipment?.accessories || [])
  const [newAccessory, setNewAccessory] = useState('')
  const [specifications, setSpecifications] = useState<Record<string, string>>(
    equipment?.specifications || {}
  )
  const [newSpecKey, setNewSpecKey] = useState('')
  const [newSpecValue, setNewSpecValue] = useState('')

  const isEditing = !!equipment

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<CreateEquipmentInput>({
    resolver: zodResolver(createEquipmentSchema),
    defaultValues: equipment ? {
      code: equipment.code,
      serialNumber: equipment.serialNumber,
      brand: equipment.brand,
      model: equipment.model,
      type: equipment.type,
      status: equipment.status,
      condition: equipment.condition,
      ownershipType: equipment.ownershipType,
      purchaseDate: equipment.purchaseDate ? new Date(equipment.purchaseDate) : undefined,
      purchasePrice: equipment.purchasePrice || undefined,
      warrantyExpiration: equipment.warrantyExpiration ? new Date(equipment.warrantyExpiration) : undefined,
      location: equipment.location || undefined,
      notes: equipment.notes || undefined,
    } : {
      status: 'AVAILABLE',
      condition: 'GOOD',
      ownershipType: 'FIXED_ASSET',
    },
  })

  const onSubmit = async (data: CreateEquipmentInput) => {
    try {
      setLoading(true)

      const payload = {
        ...data,
        accessories,
        specifications,
      }

      const url = isEditing
        ? `/api/inventory/equipment/${equipment.id}`
        : '/api/inventory/equipment'
      
      const method = isEditing ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al guardar equipo')
      }

      const savedEquipment = await response.json()

      toast({
        title: isEditing ? 'Equipo actualizado' : 'Equipo creado',
        description: `El equipo ${savedEquipment.code} ha sido ${isEditing ? 'actualizado' : 'creado'} exitosamente`,
      })

      onSuccess?.(savedEquipment)
    } catch (error) {
      console.error('Error guardando equipo:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo guardar el equipo',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const addAccessory = () => {
    if (newAccessory.trim()) {
      setAccessories([...accessories, newAccessory.trim()])
      setNewAccessory('')
    }
  }

  const removeAccessory = (index: number) => {
    setAccessories(accessories.filter((_, i) => i !== index))
  }

  const addSpecification = () => {
    if (newSpecKey.trim() && newSpecValue.trim()) {
      setSpecifications({
        ...specifications,
        [newSpecKey.trim()]: newSpecValue.trim(),
      })
      setNewSpecKey('')
      setNewSpecValue('')
    }
  }

  const removeSpecification = (key: string) => {
    const newSpecs = { ...specifications }
    delete newSpecs[key]
    setSpecifications(newSpecs)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Información Básica */}
      <Card>
        <CardHeader>
          <CardTitle>Información Básica</CardTitle>
          <CardDescription>
            Datos principales del equipo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="code">
                Código <span className="text-destructive">*</span>
              </Label>
              <Input
                id="code"
                {...register('code')}
                placeholder="LAP-001"
                disabled={isEditing}
              />
              {errors.code && (
                <p className="text-sm text-destructive">{errors.code.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="serialNumber">
                Número de Serie <span className="text-destructive">*</span>
              </Label>
              <Input
                id="serialNumber"
                {...register('serialNumber')}
                placeholder="SN-LAP-2024-001"
              />
              {errors.serialNumber && (
                <p className="text-sm text-destructive">{errors.serialNumber.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="brand">
                Marca <span className="text-destructive">*</span>
              </Label>
              <Input
                id="brand"
                {...register('brand')}
                placeholder="Dell"
              />
              {errors.brand && (
                <p className="text-sm text-destructive">{errors.brand.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">
                Modelo <span className="text-destructive">*</span>
              </Label>
              <Input
                id="model"
                {...register('model')}
                placeholder="Latitude 5420"
              />
              {errors.model && (
                <p className="text-sm text-destructive">{errors.model.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">
                Tipo <span className="text-destructive">*</span>
              </Label>
              <Select
                value={watch('type')}
                onValueChange={(value) => setValue('type', value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un tipo" />
                </SelectTrigger>
                <SelectContent>
                  {EQUIPMENT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.type && (
                <p className="text-sm text-destructive">{errors.type.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="condition">
                Condición <span className="text-destructive">*</span>
              </Label>
              <Select
                value={watch('condition')}
                onValueChange={(value) => setValue('condition', value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una condición" />
                </SelectTrigger>
                <SelectContent>
                  {EQUIPMENT_CONDITION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.condition && (
                <p className="text-sm text-destructive">{errors.condition.message}</p>
              )}
            </div>

            {isEditing && (
              <div className="space-y-2">
                <Label htmlFor="status">Estado</Label>
                <Select
                  value={watch('status')}
                  onValueChange={(value) => setValue('status', value as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EQUIPMENT_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="ownershipType">
                Tipo de Propiedad <span className="text-destructive">*</span>
              </Label>
              <Select
                value={watch('ownershipType')}
                onValueChange={(value) => setValue('ownershipType', value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OWNERSHIP_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.ownershipType && (
                <p className="text-sm text-destructive">{errors.ownershipType.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Ubicación</Label>
              <Input
                id="location"
                {...register('location')}
                placeholder="Bodega Principal"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Información Financiera */}
      <Card>
        <CardHeader>
          <CardTitle>Información Financiera</CardTitle>
          <CardDescription>
            Datos de compra y garantía
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="purchaseDate">Fecha de Compra</Label>
              <Input
                id="purchaseDate"
                type="date"
                {...register('purchaseDate')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchasePrice">Precio de Compra (USD)</Label>
              <Input
                id="purchasePrice"
                type="number"
                step="0.01"
                {...register('purchasePrice', { valueAsNumber: true })}
                placeholder="1200.00"
              />
              {errors.purchasePrice && (
                <p className="text-sm text-destructive">{errors.purchasePrice.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="warrantyExpiration">Vencimiento de Garantía</Label>
              <Input
                id="warrantyExpiration"
                type="date"
                {...register('warrantyExpiration')}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accesorios */}
      <Card>
        <CardHeader>
          <CardTitle>Accesorios</CardTitle>
          <CardDescription>
            Lista de accesorios incluidos con el equipo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newAccessory}
              onChange={(e) => setNewAccessory(e.target.value)}
              placeholder="Ej: Cargador, Mouse, Cable HDMI"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAccessory())}
            />
            <Button type="button" onClick={addAccessory} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {accessories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {accessories.map((accessory, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1 rounded-md bg-secondary px-3 py-1 text-sm"
                >
                  {accessory}
                  <button
                    type="button"
                    onClick={() => removeAccessory(index)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Especificaciones Técnicas */}
      <Card>
        <CardHeader>
          <CardTitle>Especificaciones Técnicas</CardTitle>
          <CardDescription>
            Detalles técnicos del equipo (procesador, RAM, almacenamiento, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 md:grid-cols-[1fr,1fr,auto]">
            <Input
              value={newSpecKey}
              onChange={(e) => setNewSpecKey(e.target.value)}
              placeholder="Nombre (ej: Procesador)"
            />
            <Input
              value={newSpecValue}
              onChange={(e) => setNewSpecValue(e.target.value)}
              placeholder="Valor (ej: Intel Core i7)"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSpecification())}
            />
            <Button type="button" onClick={addSpecification} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {Object.keys(specifications).length > 0 && (
            <div className="space-y-2">
              {Object.entries(specifications).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <span className="font-medium">{key}:</span> {value}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSpecification(key)}
                    className="hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notas */}
      <Card>
        <CardHeader>
          <CardTitle>Notas Adicionales</CardTitle>
          <CardDescription>
            Información adicional sobre el equipo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            {...register('notes')}
            placeholder="Observaciones, historial, o cualquier información relevante..."
            rows={4}
          />
          {errors.notes && (
            <p className="mt-2 text-sm text-destructive">{errors.notes.message}</p>
          )}
        </CardContent>
      </Card>

      {/* Botones */}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? 'Actualizar Equipo' : 'Crear Equipo'}
        </Button>
      </div>
    </form>
  )
}
