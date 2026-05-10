'use client'

import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon, Plus, X } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { BatchCommonData } from './BatchForm'
import { DynamicAttributes } from './DynamicAttributes'

interface BatchPhase1Props {
  equipmentTypes: any[]
  departments: any[]
  warehouses: any[]
  suppliers: any[]
  models: any[]
  onComplete: (data: BatchCommonData) => void
  initialData?: BatchCommonData | null
}

interface Accessory {
  name: string
  quantity: number
}

export function BatchPhase1({
  equipmentTypes,
  departments,
  warehouses,
  suppliers,
  models,
  onComplete,
  initialData,
}: BatchPhase1Props) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: initialData || {},
  })

  const [selectedModel, setSelectedModel] = useState<string>(initialData?.modelId || '')
  const [selectedModelData, setSelectedModelData] = useState<any>(null)
  const [accessories, setAccessories] = useState<Accessory[]>(initialData?.accessories || [])
  const [newAccessory, setNewAccessory] = useState({ name: '', quantity: 1 })
  const [customValues, setCustomValues] = useState<Record<string, any>>(
    initialData?.customValues || {}
  )

  // Cargar datos del modelo seleccionado
  useEffect(() => {
    if (selectedModel) {
      const model = models.find(m => m.id === selectedModel)
      setSelectedModelData(model)
    }
  }, [selectedModel, models])

  const addAccessory = () => {
    if (newAccessory.name.trim()) {
      setAccessories([...accessories, { ...newAccessory }])
      setNewAccessory({ name: '', quantity: 1 })
    }
  }

  const removeAccessory = (index: number) => {
    setAccessories(accessories.filter((_, i) => i !== index))
  }

  const onSubmit = (data: any) => {
    const formData: BatchCommonData = {
      ...data,
      modelId: selectedModel,
      accessories: accessories.length > 0 ? accessories : undefined,
      customValues: Object.keys(customValues).length > 0 ? customValues : undefined,
    }
    onComplete(formData)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='space-y-6'>
      {/* Información del Modelo */}
      <Card>
        <CardHeader>
          <CardTitle>Información del Modelo</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='model'>Modelo *</Label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger>
                <SelectValue placeholder='Seleccionar modelo' />
              </SelectTrigger>
              <SelectContent>
                {models.map(model => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.brand} {model.model} - {model.type?.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!selectedModel && <p className='text-sm text-red-500'>El modelo es requerido</p>}
          </div>

          {/* Atributos Dinámicos del Tipo */}
          {selectedModelData?.type && (
            <DynamicAttributes
              equipmentType={selectedModelData.type}
              values={customValues}
              onChange={setCustomValues}
            />
          )}
        </CardContent>
      </Card>

      {/* Información de Compra */}
      <Card>
        <CardHeader>
          <CardTitle>Información de Compra</CardTitle>
        </CardHeader>
        <CardContent className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div className='space-y-2'>
            <Label htmlFor='supplierId'>Proveedor *</Label>
            <Controller
              name='supplierId'
              control={control}
              rules={{ required: 'El proveedor es requerido' }}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder='Seleccionar proveedor' />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(supplier => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.supplierId && (
              <p className='text-sm text-red-500'>{errors.supplierId.message as string}</p>
            )}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='purchaseDate'>Fecha de Compra</Label>
            <Controller
              name='purchaseDate'
              control={control}
              render={({ field }) => (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant='outline'
                      className='w-full justify-start text-left font-normal'
                    >
                      <CalendarIcon className='mr-2 h-4 w-4' />
                      {field.value
                        ? format(new Date(field.value), 'PPP', { locale: es })
                        : 'Seleccionar fecha'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className='w-auto p-0'>
                    <Calendar
                      mode='single'
                      selected={field.value ? new Date(field.value) : undefined}
                      onSelect={field.onChange}
                      locale={es}
                    />
                  </PopoverContent>
                </Popover>
              )}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='unitPrice'>Precio Unitario</Label>
            <Input
              id='unitPrice'
              type='number'
              step='0.01'
              {...register('unitPrice', { valueAsNumber: true })}
              placeholder='0.00'
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='invoiceNumber'>Número de Factura</Label>
            <Input id='invoiceNumber' {...register('invoiceNumber')} placeholder='FAC-001' />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='purchaseOrderNumber'>Número de Orden de Compra</Label>
            <Input
              id='purchaseOrderNumber'
              {...register('purchaseOrderNumber')}
              placeholder='OC-001'
            />
          </div>
        </CardContent>
      </Card>

      {/* Información General */}
      <Card>
        <CardHeader>
          <CardTitle>Información General</CardTitle>
        </CardHeader>
        <CardContent className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div className='space-y-2'>
            <Label htmlFor='departmentId'>Departamento</Label>
            <Controller
              name='departmentId'
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder='Seleccionar departamento' />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(dept => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='warehouseId'>Bodega</Label>
            <Controller
              name='warehouseId'
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder='Seleccionar bodega' />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map(wh => (
                      <SelectItem key={wh.id} value={wh.id}>
                        {wh.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='condition'>Condición</Label>
            <Controller
              name='condition'
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder='Seleccionar condición' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='NEW'>Nuevo</SelectItem>
                    <SelectItem value='GOOD'>Bueno</SelectItem>
                    <SelectItem value='FAIR'>Regular</SelectItem>
                    <SelectItem value='POOR'>Malo</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='propertyType'>Tipo de Propiedad</Label>
            <Controller
              name='propertyType'
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder='Seleccionar tipo' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='FIXED_ASSET'>Activo Fijo</SelectItem>
                    <SelectItem value='RENTAL'>Alquiler</SelectItem>
                    <SelectItem value='LOAN'>Préstamo</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* Accesorios Comunes */}
      <Card>
        <CardHeader>
          <CardTitle>Accesorios Comunes</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex gap-2'>
            <Input
              placeholder='Nombre del accesorio'
              value={newAccessory.name}
              onChange={e => setNewAccessory({ ...newAccessory, name: e.target.value })}
            />
            <Input
              type='number'
              min='1'
              className='w-24'
              placeholder='Cant.'
              value={newAccessory.quantity}
              onChange={e =>
                setNewAccessory({ ...newAccessory, quantity: parseInt(e.target.value) || 1 })
              }
            />
            <Button type='button' onClick={addAccessory} size='icon'>
              <Plus className='w-4 h-4' />
            </Button>
          </div>

          {accessories.length > 0 && (
            <div className='space-y-2'>
              {accessories.map((acc, index) => (
                <div
                  key={index}
                  className='flex items-center justify-between p-2 bg-gray-50 rounded'
                >
                  <span>
                    {acc.name} (x{acc.quantity})
                  </span>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    onClick={() => removeAccessory(index)}
                  >
                    <X className='w-4 h-4' />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notas */}
      <Card>
        <CardHeader>
          <CardTitle>Notas del Lote</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            {...register('notes')}
            placeholder='Observaciones adicionales sobre el lote...'
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Botones */}
      <div className='flex justify-end gap-4'>
        <Button type='button' variant='outline'>
          Cancelar
        </Button>
        <Button type='submit' disabled={!selectedModel}>
          Continuar a Datos Individuales →
        </Button>
      </div>
    </form>
  )
}
