'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Plus, X, Package, Settings, ExternalLink, ImageIcon, Building, AlertCircle } from 'lucide-react'
import Link from 'next/link'
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
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import { createEquipmentSchema, type CreateEquipmentInput } from '@/lib/validations/inventory/equipment'
import type { Equipment, EquipmentFormData } from '@/types/inventory/equipment'
import { EquipmentAttachments } from '@/components/inventory/equipment-attachments'
import { FileUploadZone } from '@/components/ui/file-upload-zone'

interface EquipmentFormProps {
  equipment?: Equipment
  onSuccess?: (equipment: Equipment) => void
  onCancel?: () => void
}

interface EquipmentType {
  id: string
  code: string
  name: string
  icon?: string
  isActive: boolean
  order: number
  family?: { id: string; name: string; code: string; color?: string } | null
}

interface Department {
  id: string
  name: string
  isActive: boolean
  familyId: string | null
  family?: { id: string; name: string; code: string; color?: string } | null
}

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
  const [loadingTypes, setLoadingTypes] = useState(true)
  const [loadingDepartments, setLoadingDepartments] = useState(true)
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [accessories, setAccessories] = useState<string[]>(equipment?.accessories || [])
  const [newAccessory, setNewAccessory] = useState('')
  const [specifications, setSpecifications] = useState<Record<string, string>>(
    equipment?.specifications || {}
  )
  const [newSpecKey, setNewSpecKey] = useState('')
  const [newSpecValue, setNewSpecValue] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [maxFileSize, setMaxFileSize] = useState(10)

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(d => { if (d.maxFileSize) setMaxFileSize(d.maxFileSize) })
      .catch(() => {})
  }, [])

  const isEditing = !!equipment
  // Determine if the department selector should be disabled (active assignment in edit mode)
  const hasActiveAssignment = isEditing && !!equipment?.currentAssignment

  // Cargar tipos de equipo desde la API
  useEffect(() => {
    async function fetchEquipmentTypes() {
      try {
        const response = await fetch('/api/admin/equipment-types')
        if (response.ok) {
          const types = await response.json()
          setEquipmentTypes(types)
        } else {
          toast({
            title: 'Error',
            description: 'No se pudieron cargar los tipos de equipo',
            variant: 'destructive'
          })
        }
      } catch (error) {
        console.error('Error cargando tipos de equipo:', error)
        toast({
          title: 'Error',
          description: 'Error de conexión al cargar tipos de equipo',
          variant: 'destructive'
        })
      } finally {
        setLoadingTypes(false)
      }
    }

    fetchEquipmentTypes()
  }, [])

  // Cargar departamentos activos desde la API
  useEffect(() => {
    async function fetchDepartments() {
      try {
        const response = await fetch('/api/departments?isActive=true')
        if (response.ok) {
          const data = await response.json()
          if (data.success && Array.isArray(data.data)) {
            setDepartments(data.data)
          }
        }
      } catch (error) {
        console.error('Error cargando departamentos:', error)
      } finally {
        setLoadingDepartments(false)
      }
    }

    fetchDepartments()
  }, [])

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
      typeId: equipment.typeId,
      departmentId: equipment.departmentId || undefined,
      status: equipment.status,
      condition: equipment.condition,
      ownershipType: equipment.ownershipType,
      purchaseDate: equipment.purchaseDate ? new Date(equipment.purchaseDate) : undefined,
      purchasePrice: equipment.purchasePrice || undefined,
      warrantyExpiration: equipment.warrantyExpiration ? new Date(equipment.warrantyExpiration) : undefined,
      location: equipment.location || undefined,
      notes: equipment.notes || undefined,
      rentalProvider: equipment.rentalProvider || undefined,
      rentalContractNumber: equipment.rentalContractNumber || undefined,
      rentalStartDate: equipment.rentalStartDate ? new Date(equipment.rentalStartDate) : undefined,
      rentalEndDate: equipment.rentalEndDate ? new Date(equipment.rentalEndDate) : undefined,
      rentalMonthlyCost: equipment.rentalMonthlyCost || undefined,
      rentalContactName: equipment.rentalContactName || undefined,
      rentalContactEmail: equipment.rentalContactEmail || undefined,
      rentalContactPhone: equipment.rentalContactPhone || undefined,
      rentalNotes: equipment.rentalNotes || undefined,
    } : {
      status: 'AVAILABLE',
      condition: 'GOOD',
      ownershipType: 'FIXED_ASSET',
    },
  })

  const ownershipType = watch('ownershipType')
  const isRental = ownershipType === 'RENTAL'
  const selectedTypeId = watch('typeId')
  const selectedDepartmentId = watch('departmentId')

  // Derive the familyId of the selected equipment type
  const selectedTypeFamilyId = equipmentTypes.find(t => t.id === selectedTypeId)?.family?.id ?? null

  // Filter departments by the family of the selected equipment type
  const filteredDepartments = selectedTypeFamilyId
    ? departments.filter(d => d.familyId === selectedTypeFamilyId)
    : departments

  // When the type changes, clear the department if it no longer belongs to the new family
  useEffect(() => {
    if (!selectedTypeId || !selectedDepartmentId) return
    const currentDept = departments.find(d => d.id === selectedDepartmentId)
    if (currentDept && selectedTypeFamilyId && currentDept.familyId !== selectedTypeFamilyId) {
      setValue('departmentId', '' as any, { shouldValidate: false })
    }
  }, [selectedTypeId, selectedTypeFamilyId, selectedDepartmentId, departments, setValue])

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

      // Si hay archivos pendientes (modo creación), subirlos ahora
      if (!isEditing && pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          try {
            const fd = new FormData()
            fd.append('file', file)
            await fetch(`/api/inventory/equipment/${savedEquipment.id}/attachments`, {
              method: 'POST',
              body: fd,
            })
          } catch {
            // No bloquear si falla un adjunto individual
          }
        }
      }

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
    const trimmed = newAccessory.trim()
    if (trimmed && trimmed.length > 0) {
      setAccessories([...accessories, trimmed])
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
    <form onSubmit={handleSubmit(onSubmit, (validationErrors) => {
      console.error('Errores de validación:', validationErrors)
      const firstError = Object.values(validationErrors)[0]
      toast({
        title: 'Error de validación',
        description: firstError?.message as string || 'Revisa los campos del formulario',
        variant: 'destructive',
      })
    })} className="space-y-6">
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
              {loadingTypes ? (
                <div className="flex items-center justify-center h-10 border rounded-md">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Combobox
                      options={equipmentTypes.map((type): ComboboxOption => ({
                        value: type.id,
                        label: type.name,
                      }))}
                      value={watch('typeId') || ''}
                      onValueChange={(value) => setValue('typeId', value as any, { shouldValidate: true })}
                      placeholder="Buscar tipo de equipo..."
                      searchPlaceholder="Escriba para buscar..."
                      emptyText="No se encontró el tipo"
                    />
                  </div>
                  <Link href="/inventory/equipment-types" target="_blank">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      title="Gestionar tipos de equipo"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              )}
              {errors.typeId && (
                <p className="text-sm text-destructive">{errors.typeId.message}</p>
              )}
            </div>

            {/* Selector de Departamento */}
            <div className="space-y-2">
              <Label htmlFor="department">
                Departamento <span className="text-destructive">*</span>
              </Label>
              {loadingDepartments ? (
                <div className="flex items-center justify-center h-10 border rounded-md">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : hasActiveAssignment ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="relative">
                        <Select disabled value={selectedDepartmentId || ''}>
                          <SelectTrigger className="opacity-60 cursor-not-allowed">
                            <SelectValue placeholder="Selecciona un departamento" />
                          </SelectTrigger>
                          <SelectContent>
                            {departments.map((dept) => (
                              <SelectItem key={dept.id} value={dept.id}>
                                <span className="flex items-center gap-2">
                                  <Building className="h-3 w-3" />
                                  {dept.name}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <AlertCircle className="absolute right-8 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      No se puede cambiar el departamento mientras el equipo tiene una asignación activa
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <Select
                  value={selectedDepartmentId || ''}
                  onValueChange={(value) => setValue('departmentId', value as any, { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      selectedTypeId && filteredDepartments.length === 0
                        ? 'No hay departamentos para esta familia'
                        : 'Selecciona un departamento'
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredDepartments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        <span className="flex items-center gap-2">
                          <Building className="h-3 w-3" />
                          {dept.name}
                          {dept.family && (
                            <span className="text-xs text-muted-foreground">({dept.family.name})</span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {!hasActiveAssignment && selectedTypeId && filteredDepartments.length === 0 && !loadingDepartments && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  No hay departamentos activos para la familia del tipo seleccionado
                </p>
              )}
              {errors.departmentId && (
                <p className="text-sm text-destructive">{errors.departmentId.message}</p>
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

      {/* Información de Renta (solo para equipos rentados) */}
      {isRental && (
        <Card>
          <CardHeader>
            <CardTitle>Información de Renta/Alquiler</CardTitle>
            <CardDescription>
              Datos del proveedor y contrato de renta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rentalProvider">
                  Proveedor <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="rentalProvider"
                  {...register('rentalProvider')}
                  placeholder="TechRent Solutions"
                />
                {errors.rentalProvider && (
                  <p className="text-sm text-destructive">{errors.rentalProvider.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="rentalContractNumber">Número de Contrato</Label>
                <Input
                  id="rentalContractNumber"
                  {...register('rentalContractNumber')}
                  placeholder="TR-2026-0123"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rentalStartDate">Fecha de Inicio</Label>
                <Input
                  id="rentalStartDate"
                  type="date"
                  {...register('rentalStartDate')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rentalEndDate">Fecha de Fin</Label>
                <Input
                  id="rentalEndDate"
                  type="date"
                  {...register('rentalEndDate')}
                />
                {errors.rentalEndDate && (
                  <p className="text-sm text-destructive">{errors.rentalEndDate.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="rentalMonthlyCost">Costo Mensual (USD)</Label>
                <Input
                  id="rentalMonthlyCost"
                  type="number"
                  step="0.01"
                  {...register('rentalMonthlyCost', { valueAsNumber: true })}
                  placeholder="150.00"
                />
                {errors.rentalMonthlyCost && (
                  <p className="text-sm text-destructive">{errors.rentalMonthlyCost.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="rentalContactName">Nombre de Contacto</Label>
                <Input
                  id="rentalContactName"
                  {...register('rentalContactName')}
                  placeholder="Juan Pérez"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rentalContactEmail">Email de Contacto</Label>
                <Input
                  id="rentalContactEmail"
                  type="email"
                  {...register('rentalContactEmail')}
                  placeholder="contacto@proveedor.com"
                />
                {errors.rentalContactEmail && (
                  <p className="text-sm text-destructive">{errors.rentalContactEmail.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="rentalContactPhone">Teléfono de Contacto</Label>
                <Input
                  id="rentalContactPhone"
                  {...register('rentalContactPhone')}
                  placeholder="+1-555-0123"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rentalNotes">Notas de Renta</Label>
              <Textarea
                id="rentalNotes"
                {...register('rentalNotes')}
                placeholder="Información adicional sobre el contrato, términos especiales, etc."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      )}

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
              placeholder="Ej: Cargador, Mouse inalámbrico, Cable HDMI"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addAccessory()
                }
              }}
              className="flex-1"
            />
            <Button 
              type="button" 
              onClick={addAccessory} 
              size="icon"
              variant="secondary"
              disabled={!newAccessory.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {accessories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No se han agregado accesorios</p>
              <p className="text-xs mt-1">Agrega accesorios usando el campo de arriba</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {accessories.map((accessory, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm"
                >
                  <Package className="h-3 w-3" />
                  <span>{accessory}</span>
                  <button
                    type="button"
                    onClick={() => removeAccessory(index)}
                    className="ml-1 hover:text-destructive transition-colors"
                    aria-label={`Eliminar ${accessory}`}
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
              className="flex-1"
            />
            <Input
              value={newSpecValue}
              onChange={(e) => setNewSpecValue(e.target.value)}
              placeholder="Valor (ej: Intel Core i7-1185G7)"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addSpecification()
                }
              }}
              className="flex-1"
            />
            <Button 
              type="button" 
              onClick={addSpecification} 
              size="icon"
              variant="secondary"
              disabled={!newSpecKey.trim() || !newSpecValue.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {Object.keys(specifications).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
              <Settings className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No se han agregado especificaciones</p>
              <p className="text-xs mt-1">Agrega especificaciones técnicas usando los campos de arriba</p>
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(specifications).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-md border p-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="font-medium">{key}:</span>{' '}
                      <span className="text-muted-foreground">{value}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSpecification(key)}
                    className="hover:text-destructive transition-colors"
                    aria-label={`Eliminar especificación ${key}`}
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

      {/* Adjuntos e Imágenes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ImageIcon className="h-4 w-4" />
            Imágenes y Adjuntos
          </CardTitle>
          <CardDescription className="text-xs">
            {isEditing ? 'Gestiona imágenes y documentos del equipo.' : `Se subirán al guardar. Máx. ${maxFileSize}MB por archivo.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {isEditing && equipment?.id ? (
            <EquipmentAttachments equipmentId={equipment.id} canManage={true} />
          ) : (
            <FileUploadZone
              files={pendingFiles}
              onChange={setPendingFiles}
              maxFileSizeMB={maxFileSize}
              accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
              onSizeError={(name, max) =>
                toast({ title: 'Archivo muy grande', description: `"${name}" supera ${max}MB`, variant: 'destructive' })
              }
            />
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
