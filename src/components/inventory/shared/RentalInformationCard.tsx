'use client'

import { UseFormRegister, UseFormWatch, UseFormSetValue, FieldErrors } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { CreateEquipmentInput } from '@/lib/validations/inventory/equipment'
import { DateInput } from '@/components/ui/date-input'

interface RentalInformationCardProps {
  register: UseFormRegister<CreateEquipmentInput>
  watch: UseFormWatch<CreateEquipmentInput>
  setValue: UseFormSetValue<CreateEquipmentInput>
  errors: FieldErrors<CreateEquipmentInput>
}

export function RentalInformationCard({
  register,
  watch,
  setValue,
  errors,
}: RentalInformationCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Información de Renta/Alquiler</CardTitle>
        <CardDescription>Datos del proveedor y contrato de renta</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid gap-4 md:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor='rentalProvider'>
              Proveedor <span className='text-destructive'>*</span>
            </Label>
            <Input
              id='rentalProvider'
              {...register('rentalProvider')}
              placeholder='TechRent Solutions'
            />
            {errors.rentalProvider && (
              <p className='text-sm text-destructive'>{errors.rentalProvider.message}</p>
            )}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='rentalContractNumber'>Número de Contrato</Label>
            <Input
              id='rentalContractNumber'
              {...register('rentalContractNumber')}
              placeholder='TR-2026-0123'
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='rentalStartDate'>Fecha de Inicio</Label>
            <DateInput
              id='rentalStartDate'
              value={watch('rentalStartDate')}
              onChange={e =>
                setValue('rentalStartDate', e.target.value as any, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
              clearable
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='rentalEndDate'>Fecha de Fin</Label>
            <DateInput
              id='rentalEndDate'
              value={watch('rentalEndDate')}
              onChange={e =>
                setValue('rentalEndDate', e.target.value as any, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
              clearable
            />
            {errors.rentalEndDate && (
              <p className='text-sm text-destructive'>{errors.rentalEndDate.message}</p>
            )}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='rentalMonthlyCost'>Costo Mensual (USD)</Label>
            <Input
              id='rentalMonthlyCost'
              type='number'
              step='0.01'
              {...register('rentalMonthlyCost', { valueAsNumber: true })}
              placeholder='150.00'
            />
            {errors.rentalMonthlyCost && (
              <p className='text-sm text-destructive'>{errors.rentalMonthlyCost.message}</p>
            )}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='rentalContactName'>Nombre de Contacto</Label>
            <Input
              id='rentalContactName'
              {...register('rentalContactName')}
              placeholder='Juan Pérez'
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='rentalContactEmail'>Email de Contacto</Label>
            <Input
              id='rentalContactEmail'
              type='email'
              {...register('rentalContactEmail')}
              placeholder='contacto@proveedor.com'
            />
            {errors.rentalContactEmail && (
              <p className='text-sm text-destructive'>{errors.rentalContactEmail.message}</p>
            )}
          </div>

          <div className='space-y-2'>
            <Label htmlFor='rentalContactPhone'>Teléfono de Contacto</Label>
            <Input
              id='rentalContactPhone'
              {...register('rentalContactPhone')}
              placeholder='+1-555-0123'
            />
          </div>
        </div>

        <div className='grid gap-4 md:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor='rentalDeliveryDate'>Fecha de entrega</Label>
            <DateInput
              id='rentalDeliveryDate'
              value={watch('rentalDeliveryDate')}
              onChange={e =>
                setValue('rentalDeliveryDate', e.target.value as any, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
              clearable
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='rentalBuyoutValue'>Valor opción de compra</Label>
            <Input
              id='rentalBuyoutValue'
              type='number'
              step='0.01'
              {...register('rentalBuyoutValue', { valueAsNumber: true })}
              placeholder='0.00'
            />
          </div>
          <div className='space-y-2 md:col-span-2'>
            <Label htmlFor='rentalClientResponse'>Respuesta del cliente</Label>
            <select
              id='rentalClientResponse'
              className='flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm'
              {...register('rentalClientResponse')}
            >
              <option value='NOT_NOTIFIED'>No se ha notificado al cliente</option>
              <option value='PENDING_DECISION'>Pendiente de decisión</option>
              <option value='PURCHASE_CONFIRMED'>Compra del equipo confirmada</option>
              <option value='RETURN_REQUESTED'>Devolución solicitada</option>
              <option value='RENEWAL_REQUESTED'>Renovación solicitada</option>
            </select>
          </div>
        </div>

        <div className='space-y-2'>
          <Label htmlFor='rentalNotes'>Notas de Renta</Label>
          <Textarea
            id='rentalNotes'
            {...register('rentalNotes')}
            placeholder='Información adicional sobre el contrato, términos especiales, etc.'
            rows={3}
          />
        </div>
      </CardContent>
    </Card>
  )
}
