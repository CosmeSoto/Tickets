'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'
import { Button } from './button'
import { Badge } from './badge'
import { Progress } from './progress'
import { Textarea } from './textarea'
import { Input } from './input'
import { 
  CheckCircle, 
  Circle, 
  Clock, 
  AlertTriangle, 
  Plus, 
  Edit2, 
  Trash2,
  PlayCircle,
  PauseCircle,
  Target,
  Calendar,
  User,
  MoreVertical,
  XCircle
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './alert-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip'

interface ResolutionTask {
  id: string
  title: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed' | 'blocked'
  priority: 'low' | 'medium' | 'high'
  estimatedHours?: number
  actualHours?: number
  assignedTo?: {
    id: string
    name: string
    email: string
  }
  dueDate?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
  dependencies?: string[]
  notes?: string
}

interface ResolutionPlan {
  id: string
  ticketId: string
  title: string
  description?: string
  status: 'draft' | 'active' | 'completed' | 'cancelled'
  totalTasks: number
  completedTasks: number
  estimatedHours: number
  actualHours: number
  startDate?: string
  targetDate?: string
  completedDate?: string
  tasks: ResolutionTask[]
  createdBy: {
    id: string
    name: string
    email: string
  }
  createdAt: string
  updatedAt: string
}

interface TicketResolutionTrackerProps {
  ticketId: string
  canEdit?: boolean
  mode?: 'technician' | 'admin' | 'client'
}

export function TicketResolutionTracker({ 
  ticketId, 
  canEdit = false, 
  mode = 'technician' 
}: TicketResolutionTrackerProps) {
  const { toast } = useToast()
  const [plan, setPlan] = useState<ResolutionPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingTask, setEditingTask] = useState<string | null>(null)
  const [showAddTask, setShowAddTask] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null)
  
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as const,
    estimatedHours: '',
    dueDate: ''
  })

  useEffect(() => {
    loadResolutionPlan()
  }, [ticketId])

  const loadResolutionPlan = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/tickets/${ticketId}/resolution-plan`)
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          setPlan(data.data)
        }
      }
    } catch (err) {
      console.error('Error loading resolution plan:', err)
    } finally {
      setLoading(false)
    }
  }

  const createResolutionPlan = async () => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}/resolution-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: `Plan de Resolución - Ticket #${ticketId.slice(-8)}`,
          description: 'Plan de trabajo para resolver este ticket'
        })
      })

      if (!response.ok) {
        throw new Error('Error al crear plan de resolución')
      }

      const data = await response.json()
      if (data.success) {
        setPlan(data.data)
        toast({
          title: "Plan de resolución creado",
          description: "Ahora puedes agregar tareas para organizar el trabajo de este ticket",
          duration: 4000
        })
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error al crear plan",
        description: "No se pudo crear el plan de resolución. Intenta nuevamente."
      })
    }
  }

  const addTask = async () => {
    if (!newTask.title.trim()) {
      toast({
        variant: "destructive",
        title: "Título requerido",
        description: "Debes ingresar un título para la tarea antes de agregarla"
      })
      return
    }

    try {
      const response = await fetch(`/api/tickets/${ticketId}/resolution-plan/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...newTask,
          estimatedHours: newTask.estimatedHours ? parseFloat(newTask.estimatedHours) : undefined
        })
      })

      if (!response.ok) {
        throw new Error('Error al agregar tarea')
      }

      const data = await response.json()
      if (data.success) {
        loadResolutionPlan()
        const taskTitle = newTask.title
        setNewTask({
          title: '',
          description: '',
          priority: 'medium',
          estimatedHours: '',
          dueDate: ''
        })
        setShowAddTask(false)
        toast({
          title: "Tarea agregada exitosamente",
          description: `"${taskTitle}" ha sido agregada al plan de resolución`,
          duration: 4000
        })
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error al agregar tarea",
        description: "No se pudo agregar la tarea al plan. Intenta nuevamente."
      })
    }
  }

  const updateTaskStatus = async (taskId: string, status: ResolutionTask['status']) => {
    try {
      const task = plan?.tasks.find(t => t.id === taskId)
      const taskTitle = task?.title || 'la tarea'
      
      const response = await fetch(`/api/tickets/${ticketId}/resolution-plan/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      })

      if (!response.ok) {
        throw new Error('Error al actualizar tarea')
      }

      const data = await response.json()
      if (data.success) {
        loadResolutionPlan()
        
        // Toast informativo según el estado con título de tarea
        const messages = {
          pending: {
            title: 'Tarea marcada como pendiente',
            description: `"${taskTitle}" está ahora pendiente de iniciar`
          },
          in_progress: {
            title: 'Tarea iniciada',
            description: `Comenzaste a trabajar en "${taskTitle}". El tiempo se está registrando.`
          },
          completed: {
            title: '¡Tarea completada!',
            description: `"${taskTitle}" ha sido marcada como completada exitosamente`
          },
          blocked: {
            title: 'Tarea bloqueada',
            description: `"${taskTitle}" está bloqueada y no se puede continuar`
          }
        }
        
        const message = messages[status]
        toast({
          title: message.title,
          description: message.description,
          duration: 4000
        })
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error al actualizar tarea",
        description: "No se pudo cambiar el estado de la tarea. Intenta nuevamente."
      })
    }
  }

  const deleteTask = async (taskId: string) => {
    try {
      const task = plan?.tasks.find(t => t.id === taskId)
      const taskTitle = task?.title || 'la tarea'
      
      const response = await fetch(`/api/tickets/${ticketId}/resolution-plan/tasks/${taskId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Error al eliminar tarea')
      }

      const data = await response.json()
      if (data.success) {
        loadResolutionPlan()
        setTaskToDelete(null)
        toast({
          title: "Tarea eliminada",
          description: `"${taskTitle}" ha sido eliminada permanentemente del plan de resolución`,
          duration: 4000
        })
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error al eliminar tarea",
        description: "No se pudo eliminar la tarea. Intenta nuevamente."
      })
    }
  }

  // Funciones auxiliares
  const calculateElapsedTime = (startDate: string): string => {
    const start = new Date(startDate)
    const now = new Date()
    const diff = now.getTime() - start.getTime()
    
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  const formatDuration = (hours?: number): string => {
    if (!hours) return ''
    
    // Si es menos de 1 hora, mostrar en minutos
    if (hours < 1) {
      const minutes = Math.round(hours * 60)
      return `${minutes}m`
    }
    
    // Si tiene decimales, mostrar horas y minutos
    const wholeHours = Math.floor(hours)
    const minutes = Math.round((hours - wholeHours) * 60)
    
    if (minutes > 0) {
      return `${wholeHours}h ${minutes}m`
    }
    return `${wholeHours}h`
  }

  const formatDateTime = (date: string): string => {
    return new Date(date).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDate = (date: string): string => {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const getStatusIcon = (status: ResolutionTask['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'in_progress':
        return <PlayCircle className="h-4 w-4 text-blue-600" />
      case 'blocked':
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getStatusBadge = (status: ResolutionTask['status']) => {
    const configs = {
      pending: {
        icon: <Clock className="h-3 w-3" />,
        label: 'Pendiente',
        color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
        description: 'Tarea no iniciada'
      },
      in_progress: {
        icon: <PlayCircle className="h-3 w-3" />,
        label: 'En Progreso',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        description: 'Trabajando activamente'
      },
      completed: {
        icon: <CheckCircle className="h-3 w-3" />,
        label: 'Completada',
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        description: 'Terminada exitosamente'
      },
      blocked: {
        icon: <XCircle className="h-3 w-3" />,
        label: 'Bloqueada',
        color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        description: 'No se puede continuar'
      }
    }
    
    const config = configs[status]
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className={config.color}>
              {config.icon}
              <span className="ml-1">{config.label}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{config.description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  const getStatusColor = (status: ResolutionTask['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'blocked':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default:
        return 'bg-muted text-foreground'
    }
  }

  const getPriorityColor = (priority: ResolutionTask['priority']) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      default:
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    }
  }

  const getPriorityLabel = (priority: ResolutionTask['priority']) => {
    switch (priority) {
      case 'high':
        return 'Alta'
      case 'medium':
        return 'Media'
      default:
        return 'Baja'
    }
  }

  const calculateProgress = () => {
    if (!plan || plan.totalTasks === 0) return 0
    return Math.round((plan.completedTasks / plan.totalTasks) * 100)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!plan) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Plan de Resolución</span>
          </CardTitle>
          <CardDescription>
            Crea un plan estructurado para resolver este ticket
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Target className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              No hay plan de resolución
            </h3>
            <p className="text-muted-foreground mb-4">
              Crea un plan para organizar las tareas necesarias para resolver este ticket
            </p>
            {canEdit && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={createResolutionPlan}>
                      <Plus className="h-4 w-4 mr-2" />
                      Crear Plan de Resolución
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Crea un plan estructurado con tareas para resolver este ticket</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Resumen del plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Target className="h-5 w-5" />
                <span>{plan.title}</span>
              </CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </div>
            <Badge className={getStatusColor(plan.status as any)}>
              {plan.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progreso general */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">
                Progreso General
              </span>
              <span className="text-sm text-muted-foreground">
                {plan.completedTasks}/{plan.totalTasks} tareas completadas
              </span>
            </div>
            <Progress value={calculateProgress()} className="h-2" />
            <div className="text-center mt-1">
              <span className="text-lg font-bold text-blue-600">
                {calculateProgress()}%
              </span>
            </div>
          </div>

          {/* Estadísticas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-900">
                {plan.totalTasks}
              </div>
              <div className="text-sm text-blue-700">Total Tareas</div>
            </div>
            
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-900">
                {plan.completedTasks}
              </div>
              <div className="text-sm text-green-700">Completadas</div>
            </div>
            
            <div className="text-center p-3 bg-yellow-50 rounded-lg dark:bg-yellow-900/20">
              <div className="text-2xl font-bold text-yellow-900 dark:text-yellow-200">
                {formatDuration(plan.estimatedHours)}
              </div>
              <div className="text-sm text-yellow-700 dark:text-yellow-300">Estimadas</div>
            </div>
            
            <div className="text-center p-3 bg-purple-50 rounded-lg dark:bg-purple-900/20">
              <div className="text-2xl font-bold text-purple-900 dark:text-purple-200">
                {formatDuration(plan.actualHours)}
              </div>
              <div className="text-sm text-purple-700 dark:text-purple-300">Reales</div>
            </div>
          </div>

          {/* Fechas importantes */}
          {(plan.startDate || plan.targetDate) && (
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              {plan.startDate && (
                <div className="flex items-center space-x-1">
                  <Calendar className="h-4 w-4" />
                  <span>Inicio: {new Date(plan.startDate).toLocaleDateString()}</span>
                </div>
              )}
              {plan.targetDate && (
                <div className="flex items-center space-x-1">
                  <Target className="h-4 w-4" />
                  <span>Meta: {new Date(plan.targetDate).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de tareas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Tareas del Plan</CardTitle>
            {canEdit && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      onClick={() => setShowAddTask(true)} 
                      size="sm"
                      variant="outline"
                    >
                      <Plus className="h-4 w-4 mr-2" />
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
            <div className="mb-6 p-4 border rounded-lg bg-muted">
              <h4 className="font-medium text-foreground mb-3">Nueva Tarea</h4>
              <div className="space-y-3">
                <Input
                  placeholder="Título de la tarea"
                  value={newTask.title}
                  onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                />
                <Textarea
                  placeholder="Descripción (opcional)"
                  value={newTask.description}
                  onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask(prev => ({ 
                      ...prev, 
                      priority: e.target.value as typeof newTask.priority 
                    }))}
                    className="px-3 py-2 border border-border rounded-md text-sm"
                  >
                    <option value="low">Prioridad Baja</option>
                    <option value="medium">Prioridad Media</option>
                    <option value="high">Prioridad Alta</option>
                  </select>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Input
                          type="number"
                          placeholder="Ej: 0.5 (30min) o 2 (2h)"
                          step="0.25"
                          min="0"
                          value={newTask.estimatedHours}
                          onChange={(e) => setNewTask(prev => ({ ...prev, estimatedHours: e.target.value }))}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Tiempo estimado en horas. Ejemplos:</p>
                        <p>• 0.25 = 15 minutos</p>
                        <p>• 0.5 = 30 minutos</p>
                        <p>• 1 = 1 hora</p>
                        <p>• 2.5 = 2 horas 30 minutos</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Input
                    type="date"
                    value={newTask.dueDate}
                    onChange={(e) => setNewTask(prev => ({ ...prev, dueDate: e.target.value }))}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Button onClick={addTask} size="sm">
                    Agregar Tarea
                  </Button>
                  <Button 
                    onClick={() => setShowAddTask(false)} 
                    variant="outline" 
                    size="sm"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Lista de tareas */}
          <div className="space-y-3">
            {plan.tasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Circle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No hay tareas en este plan</p>
              </div>
            ) : (
              plan.tasks.map((task) => (
                <div 
                  key={task.id} 
                  className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted transition-colors"
                >
                  {/* Checkbox/Status */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => canEdit && updateTaskStatus(
                            task.id, 
                            task.status === 'completed' ? 'pending' : 'completed'
                          )}
                          disabled={!canEdit}
                          className="mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className={`font-medium ${
                        task.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground'
                      }`}>
                        {task.title}
                      </h4>
                      <div className="flex items-center space-x-2 flex-shrink-0">
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
                      <p className="text-sm text-muted-foreground mt-1">
                        {task.description}
                      </p>
                    )}

                    {/* Información contextual */}
                    <div className="space-y-2 mt-3">
                      {/* Fechas */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3" />
                          <span>Creada: {formatDate(task.createdAt)}</span>
                        </div>
                        
                        {task.dueDate && (
                          <div className="flex items-center space-x-1">
                            <Target className="h-3 w-3" />
                            <span>Vence: {formatDate(task.dueDate)}</span>
                          </div>
                        )}
                        
                        {task.completedAt && (
                          <div className="flex items-center space-x-1 text-green-600">
                            <CheckCircle className="h-3 w-3" />
                            <span>Completada: {formatDate(task.completedAt)}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Asignación */}
                      {task.assignedTo && (
                        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span>Asignado a: {task.assignedTo.name}</span>
                        </div>
                      )}
                      
                      {/* Estimación vs Real */}
                      {(task.estimatedHours || task.actualHours) && (
                        <div className="flex items-center space-x-4 text-xs">
                          {task.estimatedHours && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center space-x-1 text-yellow-600">
                                    <Target className="h-3 w-3" />
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
                                  <div className="flex items-center space-x-1 text-purple-600">
                                    <Clock className="h-3 w-3" />
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
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Acciones de la tarea</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <DropdownMenuContent align="end" className="w-48">
                        {/* Cambiar estado */}
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <Circle className="h-4 w-4 mr-2" />
                            Cambiar Estado
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            <DropdownMenuItem onClick={() => updateTaskStatus(task.id, 'pending')}>
                              <Clock className="h-4 w-4 mr-2" />
                              <div className="flex flex-col">
                                <span>Pendiente</span>
                                <span className="text-xs text-muted-foreground">Tarea no iniciada</span>
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateTaskStatus(task.id, 'in_progress')}>
                              <PlayCircle className="h-4 w-4 mr-2" />
                              <div className="flex flex-col">
                                <span>En Progreso</span>
                                <span className="text-xs text-muted-foreground">Trabajando activamente</span>
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateTaskStatus(task.id, 'completed')}>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              <div className="flex flex-col">
                                <span>Completada</span>
                                <span className="text-xs text-muted-foreground">Terminada exitosamente</span>
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateTaskStatus(task.id, 'blocked')}>
                              <XCircle className="h-4 w-4 mr-2" />
                              <div className="flex flex-col">
                                <span>Bloqueada</span>
                                <span className="text-xs text-muted-foreground">No se puede continuar</span>
                              </div>
                            </DropdownMenuItem>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        
                        <DropdownMenuSeparator />
                        
                        {/* Eliminar */}
                        <DropdownMenuItem 
                          onClick={() => setTaskToDelete(task.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          <div className="flex flex-col">
                            <span>Eliminar Tarea</span>
                            <span className="text-xs text-muted-foreground">Eliminar permanentemente</span>
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

      {/* Diálogo de confirmación de eliminación */}
      <AlertDialog open={!!taskToDelete} onOpenChange={(open) => !open && setTaskToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tarea?</AlertDialogTitle>
            <AlertDialogDescription>
              {taskToDelete && plan?.tasks.find(t => t.id === taskToDelete) && (
                <>
                  Estás a punto de eliminar la tarea:{' '}
                  <span className="font-semibold text-foreground">
                    "{plan.tasks.find(t => t.id === taskToDelete)?.title}"
                  </span>
                  <br /><br />
                  Esta acción no se puede deshacer. La tarea será eliminada permanentemente del plan de resolución.
                </>
              )}
              {!taskToDelete || !plan?.tasks.find(t => t.id === taskToDelete) && (
                <>Esta acción no se puede deshacer. La tarea será eliminada permanentemente del plan de resolución.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => taskToDelete && deleteTask(taskToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar Tarea
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}