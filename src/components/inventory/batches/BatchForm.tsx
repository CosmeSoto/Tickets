'use client'

/**
 * BatchForm Component
 * Formulario para crear lotes de equipos
 * Permite seleccionar modelo, cantidad, seriales, proveedor, factura y bodega
 */

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ModelSelector } from '@/components/inventory/models/ModelSelector'
import { Loader2 } from 'lucide-react'

// Schema de validación
const batchFormSchema = z.object({
  modelId: z.string().uuid('Debe seleccionar un modelo'),
  quantity: z
    .number()
    .int('La cantidad debe ser un número entero')
    .min(1, 'La cantidad mínima es 1')
    .max(500, 'La cantidad máxima es 500'),
  serialNumbers: z.string().optional(),
  supplierId: z.string().uuid('Debe seleccionar un proveedor').optional().or(z.literal('')),
  invoiceNumber: z.string().max(100, 'Número de factura muy largo').optional(),
  purchasePrice: z.number().positive('El precio debe ser positivo').optional().or(z.literal(0)),
  purchaseDate: z.string().optional(),
  warehouseId: z.string().uuid('Debe seleccionar una bodega').optional().or(z.literal('')),
  notes: z.string().max(2000, 'Las notas son muy largas').optional(),
})

type BatchFormData = z.infer<typeof batchFormSchema>

interface BatchFormProps {
  onSubmit: (data: BatchFormData) => Promise<void>
  onCancel?: () => void
  isLoading?: boolean
  suppliers?: Array<{ id: string; name: string }>
  warehouses?: Array<{ id: string; name: string }>
}

