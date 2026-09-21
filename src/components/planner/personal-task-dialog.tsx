'use client'

import { useEffect, useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TaskDetailFields, type TaskDetailFieldsValue } from '@/components/ui/task-detail-fields'
import { useFamilyOptions } from '@/hooks/use-family-options'
import type { PersonalTaskInput } from '@/hooks/use-planner-tasks'
import type { PlannerTask } from '@/hooks/use-planner-tasks'
import { toLocalDateAndTimeParts } from '@/lib/forms/form-date'

const EMPTY_FORM: TaskDetailFieldsValue & { title: string; familyId: string } = {
  title: '',
  description: '',
  priority: 'medium',
  dueDate: '',
  startTime: '',
  endTime: '',
  familyId: '',
}

interface PersonalTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Tarea a editar, o null para crear una nueva. */
  task: PlannerTask | null
  /** Fecha/hora sugerida al crear desde un clic en el calendario. */
  initialDate?: Date | null
  initialHour?: number | null
  onCreate: (input: PersonalTaskInput) => Promise<boolean>
  onUpdate: (
    taskId: string,
    input: Partial<PersonalTaskInput> & { status?: PlannerTask['status'] }
  ) => Promise<boolean>
  onDelete: (taskId: string) => Promise<boolean>
}

/** Diálogo de crear/editar una tarea independiente — reusa los mismos campos
 *  que ya existen para tareas de ticket (TaskDetailFields), con un input de
 *  título propio (las tareas de ticket lo resuelven en el quick-add). */
export function PersonalTaskDialog({
  open,
  onOpenChange,
  task,
  initialDate,
  initialHour,
  onCreate,
  onUpdate,
  onDelete,
}: PersonalTaskDialogProps) {
  const { families } = useFamilyOptions()
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!open) return
    if (task) {
      const { date } = toLocalDateAndTimeParts(task.dueDate)
      setForm({
        title: task.title,
        description: task.description ?? '',
        priority: task.priority,
        dueDate: date,
        startTime: task.startTime ?? '',
        endTime: task.endTime ?? '',
        familyId: task.family?.id ?? '',
      })
    } else {
      const date = initialDate
        ? `${initialDate.getFullYear()}-${String(initialDate.getMonth() + 1).padStart(2, '0')}-${String(
            initialDate.getDate()
          ).padStart(2, '0')}`
        : ''
      const startTime = initialHour != null ? `${String(initialHour).padStart(2, '0')}:00` : ''
      setForm({ ...EMPTY_FORM, dueDate: date, startTime })
    }
  }, [open, task, initialDate, initialHour])

  const isEditing = !!task

  const handleSave = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    // null explícito (no undefined) en los campos vacíos: al editar, un campo
    // omitido del body se interpreta como "no tocar" (ver PATCH .../[id]) —
    // enviar undefined aquí haría imposible vaciar una fecha/hora/descripción
    // ya cargada.
    const input: PersonalTaskInput = {
      title: form.title.trim(),
      description: form.description || null,
      priority: form.priority,
      dueDate: form.dueDate || null,
      startTime: form.startTime || null,
      endTime: form.endTime || null,
      familyId: form.familyId || null,
    }
    const ok = isEditing ? await onUpdate(task!.id, input) : await onCreate(input)
    setSaving(false)
    if (ok) onOpenChange(false)
  }

  const handleDelete = async () => {
    if (!task) return
    setDeleting(true)
    const ok = await onDelete(task.id)
    setDeleting(false)
    if (ok) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={v => !saving && !deleting && onOpenChange(v)}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle>
          <DialogDescription>
            Tarea independiente — no está ligada a ningún ticket.
            {isEditing && task?.assignee && ` Creada por ${task.assignee.name}.`}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-2'>
          <div className='space-y-1.5'>
            <Label htmlFor='ptask-title' className='text-sm'>
              Título <span className='text-destructive'>*</span>
            </Label>
            <Input
              id='ptask-title'
              autoFocus
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder='¿Qué hay que hacer?'
              disabled={saving}
              maxLength={200}
            />
          </div>

          <TaskDetailFields
            description={form.description}
            priority={form.priority}
            dueDate={form.dueDate}
            startTime={form.startTime}
            endTime={form.endTime}
            onChange={patch => setForm(f => ({ ...f, ...patch }))}
          />

          {families.length > 0 && (
            <div className='space-y-1.5'>
              <Label htmlFor='ptask-family' className='text-sm'>
                Área (opcional)
              </Label>
              <select
                id='ptask-family'
                value={form.familyId}
                onChange={e => setForm(f => ({ ...f, familyId: e.target.value }))}
                className='w-full px-3 py-2 border border-border rounded-md text-sm bg-background'
              >
                <option value=''>Sin área</option>
                {families.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <DialogFooter className='flex items-center justify-between sm:justify-between'>
          {isEditing ? (
            <Button
              type='button'
              variant='ghost'
              className='text-destructive hover:text-destructive'
              onClick={() => void handleDelete()}
              disabled={saving || deleting}
            >
              {deleting ? (
                <Loader2 className='h-4 w-4 mr-2 animate-spin' />
              ) : (
                <Trash2 className='h-4 w-4 mr-2' />
              )}
              Eliminar
            </Button>
          ) : (
            <span />
          )}
          <div className='flex gap-2'>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type='button'
              onClick={() => void handleSave()}
              disabled={saving || !form.title.trim()}
            >
              {saving && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
              {isEditing ? 'Guardar cambios' : 'Crear tarea'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
