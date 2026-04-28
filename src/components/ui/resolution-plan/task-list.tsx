import { Card, CardContent, CardHeader, CardTitle } from '../card'
import { Button } from '../button'
import { Badge } from '../badge'
import { Input } from '../input'
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
import {
  formatDate,
  formatDuration,
  getPriorityColor,
  getPriorityLabel,
  calculateDuration,
} from './plan-helpers'

interface TaskListProps {
  plan: ResolutionPlan
  canEdit: boolean
  showAddTask: boolean
  setShowAddTask: (show: boolean) => void
  newTask: TaskFormData
  setNewTask: (task: TaskFormData | ((prev: TaskFormData) => TaskFormData)) => void
  onAddTask: () => void
  onUpdateTaskStatus: (taskId: string, status: ResolutionTask['status']) => void
  onDeleteTask: (taskId: string) => void
}

export function TaskList({
  plan,
  canEdit,
  showAddTask,
  setShowAddTask,
  newTask,
  setNewTask,
  onAddTask,
  onUpdateTaskStatus,
  onDeleteTask,
}: TaskListProps) {
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
        {/* Formulario para nueva tarea */}
        {showAddTask && (
          <div className='mb-6 p-4 border rounded-lg bg-muted/30'>
            <h4 className='font-medium text-foreground mb-3'>Nueva Tarea</h4>
            <div className='space-y-3'>
              <Input
                placeholder='Título de la tarea'
                value={newTask.title}
                onChange={e => setNewTask(prev => ({ ...prev, title: e.target.value }))}
              />
              <Textarea
                placeholder='Descripción (opcional)'
                value={newTask.description}
                onChange={e => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
              <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                <select
                  value={newTask.priority}
                  onChange={e =>
                    setNewTask(prev => ({
                      ...prev,
                      priority: e.target.value as typeof newTask.priority,
                    }))
                  }
                  className='px-3 py-2 border border-border rounded-md text-sm bg-background'
                >
                  <option value='low'>Prioridad Baja</option>
                  <option value='medium'>Prioridad Media</option>
                  <option value='high'>Prioridad Alta</option>
                </select>
                <Input
                  type='date'
                  value={newTask.dueDate}
                  onChange={e => setNewTask(prev => ({ ...prev, dueDate: e.target.value }))}
                  placeholder='Fecha programada'
                />
              </div>
              <div>
                <label className='text-sm font-medium'>Horario de la Tarea</label>
                <div className='grid grid-cols-2 gap-2 mt-1'>
                  <div>
                    <label className='text-xs text-muted-foreground'>Hora inicio</label>
                    <Input
                      type='time'
                      value={newTask.startTime}
                      onChange={e => setNewTask(prev => ({ ...prev, startTime: e.target.value }))}
                      placeholder='HH:MM'
                    />
                  </div>
                  <div>
                    <label className='text-xs text-muted-foreground'>Hora fin</label>
                    <Input
                      type='time'
                      value={newTask.endTime}
                      onChange={e => setNewTask(prev => ({ ...prev, endTime: e.target.value }))}
                      placeholder='HH:MM'
                    />
                  </div>
                </div>
                {newTask.startTime && newTask.endTime && (
                  <p className='text-xs text-muted-foreground mt-1'>
                    Duración: {calculateDuration(newTask.startTime, newTask.endTime)}
                  </p>
                )}
              </div>
              <div className='flex items-center space-x-2'>
                <Button onClick={onAddTask} size='sm'>
                  Agregar Tarea
                </Button>
                <Button onClick={() => setShowAddTask(false)} variant='outline' size='sm'>
                  Cancelar
                </Button>
              </div>
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
            plan.tasks.map(task => (
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
                      {/* Cambiar estado */}
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <Circle className='h-4 w-4 mr-2' />
                          Cambiar Estado
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem onClick={() => onUpdateTaskStatus(task.id, 'pending')}>
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
                          <DropdownMenuItem onClick={() => onUpdateTaskStatus(task.id, 'blocked')}>
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
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
