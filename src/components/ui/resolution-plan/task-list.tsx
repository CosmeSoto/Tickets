import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../card'
import { Button } from '../button'
import { Badge } from '../badge'
import { Input } from '../input'
import { DateInput } from '@/components/ui/date-input'
import { Textarea } from '../textarea'
import {
  Plus,
  Circle,
  Calendar,
  Target,
  User,
  Clock,
  MoreVertical,
  Trash2,
  CheckCircle,
  PlayCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Pencil,
  Save,
  X,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../dropdown-menu'
import type { ResolutionPlan, TaskFormData, ResolutionTask } from '@/hooks/use-resolution-plan'
import { getStatusIcon, getStatusBadge } from './plan-status-icons'
import { formatDate, getPriorityColor, getPriorityLabel } from './plan-helpers'
import { formatDuration, calculateDuration } from '@/lib/utils/time-utils'
import { toLocalDateAndTimeParts } from '@/lib/forms/form-date'
import { TimePicker } from '@/components/ui/time-picker'

interface TaskEditForm {
  title: string
  description: string
  priority: ResolutionTask['priority']
  dueDate: string
  startTime: string
  endTime: string
}

const EMPTY_EDIT_FORM: TaskEditForm = {
  title: '',
  description: '',
  priority: 'medium',
  dueDate: '',
  startTime: '',
  endTime: '',
}

interface TaskListProps {
  plan: ResolutionPlan
  canEdit: boolean
  showAddTask: boolean
  setShowAddTask: (show: boolean) => void
  newTask: TaskFormData
  setNewTask: (task: TaskFormData | ((prev: TaskFormData) => TaskFormData)) => void
  onAddTask: () => void
  onUpdateTask: (taskId: string, updates: Partial<TaskEditForm>) => Promise<boolean>
  onUpdateTaskStatus: (taskId: string, status: ResolutionTask['status']) => void
  onDeleteTask: (taskId: string) => void
}

/** Bloque de campos opcionales (descripción, prioridad, fecha, horario) — se
 *  reutiliza tanto en el quick-add como en el formulario de edición. */
function TaskDetailFields({
  description,
  priority,
  dueDate,
  startTime,
  endTime,
  onChange,
}: {
  description: string
  priority: ResolutionTask['priority']
  dueDate: string
  startTime: string
  endTime: string
  onChange: (patch: Partial<TaskEditForm>) => void
}) {
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
          onChange={e => onChange({ priority: e.target.value as ResolutionTask['priority'] })}
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

export function TaskList({
  plan,
  canEdit,
  showAddTask,
  setShowAddTask,
  newTask,
  setNewTask,
  onAddTask,
  onUpdateTask,
  onUpdateTaskStatus,
  onDeleteTask,
}: TaskListProps) {
  // Progressive disclosure del quick-add: por defecto solo pide título (estilo
  // Microsoft Planner) — descripción/prioridad/fecha/horario quedan ocultos
  // detrás de "Agregar detalles" para quien los necesite.
  const [showQuickAddDetails, setShowQuickAddDetails] = useState(false)

  // Edición de una tarea existente (título/detalles) — el checkbox y el menú
  // "Cambiar Estado" siguen siendo la forma normal de marcarla como resuelta.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<TaskEditForm>(EMPTY_EDIT_FORM)
  const [savingEdit, setSavingEdit] = useState(false)

  const startEditing = (task: ResolutionTask) => {
    const { date } = toLocalDateAndTimeParts(task.dueDate)
    setEditForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      dueDate: date,
      startTime: task.startTime || '',
      endTime: task.endTime || '',
    })
    setEditingId(task.id)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditForm(EMPTY_EDIT_FORM)
  }

  const saveEditing = async () => {
    if (!editingId || !editForm.title.trim()) return
    setSavingEdit(true)
    const ok = await onUpdateTask(editingId, editForm)
    setSavingEdit(false)
    if (ok) cancelEditing()
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <CardTitle>Tareas del Plan</CardTitle>
          {canEdit && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={() => setShowAddTask(true)} size='sm' variant='outline'>
                    <Plus className='h-4 w-4 mr-2' />
                    Agregar Tarea
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Agrega una nueva tarea al plan de resolución</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Quick-add: solo título por defecto, como en Microsoft Planner */}
        {showAddTask && (
          <div className='mb-6 p-4 border rounded-lg bg-muted/30'>
            <h4 className='font-medium text-foreground mb-3'>Nueva Tarea</h4>
            <div className='space-y-3'>
              <div className='flex items-center gap-2'>
                <Input
                  autoFocus
                  placeholder='¿Qué hay que hacer?'
                  value={newTask.title}
                  onChange={e => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newTask.title.trim()) onAddTask()
                  }}
                />
                <Button onClick={onAddTask} size='sm' disabled={!newTask.title.trim()}>
                  Agregar
                </Button>
                <Button
                  onClick={() => {
                    setShowAddTask(false)
                    setShowQuickAddDetails(false)
                  }}
                  variant='outline'
                  size='sm'
                >
                  Cancelar
                </Button>
              </div>

              <button
                type='button'
                onClick={() => setShowQuickAddDetails(v => !v)}
                className='flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors'
              >
                {showQuickAddDetails ? (
                  <ChevronUp className='h-3 w-3' />
                ) : (
                  <ChevronDown className='h-3 w-3' />
                )}
                {showQuickAddDetails ? 'Ocultar detalles' : 'Agregar detalles (opcional)'}
              </button>

              {showQuickAddDetails && (
                <TaskDetailFields
                  description={newTask.description}
                  priority={newTask.priority}
                  dueDate={newTask.dueDate}
                  startTime={newTask.startTime}
                  endTime={newTask.endTime}
                  onChange={patch => setNewTask(prev => ({ ...prev, ...patch }))}
                />
              )}
            </div>
          </div>
        )}

        {/* Lista de tareas */}
        <div className='space-y-3'>
          {plan.tasks.length === 0 ? (
            <div className='text-center py-8 text-muted-foreground'>
              <Circle className='h-12 w-12 mx-auto mb-4 text-muted-foreground/50' />
              <p>No hay tareas en este plan</p>
            </div>
          ) : (
            plan.tasks.map(task => {
              const isEditing = editingId === task.id

              if (isEditing) {
                return (
                  <div key={task.id} className='p-4 border rounded-lg bg-muted/30 space-y-3'>
                    <Input
                      autoFocus
                      placeholder='Título de la tarea'
                      value={editForm.title}
                      onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                    />
                    <TaskDetailFields
                      description={editForm.description}
                      priority={editForm.priority}
                      dueDate={editForm.dueDate}
                      startTime={editForm.startTime}
                      endTime={editForm.endTime}
                      onChange={patch => setEditForm(prev => ({ ...prev, ...patch }))}
                    />
                    <div className='flex items-center space-x-2'>
                      <Button
                        onClick={saveEditing}
                        size='sm'
                        disabled={!editForm.title.trim() || savingEdit}
                      >
                        <Save className='h-3.5 w-3.5 mr-2' />
                        {savingEdit ? 'Guardando…' : 'Guardar'}
                      </Button>
                      <Button onClick={cancelEditing} variant='outline' size='sm'>
                        <X className='h-3.5 w-3.5 mr-2' />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={task.id}
                  className='flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors'
                >
                  {/* Checkbox/Status */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() =>
                            canEdit &&
                            onUpdateTaskStatus(
                              task.id,
                              task.status === 'completed' ? 'pending' : 'completed'
                            )
                          }
                          disabled={!canEdit}
                          className='mt-1 disabled:opacity-50 disabled:cursor-not-allowed'
                        >
                          {getStatusIcon(task.status)}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {task.status === 'completed'
                            ? 'Marcar como pendiente'
                            : 'Marcar como completada'}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {/* Contenido de la tarea */}
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-start justify-between gap-2'>
                      <h4
                        className={`font-medium ${
                          task.status === 'completed'
                            ? 'line-through text-muted-foreground'
                            : 'text-foreground'
                        }`}
                      >
                        {task.title}
                      </h4>
                      <div className='flex items-center space-x-2 flex-shrink-0'>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge className={getPriorityColor(task.priority)}>
                                {getPriorityLabel(task.priority)}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Prioridad de la tarea</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {getStatusBadge(task.status)}
                      </div>
                    </div>

                    {task.description && (
                      <p className='text-sm text-muted-foreground mt-1'>{task.description}</p>
                    )}

                    {/* Información contextual */}
                    <div className='space-y-2 mt-3'>
                      {/* Fechas */}
                      <div className='flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground'>
                        <div className='flex items-center space-x-1'>
                          <Calendar className='h-3 w-3' />
                          <span>Creada: {formatDate(task.createdAt)}</span>
                        </div>

                        {task.dueDate && (
                          <div className='flex items-center space-x-1'>
                            <Target className='h-3 w-3' />
                            <span>Vence: {formatDate(task.dueDate)}</span>
                          </div>
                        )}

                        {task.completedAt && (
                          <div className='flex items-center space-x-1 text-green-600 dark:text-green-400'>
                            <CheckCircle className='h-3 w-3' />
                            <span>Completada: {formatDate(task.completedAt)}</span>
                          </div>
                        )}
                      </div>

                      {/* Asignación */}
                      {task.assignedTo && (
                        <div className='flex items-center space-x-1 text-xs text-muted-foreground'>
                          <User className='h-3 w-3' />
                          <span>Asignado a: {task.assignedTo.name}</span>
                        </div>
                      )}

                      {/* Estimación vs Real */}
                      {(task.estimatedHours || task.actualHours) && (
                        <div className='flex items-center space-x-4 text-xs'>
                          {task.estimatedHours && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className='flex items-center space-x-1 text-yellow-600 dark:text-yellow-400'>
                                    <Target className='h-3 w-3' />
                                    <span>Estimado: {formatDuration(task.estimatedHours)}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Tiempo estimado para completar esta tarea</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {task.actualHours && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className='flex items-center space-x-1 text-purple-600 dark:text-purple-400'>
                                    <Clock className='h-3 w-3' />
                                    <span>Real: {formatDuration(task.actualHours)}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Tiempo real que tomó completar esta tarea</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Menú de acciones */}
                  {canEdit && (
                    <DropdownMenu>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                              <Button variant='ghost' size='sm' className='h-8 w-8 p-0'>
                                <MoreVertical className='h-4 w-4' />
                              </Button>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Acciones de la tarea</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <DropdownMenuContent align='end' className='w-48'>
                        <DropdownMenuItem onClick={() => startEditing(task)}>
                          <Pencil className='h-4 w-4 mr-2' />
                          <div className='flex flex-col'>
                            <span>Editar</span>
                            <span className='text-xs text-muted-foreground'>
                              Título, prioridad, fecha…
                            </span>
                          </div>
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        {/* Cambiar estado */}
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <Circle className='h-4 w-4 mr-2' />
                            Cambiar Estado
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            <DropdownMenuItem
                              onClick={() => onUpdateTaskStatus(task.id, 'pending')}
                            >
                              <Clock className='h-4 w-4 mr-2' />
                              <div className='flex flex-col'>
                                <span>Pendiente</span>
                                <span className='text-xs text-muted-foreground'>
                                  Tarea no iniciada
                                </span>
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onUpdateTaskStatus(task.id, 'in_progress')}
                            >
                              <PlayCircle className='h-4 w-4 mr-2' />
                              <div className='flex flex-col'>
                                <span>En Progreso</span>
                                <span className='text-xs text-muted-foreground'>
                                  Trabajando activamente
                                </span>
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onUpdateTaskStatus(task.id, 'completed')}
                            >
                              <CheckCircle className='h-4 w-4 mr-2' />
                              <div className='flex flex-col'>
                                <span>Completada</span>
                                <span className='text-xs text-muted-foreground'>
                                  Terminada exitosamente
                                </span>
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onUpdateTaskStatus(task.id, 'blocked')}
                            >
                              <XCircle className='h-4 w-4 mr-2' />
                              <div className='flex flex-col'>
                                <span>Bloqueada</span>
                                <span className='text-xs text-muted-foreground'>
                                  No se puede continuar
                                </span>
                              </div>
                            </DropdownMenuItem>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>

                        <DropdownMenuSeparator />

                        {/* Eliminar */}
                        <DropdownMenuItem
                          onClick={() => onDeleteTask(task.id)}
                          className='text-destructive focus:text-destructive'
                        >
                          <Trash2 className='h-4 w-4 mr-2' />
                          <div className='flex flex-col'>
                            <span>Eliminar Tarea</span>
                            <span className='text-xs text-muted-foreground'>
                              Eliminar permanentemente
                            </span>
                          </div>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}
