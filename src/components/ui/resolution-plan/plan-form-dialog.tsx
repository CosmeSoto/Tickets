import { Input } from '../input'
import { Textarea } from '../textarea'
import { Button } from '../button'
import { Clock, AlertCircle } from 'lucide-react'
import type { PlanFormData } from '@/hooks/use-resolution-plan'
import { formatDuration } from '@/lib/utils/time-utils'
import { DatePickerWithTime } from '@/components/ui/date-time-picker'

interface PlanFormDialogProps {
  planForm: PlanFormData
  setPlanForm: (form: PlanFormData | ((prev: PlanFormData) => PlanFormData)) => void
  onSubmit: () => void
  onCancel: () => void
  mode: 'create' | 'edit'
}

export function PlanFormDialog({
  planForm,
  setPlanForm,
  onSubmit,
  onCancel,
  mode,
}: PlanFormDialogProps) {
  // Calcular horas estimadas automáticamente
  const calculateEstimatedHours = () => {
    if (planForm.startDate && planForm.targetDate) {
      const start = new Date(`${planForm.startDate}T${planForm.startTime || '09:00'}`)
      const target = new Date(`${planForm.targetDate}T${planForm.targetTime || '09:00'}`)
      const diffMs = target.getTime() - start.getTime()
      const diffHours = diffMs / (1000 * 60 * 60)
      return diffHours
    }
    return null
  }

  const estimatedHours = calculateEstimatedHours()

  return (
    <form
      className='space-y-4'
      onSubmit={e => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <h3 className='font-medium text-foreground'>
        {mode === 'create' ? 'Nuevo Plan de Resolución' : 'Editar Plan de Resolución'}
      </h3>

      <div className='space-y-3'>
        <div>
          <label className='text-sm font-medium'>Título del Plan *</label>
          <Input
            placeholder='Ej: Reparación del servidor principal'
            value={planForm.title}
            onChange={e => setPlanForm(prev => ({ ...prev, title: e.target.value }))}
          />
        </div>

        <div>
          <label className='text-sm font-medium'>Descripción</label>
          <Textarea
            placeholder='Describe el plan de trabajo...'
            value={planForm.description}
            onChange={e => setPlanForm(prev => ({ ...prev, description: e.target.value }))}
            rows={3}
          />
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div>
            <label className='text-sm font-medium'>Fecha de Inicio</label>
            <DatePickerWithTime
              dateValue={planForm.startDate}
              timeValue={planForm.startTime}
              onDateChange={v => setPlanForm(prev => ({ ...prev, startDate: v }))}
              onTimeChange={v => setPlanForm(prev => ({ ...prev, startTime: v }))}
              showTime
            />
          </div>

          <div>
            <label className='text-sm font-medium'>Fecha Objetivo</label>
            <DatePickerWithTime
              dateValue={planForm.targetDate}
              timeValue={planForm.targetTime}
              onDateChange={v => setPlanForm(prev => ({ ...prev, targetDate: v }))}
              onTimeChange={v => setPlanForm(prev => ({ ...prev, targetTime: v }))}
              showTime
            />
          </div>
        </div>

        {/* Cálculo automático de horas estimadas */}
        {estimatedHours !== null &&
          (estimatedHours > 0 ? (
            <div className='bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3'>
              <div className='flex items-center space-x-2'>
                <Clock className='h-4 w-4 text-blue-600 dark:text-blue-400' />
                <div>
                  <p className='text-sm font-medium text-blue-900 dark:text-blue-100'>
                    Horas Estimadas Totales: {formatDuration(estimatedHours)}
                  </p>
                  <p className='text-xs text-blue-700 dark:text-blue-300'>
                    Calculado automáticamente desde{' '}
                    {new Date(`${planForm.startDate}T${planForm.startTime}`).toLocaleString(
                      'es-ES',
                      {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      }
                    )}{' '}
                    hasta{' '}
                    {new Date(`${planForm.targetDate}T${planForm.targetTime}`).toLocaleString(
                      'es-ES',
                      {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      }
                    )}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className='bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3'>
              <div className='flex items-center space-x-2'>
                <AlertCircle className='h-4 w-4 text-red-600 dark:text-red-400' />
                <p className='text-sm text-red-900 dark:text-red-100'>
                  La fecha objetivo debe ser posterior a la fecha de inicio
                </p>
              </div>
            </div>
          ))}

        <div className='flex items-center space-x-2 pt-2'>
          <Button type='submit'>{mode === 'create' ? 'Crear Plan' : 'Actualizar Plan'}</Button>
          <Button type='button' variant='outline' onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </div>
    </form>
  )
}
