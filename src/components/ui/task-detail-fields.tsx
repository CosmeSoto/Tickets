import { Textarea } from './textarea'
import { DateInput } from '@/components/ui/date-input'
import { TimePicker } from '@/components/ui/time-picker'
import { calculateDuration } from '@/lib/utils/time-utils'

export type TaskPriority = 'low' | 'medium' | 'high'

export interface TaskDetailFieldsValue {
  description: string
  priority: TaskPriority
  dueDate: string
  startTime: string
  endTime: string
}

/** Bloque de campos opcionales de una tarea (descripción, prioridad, fecha,
 *  horario) — compartido entre las tareas de ticket (task-list.tsx) y las
 *  tareas independientes (personal-task-dialog.tsx) para no duplicar el JSX. */
export function TaskDetailFields({
  description,
  priority,
  dueDate,
  startTime,
  endTime,
  onChange,
}: TaskDetailFieldsValue & { onChange: (patch: Partial<TaskDetailFieldsValue>) => void }) {
  return (
    <div className='space-y-3'>
      <Textarea
        placeholder='Descripción (opcional)'
        value={description}
        onChange={e => onChange({ description: e.target.value })}
        rows={2}
      />
      <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
        <select
          value={priority}
          onChange={e => onChange({ priority: e.target.value as TaskPriority })}
          className='px-3 py-2 border border-border rounded-md text-sm bg-background'
        >
          <option value='low'>Prioridad Baja</option>
          <option value='medium'>Prioridad Media</option>
          <option value='high'>Prioridad Alta</option>
        </select>
        <DateInput
          value={dueDate}
          onChange={e => onChange({ dueDate: e.target.value })}
          placeholder='Fecha programada'
          clearable
        />
      </div>
      <div>
        <label className='text-sm font-medium'>Horario de la Tarea</label>
        <div className='grid grid-cols-2 gap-2 mt-1'>
          <div>
            <label className='text-xs text-muted-foreground'>Hora inicio</label>
            <TimePicker value={startTime} onChange={v => onChange({ startTime: v })} />
          </div>
          <div>
            <label className='text-xs text-muted-foreground'>Hora fin</label>
            <TimePicker value={endTime} onChange={v => onChange({ endTime: v })} />
          </div>
        </div>
        {startTime && endTime && (
          <p className='text-xs text-muted-foreground mt-1'>
            Duración: {calculateDuration(startTime, endTime)}
          </p>
        )}
      </div>
    </div>
  )
}
