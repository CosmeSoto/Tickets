/**
 * BulkEquipmentForm
 *
 * Formulario para crear múltiples equipos idénticos en una sola operación
 * - Campo cantidad (1-100)
 * - Modo de códigos: auto-generado o manual
 * - Textarea para códigos manuales (uno por línea)
 * - Textarea opcional para números de serie (uno por línea)
 * - Todos los campos comunes de equipo
 * - Validación de cantidad, códigos y seriales
 * - Mensaje de éxito con resumen de creación
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle2, AlertCircle, Package } from 'lucide-react'
import { bulkEquipmentInputSchema } from '@/lib/validations/bulk-equipment'
import type { BulkCreateResult } from '@/types/equipment-grouping'

export interface BulkEquipmentFormProps {
  onSuccess?: (result: BulkCreateResult) => void
  onCancel?: () => void
  prefillData?: Partial<BulkEquipmentFormData>
}

type BulkEquipmentFormData = z.infer<typeof bulkEquipmentInputSchema>

export function BulkEquipmentForm({ onSuccess, onCancel, prefillData }: BulkEquipmentFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successResult, setSuccessResult] = useState<BulkCreateResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BulkEquipmentFormData>({
    resolver: zodResolver(bulkEquipmentInputSchema),
    defaultValues: {
      quantity: prefillData?.quantity || 1,
      codeMode: prefillData?.codeMode || 'auto',
      brand: prefillData?.brand || '',
      model: prefillData?.model || '',
      typeId: prefillData?.typeId || '',
      departmentId: prefillData?.departmentId || '',
      condition: prefillData?.condition || 'GOOD',
      ownershipType: prefillData?.ownershipType || 'OWNED',
      ...prefillData,
    },
  })

  const quantity = watch('quantity')
  const codeMode = watch('codeMode')
  const manualCodesText = watch('manualCodes')
  const serialNumbersText = watch('serialNumbers')

  // Validar cantidad de códigos manuales
  const manualCodesCount = manualCodesText
    ? manualCodesText.split('\n').filter(line => line.trim()).length
    : 0

  const manualCodesValid = codeMode === 'manual' ? manualCodesCount === quantity : true

  // Validar cantidad de números de serie
  const serialNumbersCount = serialNumbersText
    ? serialNumbersText.split('\n').filter(line => line.trim()).length
    : 0

  const serialNumbersValid = serialNumbersCount === 0 || serialNumbersCount === quantity

  const onSubmit = async (data: BulkEquipmentFormData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      // Convertir códigos manuales de texto a array
      const manualCodes =
        data.codeMode === 'manual' && data.manualCodes
          ? data.manualCodes.split('\n').filter(line => line.trim())
          : undefined

      // Convertir números de serie de texto a array
      const serialNumbers = data.serialNumbers
        ? data.serialNumbers.split('\n').filter(line => line.trim())
        : undefined

      const payload = {
        ...data,
        manualCodes,
        serialNumbers,
      }

      const response = await fetch('/api/inventory/equipment/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Error al crear equipos por lote')
      }

      setSuccessResult(result)

      if (onSuccess) {
        onSuccess(result)
      }
    } catch (err: any) {
      setError(err.message || 'Error desconocido')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Si la creación fue exitosa, mostrar mensaje de éxito
  if (successResult) {
    return (
      <Card>
        <CardHeader>
          <div className='flex items-center gap-3'>
            <div className='rounded-full bg-green-100 p-2'>
              <CheckCircle2 className='h-6 w-6 text-green-600' />
            </div>
            <div>
              <CardTitle>¡Equipos creados exitosamente!</CardTitle>
              <CardDescription>
                Se crearon {successResult.summary.total} equipos idénticos
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          <Alert>
            <Package className='h-4 w-4' />
            <AlertDescription>
              <strong>{successResult.summary.message}</strong>
            </AlertDescription>
          </Alert>

          <div className='space-y-2'>
            <p className='text-sm text-muted-foreground'>
              <strong>Primer código:</strong> {successResult.summary.firstCode}
            </p>
            <p className='text-sm text-muted-foreground'>
              <strong>Último código:</strong> {successResult.summary.lastCode}
            </p>
          </div>

          <div className='flex gap-2'>
            <Button onClick={() => router.push('/inventory/equipment')} className='flex-1'>
              Ver inventario
            </Button>
            <Button
              variant='outline'
              onClick={() => {
                setSuccessResult(null)
                setError(null)
              }}
              className='flex-1'
            >
              Crear otro lote
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='space-y-6'>
      {/* Error general */}
      {error && (
        <Alert variant='destructive'>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Sección: Cantidad y Códigos */}
      <Card>
        <CardHeader>
          <CardTitle>Cantidad y Códigos</CardTitle>
          <CardDescription>
            Especifica cuántas unidades idénticas deseas crear y cómo generar sus códigos
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {/* Cantidad */}
          <div className='space-y-2'>
            <Label htmlFor='quantity'>
              Cantidad de unidades <span className='text-red-500'>*</span>
            </Label>
            <Input
              id='quantity'
              type='number'
              min={1}
              max={100}
              {...register('quantity', { valueAsNumber: true })}
            />
            {errors.quantity && <p className='text-sm text-red-500'>{errors.quantity.message}</p>}
            <p className='text-xs text-muted-foreground'>Mínimo 1, máximo 100 unidades por lote</p>
          </div>

          {/* Modo de códigos */}
          <div className='space-y-2'>
            <Label>
              Modo de códigos <span className='text-red-500'>*</span>
            </Label>
            <RadioGroup
              value={codeMode}
              onValueChange={value => setValue('codeMode', value as 'auto' | 'manual')}
            >
              <div className='flex items-center space-x-2'>
                <RadioGroupItem value='auto' id='auto' />
                <Label htmlFor='auto' className='font-normal cursor-pointer'>
                  Generar automáticamente
                </Label>
              </div>
              <div className='flex items-center space-x-2'>
                <RadioGroupItem value='manual' id='manual' />
                <Label htmlFor='manual' className='font-normal cursor-pointer'>
                  Ingresar manualmente
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Códigos manuales (solo si codeMode === 'manual') */}
          {codeMode === 'manual' && (
            <div className='space-y-2'>
              <Label htmlFor='manualCodes'>
                Códigos manuales <span className='text-red-500'>*</span>
              </Label>
              <Textarea
                id='manualCodes'
                placeholder='Ingresa un código por línea&#10;Ejemplo:&#10;TECH-LAP-OWN-2024-0001&#10;TECH-LAP-OWN-2024-0002&#10;TECH-LAP-OWN-2024-0003'
                rows={Math.min(quantity, 10)}
                {...register('manualCodes')}
              />
              <div className='flex items-center justify-between text-xs'>
                <span className={manualCodesValid ? 'text-muted-foreground' : 'text-red-500'}>
                  {manualCodesCount} de {quantity} códigos ingresados
                </span>
                {!manualCodesValid && (
                  <span className='text-red-500'>
                    Debes ingresar exactamente {quantity} códigos
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Números de serie (opcional) */}
          <div className='space-y-2'>
            <Label htmlFor='serialNumbers'>Números de serie (opcional)</Label>
            <Textarea
              id='serialNumbers'
              placeholder='Ingresa un número de serie por línea (opcional)&#10;Ejemplo:&#10;SN123456789&#10;SN987654321'
              rows={Math.min(quantity, 10)}
              {...register('serialNumbers')}
            />
            <div className='flex items-center justify-between text-xs'>
              <span className={serialNumbersValid ? 'text-muted-foreground' : 'text-red-500'}>
                {serialNumbersCount} números de serie ingresados
              </span>
              {!serialNumbersValid && (
                <span className='text-red-500'>
                  Debes ingresar exactamente {quantity} números de serie o dejar vacío
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sección: Datos Comunes */}
      <Card>
        <CardHeader>
          <CardTitle>Datos Comunes del Equipo</CardTitle>
          <CardDescription>
            Estos datos serán compartidos por todas las unidades del lote
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {/* Marca */}
          <div className='space-y-2'>
            <Label htmlFor='brand'>
              Marca <span className='text-red-500'>*</span>
            </Label>
            <Input id='brand' {...register('brand')} />
            {errors.brand && <p className='text-sm text-red-500'>{errors.brand.message}</p>}
          </div>

          {/* Modelo */}
          <div className='space-y-2'>
            <Label htmlFor='model'>
              Modelo <span className='text-red-500'>*</span>
            </Label>
            <Input id='model' {...register('model')} />
            {errors.model && <p className='text-sm text-red-500'>{errors.model.message}</p>}
          </div>

          {/* Tipo de equipo */}
          <div className='space-y-2'>
            <Label htmlFor='typeId'>
              Tipo de equipo <span className='text-red-500'>*</span>
            </Label>
            <Input id='typeId' placeholder='ID del tipo de equipo' {...register('typeId')} />
            {errors.typeId && <p className='text-sm text-red-500'>{errors.typeId.message}</p>}
            <p className='text-xs text-muted-foreground'>
              Selecciona el tipo de equipo desde el catálogo
            </p>
          </div>

          {/* Departamento */}
          <div className='space-y-2'>
            <Label htmlFor='departmentId'>
              Departamento <span className='text-red-500'>*</span>
            </Label>
            <Input
              id='departmentId'
              placeholder='ID del departamento'
              {...register('departmentId')}
            />
            {errors.departmentId && (
              <p className='text-sm text-red-500'>{errors.departmentId.message}</p>
            )}
          </div>

          {/* Condición */}
          <div className='space-y-2'>
            <Label htmlFor='condition'>
              Condición <span className='text-red-500'>*</span>
            </Label>
            <Select
              value={watch('condition')}
              onValueChange={value => setValue('condition', value as any)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='NEW'>Nuevo</SelectItem>
                <SelectItem value='GOOD'>Bueno</SelectItem>
                <SelectItem value='FAIR'>Regular</SelectItem>
                <SelectItem value='POOR'>Malo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tipo de propiedad */}
          <div className='space-y-2'>
            <Label htmlFor='ownershipType'>
              Tipo de propiedad <span className='text-red-500'>*</span>
            </Label>
            <Select
              value={watch('ownershipType')}
              onValueChange={value => setValue('ownershipType', value as any)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='OWNED'>Propio</SelectItem>
                <SelectItem value='LEASED'>Arrendado</SelectItem>
                <SelectItem value='RENTED'>Rentado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Precio de compra */}
          <div className='space-y-2'>
            <Label htmlFor='purchasePrice'>Precio de compra (opcional)</Label>
            <Input
              id='purchasePrice'
              type='number'
              step='0.01'
              {...register('purchasePrice', { valueAsNumber: true })}
            />
          </div>

          {/* Notas */}
          <div className='space-y-2'>
            <Label htmlFor='notes'>Notas (opcional)</Label>
            <Textarea id='notes' rows={3} {...register('notes')} />
          </div>
        </CardContent>
      </Card>

      {/* Botones de acción */}
      <div className='flex gap-2'>
        {onCancel && (
          <Button type='button' variant='outline' onClick={onCancel} className='flex-1'>
            Cancelar
          </Button>
        )}
        <Button
          type='submit'
          disabled={isSubmitting || !manualCodesValid || !serialNumbersValid}
          className='flex-1'
        >
          {isSubmitting ? (
            <>
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              Creando {quantity} equipos...
            </>
          ) : (
            <>
              <Package className='mr-2 h-4 w-4' />
              Crear {quantity} {quantity === 1 ? 'equipo' : 'equipos'}
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
