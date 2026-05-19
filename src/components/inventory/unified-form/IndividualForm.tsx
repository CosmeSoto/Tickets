'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SerialNumberInput } from '@/components/ui/serial-number-input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface IndividualFormProps {
  equipmentTypes: any[]
  departments: any[]
  warehouses: any[]
  models: any[]
}

export function IndividualForm({
  equipmentTypes,
  departments,
  warehouses,
  models,
}: IndividualFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string>('')

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm()

  const onSubmit = async (data: any) => {
    setIsSubmitting(true)
    try {
      const response = await fetch('/api/inventory/equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          modelId: selectedModel,
        }),
      })

      if (!response.ok) throw new Error('Error al crear equipo')

      toast.success('Equipo creado exitosamente')
      router.push('/inventory')
      router.refresh()
    } catch (error) {
      toast.error('Error al crear equipo')
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='bg-white p-6 rounded-lg shadow space-y-6'>
      <h3 className='text-xl font-semibold'>Datos del Equipo</h3>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        {/* Código */}
        <div className='space-y-2'>
          <Label htmlFor='code'>Código *</Label>
          <Input
            id='code'
            {...register('code', { required: 'El código es requerido' })}
            placeholder='EQ-001'
          />
          {errors.code && <p className='text-sm text-red-500'>{errors.code.message as string}</p>}
        </div>

        {/* Número de Serie */}
        <div className='space-y-2'>
          <Label htmlFor='serialNumber'>Número de Serie</Label>
          <SerialNumberInput
            id='serialNumber'
            {...register('serialNumber')}
            placeholder='SN123456'
          />
        </div>

        {/* Modelo */}
        <div className='space-y-2 md:col-span-2'>
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
        </div>

        {/* Departamento */}
        <div className='space-y-2'>
          <Label htmlFor='departmentId'>Departamento</Label>
          <Select {...register('departmentId')}>
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
        </div>

        {/* Bodega */}
        <div className='space-y-2'>
          <Label htmlFor='warehouseId'>Bodega</Label>
          <Select {...register('warehouseId')}>
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
        </div>

        {/* Ubicación Física */}
        <div className='space-y-2'>
          <Label htmlFor='physicalLocation'>Ubicación Física</Label>
          <Input
            id='physicalLocation'
            {...register('physicalLocation')}
            placeholder='Oficina 101'
          />
        </div>

        {/* Condición */}
        <div className='space-y-2'>
          <Label htmlFor='condition'>Condición</Label>
          <Select {...register('condition')}>
            <SelectTrigger>
              <SelectValue placeholder='Seleccionar condición' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='GOOD'>Bueno</SelectItem>
              <SelectItem value='FAIR'>Regular</SelectItem>
              <SelectItem value='POOR'>Malo</SelectItem>
              <SelectItem value='NEW'>Nuevo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Notas */}
        <div className='space-y-2 md:col-span-2'>
          <Label htmlFor='notes'>Notas</Label>
          <Textarea
            id='notes'
            {...register('notes')}
            placeholder='Observaciones adicionales...'
            rows={3}
          />
        </div>
      </div>

      <div className='flex justify-end gap-4'>
        <Button type='button' variant='outline' onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type='submit' disabled={isSubmitting}>
          {isSubmitting ? 'Creando...' : 'Crear Equipo'}
        </Button>
      </div>
    </form>
  )
}