export function BatchForm({
  onSubmit,
  onCancel,
  isLoading = false,
  suppliers = [],
  warehouses = [],
}: BatchFormProps) {
  const [selectedModelId, setSelectedModelId] = useState<string>('')
  const [serialsText, setSerialsText] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<BatchFormData>({
    resolver: zodResolver(batchFormSchema),
    defaultValues: {
      quantity: 1,
      serialNumbers: '',
      supplierId: '',
      invoiceNumber: '',
      purchasePrice: 0,
      purchaseDate: new Date().toISOString().split('T')[0],
      warehouseId: '',
      notes: '',
    },
  })

  const quantity = watch('quantity')

  // Validar seriales únicos
  const validateSerials = (text: string): { valid: boolean; message?: string } => {
    if (!text || text.trim().length === 0) {
      return { valid: true }
    }

    const serials = text
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0)

    if (serials.length !== quantity) {
      return {
        valid: false,
        message: `Debe proporcionar exactamente ${quantity} números de serie (uno por línea)`,
      }
    }

    // Verificar duplicados
    const uniqueSerials = new Set(serials)
    if (uniqueSerials.size !== serials.length) {
      return {
        valid: false,
        message: 'Hay números de serie duplicados',
      }
    }

    return { valid: true }
  }

  const handleFormSubmit = async (data: BatchFormData) => {
    // Validar seriales si se proporcionaron
    if (serialsText.trim().length > 0) {
      const validation = validateSerials(serialsText)
      if (!validation.valid) {
        alert(validation.message)
        return
      }
    }

    await onSubmit({
      ...data,
      serialNumbers: serialsText,
    })
  }

  const serialValidation = validateSerials(serialsText)

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className='space-y-6'>
      {/* Selector de Modelo */}
      <div className='space-y-2'>
        <Label htmlFor='modelId'>
          Modelo <span className='text-red-500'>*</span>
        </Label>
        <ModelSelector
          value={selectedModelId}
          onChange={modelId => {
            setSelectedModelId(modelId)
            setValue('modelId', modelId)
          }}
          showStock
        />
        {errors.modelId && <p className='text-sm text-red-500'>{errors.modelId.message}</p>}
      </div>

      {/* Cantidad */}
      <div className='space-y-2'>
        <Label htmlFor='quantity'>
          Cantidad <span className='text-red-500'>*</span>
        </Label>
        <Input
          id='quantity'
          type='number'
          min={1}
          max={500}
          {...register('quantity', { valueAsNumber: true })}
          placeholder='Ej: 50'
        />
        {errors.quantity && <p className='text-sm text-red-500'>{errors.quantity.message}</p>}
        <p className='text-sm text-gray-500'>Máximo 500 unidades por lote</p>
      </div>

      {/* Números de Serie */}
      <div className='space-y-2'>
        <Label htmlFor='serialNumbers'>
          Números de Serie (opcional)
          {quantity > 1 && <span className='text-gray-500 ml-2'>- {quantity} requeridos</span>}
        </Label>
        <Textarea
          id='serialNumbers'
          value={serialsText}
          onChange={e => setSerialsText(e.target.value)}
          placeholder={`Ingrese un número de serie por línea\nEj:\nSN001\nSN002\nSN003`}
          rows={Math.min(quantity, 10)}
          className={!serialValidation.valid ? 'border-red-500' : ''}
        />
        {!serialValidation.valid && (
          <p className='text-sm text-red-500'>{serialValidation.message}</p>
        )}
        <p className='text-sm text-gray-500'>
          Ingrese un número de serie por línea. Si no se proporcionan, se generarán automáticamente.
        </p>
      </div>

      {/* Proveedor */}
      <div className='space-y-2'>
        <Label htmlFor='supplierId'>Proveedor</Label>
        <select
          id='supplierId'
          {...register('supplierId')}
          className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
        >
          <option value=''>Seleccionar proveedor...</option>
          {suppliers.map(supplier => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </select>
        {errors.supplierId && <p className='text-sm text-red-500'>{errors.supplierId.message}</p>}
      </div>

      {/* Número de Factura */}
      <div className='space-y-2'>
        <Label htmlFor='invoiceNumber'>Número de Factura</Label>
        <Input id='invoiceNumber' {...register('invoiceNumber')} placeholder='Ej: FAC-2024-001' />
        {errors.invoiceNumber && (
          <p className='text-sm text-red-500'>{errors.invoiceNumber.message}</p>
        )}
      </div>

      {/* Precio de Compra */}
      <div className='space-y-2'>
        <Label htmlFor='purchasePrice'>Precio de Compra (por unidad)</Label>
        <Input
          id='purchasePrice'
          type='number'
          step='0.01'
          min={0}
          {...register('purchasePrice', { valueAsNumber: true })}
          placeholder='Ej: 1500.00'
        />
        {errors.purchasePrice && (
          <p className='text-sm text-red-500'>{errors.purchasePrice.message}</p>
        )}
      </div>

      {/* Fecha de Compra */}
      <div className='space-y-2'>
        <Label htmlFor='purchaseDate'>Fecha de Compra</Label>
        <Input id='purchaseDate' type='date' {...register('purchaseDate')} />
        {errors.purchaseDate && (
          <p className='text-sm text-red-500'>{errors.purchaseDate.message}</p>
        )}
      </div>

      {/* Bodega */}
      <div className='space-y-2'>
        <Label htmlFor='warehouseId'>Bodega</Label>
        <select
          id='warehouseId'
          {...register('warehouseId')}
          className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
        >
          <option value=''>Seleccionar bodega...</option>
          {warehouses.map(warehouse => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </select>
        {errors.warehouseId && <p className='text-sm text-red-500'>{errors.warehouseId.message}</p>}
      </div>

      {/* Notas */}
      <div className='space-y-2'>
        <Label htmlFor='notes'>Notas</Label>
        <Textarea
          id='notes'
          {...register('notes')}
          placeholder='Notas adicionales sobre el lote...'
          rows={3}
        />
        {errors.notes && <p className='text-sm text-red-500'>{errors.notes.message}</p>}
      </div>

      {/* Botones */}
      <div className='flex justify-end gap-3 pt-4'>
        {onCancel && (
          <Button type='button' variant='outline' onClick={onCancel} disabled={isLoading}>
            Cancelar
          </Button>
        )}
        <Button type='submit' disabled={isLoading || !serialValidation.valid}>
          {isLoading && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
          Crear Lote
        </Button>
      </div>
    </form>
  )
}
