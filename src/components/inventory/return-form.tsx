'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { createReturnActSchema, type CreateReturnActInput } from '@/lib/validations/inventory/return-act'

interface ReturnFormProps {
  assignmentId: string
  equipmentCode: string
  equipmentDescription: string
  accessories: string[]
  onSuccess?: () => void
  onCancel?: () => void
}

const conditionOptions = [
  { value: 'EXCELLENT', label: 'Excelente', description: 'Sin desgaste, como nuevo' },
  { value: 'GOOD', label: 'Bueno', description: 'Desgaste mínimo, funciona perfectamente' },
  { value: 'FAIR', label: 'Regular', description: 'Desgaste visible, funciona correctamente' },
  { value: 'POOR', label: 'Malo', description: 'Desgaste significativo, requiere mantenimiento' },
  { value: 'DAMAGED', label: 'Dañado', description: 'No funciona correctamente, requiere reparación' },
]

export function ReturnForm({
  assignmentId,
  equipmentCode,
  equipmentDescription,
  accessories,
  onSuccess,
  onCancel,
}: ReturnFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [missingAccessories, setMissingAccessories] = useState<string[]>([])

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateReturnActInput>({
    resolver: zodResolver(createReturnActSchema),
    defaultValues: {
      assignmentId,
      returnCondition: 'GOOD',
      returnDate: new Date(),
    },
  })

  const selectedCondition = watch('returnCondition')
  const showDamageField = selectedCondition === 'DAMAGED' || selectedCondition === 'POOR'

  const toggleAccessory = (accessory: string) => {
    setMissingAccessories(prev =>
      prev.includes(accessory)
        ? prev.filter(a => a !== accessory)
        : [...prev, accessory]
    )
  }

  const onSubmit = async (data: CreateReturnActInput) => {
    try {
      setIsSubmitting(true)
      setError(null)

      const response = await fetch('/api/inventory/assignments/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          missingAccessories: missingAccessories.length > 0 ? missingAccessories : undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al crear acta de devolución')
      }

      const result = await response.json()

      if (onSuccess) {
        onSuccess()
      } else {
        router.push(`/inventory/acts/return/${result.id}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Información del equipo */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-sm font-medium text-gray-900 mb-2">Equipo a devolver</h3>
        <p className="text-sm text-gray-600">
          <span className="font-medium">{equipmentCode}</span> - {equipmentDescription}
        </p>
      </div>

      {/* Condición de devolución */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Condición del equipo <span className="text-red-500">*</span>
        </label>
        <div className="space-y-2">
          {conditionOptions.map((option) => (
            <label
              key={option.value}
              className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${
                selectedCondition === option.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input
                type="radio"
                value={option.value}
                {...register('returnCondition')}
                className="mt-1 mr-3"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">{option.label}</div>
                <div className="text-sm text-gray-600">{option.description}</div>
              </div>
            </label>
          ))}
        </div>
        {errors.returnCondition && (
          <p className="mt-1 text-sm text-red-600">{errors.returnCondition.message}</p>
        )}
      </div>

      {/* Fecha de devolución */}
      <div>
        <label htmlFor="returnDate" className="block text-sm font-medium text-gray-700 mb-1">
          Fecha de devolución
        </label>
        <input
          type="date"
          id="returnDate"
          {...register('returnDate')}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.returnDate && (
          <p className="mt-1 text-sm text-red-600">{errors.returnDate.message}</p>
        )}
      </div>

      {/* Accesorios */}
      {accessories.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Accesorios (marcar los que faltan)
          </label>
          <div className="space-y-2">
            {accessories.map((accessory, index) => (
              <label
                key={index}
                className="flex items-center p-2 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={missingAccessories.includes(accessory)}
                  onChange={() => toggleAccessory(accessory)}
                  className="mr-3"
                />
                <span className={missingAccessories.includes(accessory) ? 'text-red-600 line-through' : ''}>
                  {accessory}
                </span>
                {missingAccessories.includes(accessory) && (
                  <span className="ml-auto text-xs text-red-600 font-medium">FALTANTE</span>
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Notas de inspección */}
      <div>
        <label htmlFor="inspectionNotes" className="block text-sm font-medium text-gray-700 mb-1">
          Notas de inspección
        </label>
        <textarea
          id="inspectionNotes"
          {...register('inspectionNotes')}
          rows={4}
          placeholder="Observaciones generales sobre el estado del equipo..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.inspectionNotes && (
          <p className="mt-1 text-sm text-red-600">{errors.inspectionNotes.message}</p>
        )}
      </div>

      {/* Descripción de daños (solo si está dañado o en mal estado) */}
      {showDamageField && (
        <div>
          <label htmlFor="damageDescription" className="block text-sm font-medium text-gray-700 mb-1">
            Descripción de daños <span className="text-red-500">*</span>
          </label>
          <textarea
            id="damageDescription"
            {...register('damageDescription')}
            rows={4}
            placeholder="Describa detalladamente los daños encontrados..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.damageDescription && (
            <p className="mt-1 text-sm text-red-600">{errors.damageDescription.message}</p>
          )}
        </div>
      )}

      {/* Error general */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Botones */}
      <div className="flex justify-end space-x-3 pt-4 border-t">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Creando acta...' : 'Crear acta de devolución'}
        </button>
      </div>
    </form>
  )
}
