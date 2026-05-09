/**
 * BulkEquipmentForm
 *
 * Formulario moderno y compacto para crear múltiples equipos idénticos
 * - Diseño optimizado con header integrado
 * - Selectores visuales modernos (Combobox, SearchableSelect)
 * - Validación en tiempo real
 * - Layout de 2 columnas para aprovechar espacio
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select'
import { SimpleSelect } from '@/components/ui/simple-select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle2, AlertCircle, Package, ArrowLeft } from 'lucide-react'
import { bulkEquipmentInputSchema } from '@/lib/validations/bulk-equipment'
import type { BulkCreateResult } from '@/types/equipment-grouping'
import { StockIndicatorBadge } from '@/components/inventory/equipment/StockIndicatorBadge'
import { useActiveDepartments } from '@/contexts/departments-context'

export interface BulkEquipmentFormProps {
  onSuccess?: (result: BulkCreateResult) => void
  onCancel?: () => void
  prefillData?: Partial<BulkEquipmentFormData>
}

type BulkEquipmentFormData = z.infer<typeof bulkEquipmentInputSchema>

interface EquipmentType {
  id: string
  code: string
  name: string
  family?: { id: string; name: string } | null
}

export function BulkEquipmentForm({ onSuccess, onCancel, prefillData }: BulkEquipmentFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successResult, setSuccessResult] = useState<BulkCreateResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([])
  const [loadingTypes, setLoadingTypes] = useState(true)

  // Departamentos desde contexto global
  const { departments: allDepartments } = useActiveDepartments()

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
  const selectedTypeId = watch('typeId')
  const selectedDepartmentId = watch('departmentId')

  // Cargar tipos de equipo
  useEffect(() => {
    fetch('/api/admin/equipment-types')
      .then(r => r.json())
      .then(types => setEquipmentTypes(types))
      .catch(() => setEquipmentTypes([]))
      .finally(() => setLoadingTypes(false))
  }, [])

  // Filtrar departamentos por familia del tipo seleccionado
  const selectedTypeFamilyId = equipmentTypes.find(t => t.id === selectedTypeId)?.family?.id
  const filteredDepartments = selectedTypeFamilyId
    ? allDepartments.filter(d => d.familyId === selectedTypeFamilyId)
    : allDepartments

  // Limpiar departamento si ya no pertenece a la familia
  useEffect(() => {
    if (selectedTypeId && selectedDepartmentId) {
      const dept = allDepartments.find(d => d.id === selectedDepartmentId)
      if (dept && selectedTypeFamilyId && dept.familyId !== selectedTypeFamilyId) {
        setValue('departmentId', '')
      }
    }
  }, [selectedTypeId, selectedTypeFamilyId, selectedDepartmentId, allDepartments, setValue])

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
      const manualCodes =
        data.codeMode === 'manual' && data.manualCodes
          ? data.manualCodes.split('\n').filter(line => line.trim())
          : undefined

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Error al crear equipos por lote')
      }

      setSuccessResult(result)
      if (onSuccess) onSuccess(result)
    } catch (err: any) {
      setError(err.message || 'Error desconocido')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Pantalla de éxito
  if (successResult) {
    return (
      <div className='space-y-4'>
        <Button variant='ghost' size='sm' onClick={() => router.back()}>
          <ArrowLeft className='mr-2 h-4 w-4' />
          Volver
        </Button>

        <div className='rounded-lg border border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800 p-6'>
          <div className='flex items-start gap-4'>
            <div className='rounded-full bg-green-100 dark:bg-green-900 p-3'>
              <CheckCircle2 className='h-6 w-6 text-green-600 dark:text-green-400' />
            </div>
            <div className='flex-1 space-y-3'>
              <div>
                <h2 className='text-xl font-semibold text-green-900 dark:text-green-100'>
                  ¡Equipos creados exitosamente!
                </h2>
                <p className='text-sm text-green-700 dark:text-green-300 mt-1'>
                  Se crearon {successResult.summary.total} equipos idénticos
                </p>
              </div>

              <div className='rounded-md bg-white dark:bg-green-900/30 p-4 space-y-2 text-sm'>
                <p className='text-muted-foreground'>
                  <strong>Primer código:</strong> {successResult.summary.firstCode}
                </p>
                <p className='text-muted-foreground'>
                  <strong>Último código:</strong> {successResult.summary.lastCode}
                </p>
              </div>

              <div className='flex gap-2 pt-2'>
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
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className='space-y-6'>
      {/* Header integrado */}
      <div className='flex items-center justify-between'>
        <div>
          <div className='flex items-center gap-3 mb-2'>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => router.back()}
              className='h-8 w-8 p-0'
            >
              <ArrowLeft className='h-4 w-4' />
            </Button>
            <h1 className='text-2xl font-bold'>Crear Equipos por Lote</h1>
          </div>
          <p className='text-sm text-muted-foreground ml-11'>
            Crea múltiples equipos idénticos en una sola operación
          </p>
        </div>
        <div className='text-right'>
          <div className='text-3xl font-bold text-primary'>{quantity}</div>
          <div className='text-xs text-muted-foreground'>
            {quantity === 1 ? 'equipo' : 'equipos'}
          </div>
        </div>
      </div>

      {/* Error general */}
      {error && (
        <Alert variant='destructive'>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Sección: Cantidad y Códigos */}
      <div className='rounded-lg border bg-card p-5 space-y-4'>
        <div>
          <h3 className='font-semibold mb-1'>Cantidad y Códigos</h3>
          <p className='text-xs text-muted-foreground'>
            Define cuántas unidades crear y cómo generar sus códigos
          </p>
        </div>

        <div className='grid grid-cols-2 gap-4'>
          {/* Cantidad */}
          <div className='space-y-1.5'>
            <Label htmlFor='quantity'>
              Cantidad <span className='text-destructive'>*</span>
            </Label>
            <Input
              id='quantity'
              type='number'
              min={1}
              max={100}
              {...register('quantity', { valueAsNumber: true })}
            />
            {errors.quantity && (
              <p className='text-xs text-destructive'>{errors.quantity.message}</p>
            )}
          </div>

          {/* Modo de códigos */}
          <div className='space-y-1.5'>
            <Label>
              Modo de códigos <span className='text-destructive'>*</span>
            </Label>
            <RadioGroup
              value={codeMode}
              onValueChange={value => setValue('codeMode', value as 'auto' | 'manual')}
              className='flex gap-4 pt-2'
            >
              <div className='flex items-center space-x-2'>
                <RadioGroupItem value='auto' id='auto' />
                <Label htmlFor='auto' className='font-normal cursor-pointer text-sm'>
                  Auto
                </Label>
              </div>
              <div className='flex items-center space-x-2'>
                <RadioGroupItem value='manual' id='manual' />
                <Label htmlFor='manual' className='font-normal cursor-pointer text-sm'>
                  Manual
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        {/* Códigos manuales */}
        {codeMode === 'manual' && (
          <div className='space-y-1.5'>
            <Label htmlFor='manualCodes'>
              Códigos (uno por línea) <span className='text-destructive'>*</span>
            </Label>
            <Textarea
              id='manualCodes'
              placeholder='LAP-001&#10;LAP-002&#10;LAP-003'
              rows={Math.min(quantity, 8)}
              {...register('manualCodes')}
              className='font-mono text-sm'
            />
            <div className='flex items-center justify-between text-xs'>
              <span className={manualCodesValid ? 'text-muted-foreground' : 'text-destructive'}>
                {manualCodesCount} de {quantity} códigos
              </span>
              {!manualCodesValid && (
                <span className='text-destructive'>Faltan {quantity - manualCodesCount}</span>
              )}
            </div>
          </div>
        )}

        {/* Números de serie */}
        <div className='space-y-1.5'>
          <Label htmlFor='serialNumbers'>Números de serie (opcional, uno por línea)</Label>
          <Textarea
            id='serialNumbers'
            placeholder='SN123456&#10;SN789012'
            rows={Math.min(quantity, 6)}
            {...register('serialNumbers')}
            className='font-mono text-sm'
          />
          <div className='flex items-center justify-between text-xs'>
            <span className={serialNumbersValid ? 'text-muted-foreground' : 'text-destructive'}>
              {serialNumbersCount} números de serie
            </span>
            {!serialNumbersValid && (
              <span className='text-destructive'>
                Debe ser 0 o {quantity} (tienes {serialNumbersCount})
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Sección: Datos del Equipo */}
      <div className='rounded-lg border bg-card p-5 space-y-4'>
        <div>
          <h3 className='font-semibold mb-1'>Datos Comunes del Equipo</h3>
          <p className='text-xs text-muted-foreground'>
            Información compartida por todas las unidades del lote
          </p>
        </div>

        <div className='grid grid-cols-2 gap-4'>
          {/* Marca */}
          <div className='space-y-1.5'>
            <Label htmlFor='brand'>
              Marca <span className='text-destructive'>*</span>
            </Label>
            <Input id='brand' placeholder='Dell' {...register('brand')} />
            {errors.brand && <p className='text-xs text-destructive'>{errors.brand.message}</p>}
          </div>

          {/* Modelo */}
          <div className='space-y-1.5'>
            <Label htmlFor='model'>
              Modelo <span className='text-destructive'>*</span>
            </Label>
            <Input id='model' placeholder='Latitude 5420' {...register('model')} />
            {errors.model && <p className='text-xs text-destructive'>{errors.model.message}</p>}
          </div>

          {/* Tipo de equipo */}
          <div className='space-y-1.5 col-span-2'>
            <Label>
              Tipo de equipo <span className='text-destructive'>*</span>
            </Label>
            {loadingTypes ? (
              <div className='flex items-center justify-center h-10 border rounded-md'>
                <Loader2 className='h-4 w-4 animate-spin text-muted-foreground' />
              </div>
            ) : (
              <Combobox
                options={equipmentTypes.map(
                  (type): ComboboxOption => ({
                    value: type.id,
                    label: type.name,
                  })
                )}
                value={selectedTypeId || ''}
                onValueChange={value => setValue('typeId', value, { shouldValidate: true })}
                placeholder='Buscar tipo de equipo...'
                searchPlaceholder='Escriba para buscar...'
                emptyText='No se encontró el tipo'
              />
            )}
            {errors.typeId && <p className='text-xs text-destructive'>{errors.typeId.message}</p>}
          </div>

          {/* Stock Indicator */}
          {watch('brand') && watch('model') && watch('typeId') && (
            <div className='col-span-2'>
              <StockIndicatorBadge
                brand={watch('brand')}
                model={watch('model')}
                typeId={watch('typeId')}
              />
            </div>
          )}

          {/* Departamento */}
          <div className='space-y-1.5 col-span-2'>
            <Label>
              Departamento <span className='text-destructive'>*</span>
            </Label>
            <SearchableSelect
              options={filteredDepartments.map(
                (d): SearchableSelectOption => ({
                  id: d.id,
                  name: d.name,
                })
              )}
              value={selectedDepartmentId || ''}
              onChange={value => setValue('departmentId', value, { shouldValidate: true })}
              placeholder={
                selectedTypeId && filteredDepartments.length === 0
                  ? 'No hay departamentos para esta familia'
                  : 'Buscar departamento...'
              }
            />
            {errors.departmentId && (
              <p className='text-xs text-destructive'>{errors.departmentId.message}</p>
            )}
          </div>

          {/* Condición */}
          <div className='space-y-1.5'>
            <Label>
              Condición <span className='text-destructive'>*</span>
            </Label>
            <SimpleSelect
              value={watch('condition')}
              onChange={e => setValue('condition', e.target.value as any)}
            >
              <option value='NEW'>Nuevo</option>
              <option value='LIKE_NEW'>Como Nuevo</option>
              <option value='GOOD'>Bueno</option>
              <option value='FAIR'>Regular</option>
              <option value='POOR'>Malo</option>
            </SimpleSelect>
          </div>

          {/* Tipo de propiedad */}
          <div className='space-y-1.5'>
            <Label>
              Tipo de propiedad <span className='text-destructive'>*</span>
            </Label>
            <SimpleSelect
              value={watch('ownershipType')}
              onChange={e => setValue('ownershipType', e.target.value as any)}
            >
              <option value='FIXED_ASSET'>Activo Fijo</option>
              <option value='RENTAL'>Alquiler</option>
              <option value='LOAN'>Préstamo</option>
            </SimpleSelect>
          </div>

          {/* Precio de compra */}
          <div className='space-y-1.5'>
            <Label htmlFor='purchasePrice'>Precio de compra (opcional)</Label>
            <Input
              id='purchasePrice'
              type='number'
              step='0.01'
              placeholder='0.00'
              {...register('purchasePrice', { valueAsNumber: true })}
            />
          </div>

          {/* Notas */}
          <div className='space-y-1.5 col-span-2'>
            <Label htmlFor='notes'>Notas (opcional)</Label>
            <Textarea
              id='notes'
              rows={2}
              placeholder='Información adicional...'
              {...register('notes')}
            />
          </div>
        </div>
      </div>

      {/* Botones de acción */}
      <div className='flex gap-3 pt-2'>
        {onCancel && (
          <Button type='button' variant='outline' onClick={onCancel} disabled={isSubmitting}>
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
              Creando {quantity} {quantity === 1 ? 'equipo' : 'equipos'}...
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
