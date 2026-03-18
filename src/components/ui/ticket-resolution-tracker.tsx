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
  AlertCircle,
  Plus, 
  Edit2, 
  Trash2,
  PlayCircle,
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
  mode?: 'admin' | 'technician' | 'client'
  onPlanChange?: () => void
}

export function TicketResolutionTracker({ 
  ticketId, 
  canEdit = false,
  mode,
  onPlanChange
}: TicketResolutionTrackerProps) {
  const { toast } = useToast()
  const [plan, setPlan] = useState<ResolutionPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddTask, setShowAddTask] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null)
  const [showCreatePlan, setShowCreatePlan] = useState(false)
  const [showEditPlan, setShowEditPlan] = useState(false)
  const [showDeletePlan, setShowDeletePlan] = useState(false)
  const [planForm, setPlanForm] = useState({
    title: '',
    description: '',
    startDate: '',
    startTime: '',
    targetDate: '',
    targetTime: '',
    estimatedHours: ''
  })
  
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as const,
    dueDate: '',
    startTime: '',
    endTime: ''
  })

  useEffect(() => {
    loadResolutionPlan()
  }, [ticketId])

  const loadResolutionPlan = async (notifyChange = false) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/tickets/${ticketId}/resolution-plan`)
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          setPlan(data.data)
          if (notifyChange) onPlanChange?.()
        }
      }
    } catch (err) {
      console.error('Error loading resolution plan:', err)
    } finally {
      setLoading(false)
    }
  }

  const createResolutionPlan = async () => {
    if (!planForm.title.trim()) {
      toast({
        variant: "destructive",
        title: "Título requerido",
        description: "Debes ingresar un título para el plan"
      })
      return
    }

    try {
      // Combinar fecha y hora para startDate
      let startDate = null
      if (planForm.startDate && planForm.startTime) {
        startDate = new Date(`${planForm.startDate}T${planForm.startTime}:00`).toISOString()
      }

      // Combinar fecha y hora para targetDate
      let targetDate = null
      if (planForm.targetDate && planForm.targetTime) {
        targetDate = new Date(`${planForm.targetDate}T${planForm.targetTime}:00`).toISOString()
      }

      // Calcular automáticamente las horas estimadas si hay fechas
      let estimatedHours = undefined
      if (startDate && targetDate) {
        const start = new Date(startDate)
        const target = new Date(targetDate)
        const diffMs = target.getTime() - start.getTime()
        const diffHours = diffMs / (1000 * 60 * 60)
        
        if (diffHours > 0) {
          estimatedHours = parseFloat(diffHours.toFixed(1))
        } else {
          toast({
            variant: "destructive",
            title: "Fechas inválidas",
            description: "La fecha objetivo debe ser posterior a la fecha de inicio"
          })
          return
        }
      }

      const response = await fetch(`/api/tickets/${ticketId}/resolution-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: planForm.title.trim(),
          description: planForm.description.trim() || undefined,
          startDate,
          targetDate,
          estimatedHours
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Error al crear plan de resolución')
      }

      const data = await response.json()
      if (data.success) {
        // Recargar el plan completo desde el servidor y notificar cambio al timeline
        await loadResolutionPlan(true)
        
        setShowCreatePlan(false)
        setPlanForm({
          title: '',
          description: '',
          startDate: '',
          startTime: '',
          targetDate: '',
          targetTime: '',
          estimatedHours: ''
        })
        toast({
          title: "Plan de resolución creado",
          description: `Plan creado con ${estimatedHours ? estimatedHours.toFixed(1) + ' horas estimadas' : 'éxito'}. Se ha notificado al cliente.`,
          duration: 5000
        })
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error al crear plan",
        description: err instanceof Error ? err.message : "No se pudo crear el plan de resolución. Intenta nuevamente."
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
      // Combinar fecha y horas para dueDate y calcular duración
      let dueDate = null
      let estimatedHours = null
      
      if (newTask.dueDate && newTask.startTime && newTask.endTime) {
        // Crear fecha de inicio
        const startDateTime = new Date(`${newTask.dueDate}T${newTask.startTime}:00`)
        dueDate = startDateTime.toISOString()
        
        // Crear fecha de fin y calcular duración
        const endDateTime = new Date(`${newTask.dueDate}T${newTask.endTime}:00`)
        const durationMs = endDateTime.getTime() - startDateTime.getTime()
        estimatedHours = durationMs / (1000 * 60 * 60) // Convertir a horas
        
        // Validar que la hora de fin sea después de la hora de inicio
        if (estimatedHours <= 0) {
          toast({
            variant: "destructive",
            title: "Horario inválido",
            description: "La hora de fin debe ser posterior a la hora de inicio"
          })
          return
        }
      }

      const response = await fetch(`/api/tickets/${ticketId}/resolution-plan/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: newTask.title,
          description: newTask.description,
          priority: newTask.priority,
          estimatedHours,
          dueDate
        })
      })

      if (!response.ok) {
        throw new Error('Error al agregar tarea')
      }

      const data = await response.json()
      if (data.success) {
        loadResolutionPlan(true)
        const taskTitle = newTask.title
        setNewTask({
          title: '',
          description: '',
          priority: 'medium',
          dueDate: '',
          startTime: '',
          endTime: ''
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
        loadResolutionPlan(true)
        
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
        loadResolutionPlan(true)
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
  const calculateDuration = (startTime: string, endTime: string): string => {
    if (!startTime || !endTime) return ''
    
    const [startHour, startMin] = startTime.split(':').map(Number)
    const [endHour, endMin] = endTime.split(':').map(Number)
    
    const startMinutes = startHour * 60 + startMin
    const endMinutes = endHour * 60 + endMin
    const durationMinutes = endMinutes - startMinutes
    
    if (durationMinutes <= 0) return 'Horario inválido'
    
    const hours = Math.floor(durationMinutes / 60)
    const minutes = durationMinutes % 60
    
    if (hours === 0) return `${minutes} minutos`
    if (minutes === 0) return `${hours} ${hours === 1 ? 'hora' : 'horas'}`
    return `${hours} ${hours === 1 ? 'hora' : 'horas'} ${minutes} minutos`
  }

  const formatDuration = (hours?: number): string => {
    if (!hours) return ''
    if (hours < 1) {
      const minutes = Math.round(hours * 60)
      return `${minutes}m`
    }
    const wholeHours = Math.floor(hours)
    const minutes = Math.round((hours - wholeHours) * 60)
    if (minutes > 0) {
      return `${wholeHours}h ${minutes}m`
    }
    return `${wholeHours}h`
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

  const updatePlan = async () => {
    if (!planForm.title.trim()) {
      toast({
        variant: "destructive",
        title: "Título requerido",
        description: "Debes ingresar un título para el plan"
      })
      return
    }

    try {
      let startDate = null
      if (planForm.startDate && planForm.startTime) {
        startDate = new Date(`${planForm.startDate}T${planForm.startTime}:00`).toISOString()
      }

      let targetDate = null
      if (planForm.targetDate && planForm.targetTime) {
        targetDate = new Date(`${planForm.targetDate}T${planForm.targetTime}:00`).toISOString()
      }

      let estimatedHours = undefined
      if (startDate && targetDate) {
        const start = new Date(startDate)
        const target = new Date(targetDate)
        const diffMs = target.getTime() - start.getTime()
        const diffHours = diffMs / (1000 * 60 * 60)
        
        if (diffHours > 0) {
          estimatedHours = parseFloat(diffHours.toFixed(1))
        } else {
          toast({
            variant: "destructive",
            title: "Fechas inválidas",
            description: "La fecha objetivo debe ser posterior a la fecha de inicio"
          })
          return
        }
      }

      const response = await fetch(`/api/tickets/${ticketId}/resolution-plan`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: planForm.title.trim(),
          description: planForm.description.trim() || undefined,
          startDate,
          targetDate,
          estimatedHours
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Error al actualizar plan')
      }

      const data = await response.json()
      if (data.success) {
        await loadResolutionPlan(true)
        setShowEditPlan(false)
        toast({
          title: "Plan actualizado",
          description: "El plan de resolución ha sido actualizado exitosamente"
        })
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error al actualizar plan",
        description: err instanceof Error ? err.message : "No se pudo actualizar el plan"
      })
    }
  }

  const deletePlan = async () => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}/resolution-plan`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Error al eliminar plan')
      }

      const data = await response.json()
      if (data.success) {
        setPlan(null)
        setShowDeletePlan(false)
        onPlanChange?.()
        toast({
          title: "Plan eliminado",
          description: "El plan de resolución ha sido eliminado permanentemente"
        })
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error al eliminar plan",
        description: err instanceof Error ? err.message : "No se pudo eliminar el plan"
      })
    }
  }

  const activatePlan = async () => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}/resolution-plan`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'active'
        })
      })

      if (!response.ok) {
        throw new Error('Error al activar plan')
      }

      const data = await response.json()
      if (data.success) {
        await loadResolutionPlan(true)
        toast({
          title: "Plan activado",
          description: "El plan de resolución está ahora activo"
        })
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error al activar plan",
        description: "No se pudo activar el plan"
      })
    }
  }

  const completePlan = async () => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}/resolution-plan`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'completed',
          completedDate: new Date().toISOString()
        })
      })

      if (!response.ok) {
        throw new Error('Error al completar plan')
      }

      const data = await response.json()
      if (data.success) {
        await loadResolutionPlan(true)
        toast({
          title: "Plan completado",
          description: "El plan de resolución ha sido marcado como completado exitosamente"
        })
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error al completar plan",
        description: "No se pudo completar el plan"
      })
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: 'Borrador',
      active: 'Activo',
      completed: 'Completado',
      cancelled: 'Cancelado'
    }
    return labels[status] || status
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
          {!showCreatePlan ? (
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
                      <Button onClick={() => setShowCreatePlan(true)}>
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
          ) : (
            <div className="space-y-4">
              <h3 className="font-medium text-foreground">Nuevo Plan de Resolución</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Título del Plan *</label>
                  <Input
                    placeholder="Ej: Reparación del servidor principal"
                    value={planForm.title}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Descripción</label>
                  <Textarea
                    placeholder="Describe el plan de trabajo..."
                    value={planForm.description}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Fecha de Inicio</label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="date"
                        value={planForm.startDate}
                        onChange={(e) => setPlanForm(prev => ({ ...prev, startDate: e.target.value }))}
                      />
                      <Input
                        type="time"
                        value={planForm.startTime}
                        onChange={(e) => setPlanForm(prev => ({ ...prev, startTime: e.target.value }))}
                        placeholder="HH:MM"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Fecha Objetivo</label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="date"
                        value={planForm.targetDate}
                        onChange={(e) => setPlanForm(prev => ({ ...prev, targetDate: e.target.value }))}
                      />
                      <Input
                        type="time"
                        value={planForm.targetTime}
                        onChange={(e) => setPlanForm(prev => ({ ...prev, targetTime: e.target.value }))}
                        placeholder="HH:MM"
                      />
                    </div>
                  </div>
                </div>

                {/* Cálculo automático de horas estimadas */}
                {planForm.startDate && planForm.startTime && planForm.targetDate && planForm.targetTime && (() => {
                  const start = new Date(`${planForm.startDate}T${planForm.startTime}`)
                  const target = new Date(`${planForm.targetDate}T${planForm.targetTime}`)
                  const diffMs = target.getTime() - start.getTime()
                  const diffHours = diffMs / (1000 * 60 * 60)
                  
                  if (diffHours > 0) {
                    return (
                      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <div>
                            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                              Horas Estimadas Totales: {diffHours.toFixed(1)} horas
                            </p>
                            <p className="text-xs text-blue-700 dark:text-blue-300">
                              Calculado automáticamente desde {start.toLocaleString('es-ES', { 
                                day: '2-digit', 
                                month: 'short', 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })} hasta {target.toLocaleString('es-ES', { 
                                day: '2-digit', 
                                month: 'short', 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  } else if (diffHours < 0) {
                    return (
                      <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
                        <div className="flex items-center space-x-2">
                          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                          <p className="text-sm text-red-900 dark:text-red-100">
                            La fecha objetivo debe ser posterior a la fecha de inicio
                          </p>
                        </div>
                      </div>
                    )
                  }
                  return null
                })()}

                <div className="flex items-center space-x-2 pt-2">
                  <Button onClick={createResolutionPlan}>
                    <Plus className="h-4 w-4 mr-2" />
                    Crear Plan
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowCreatePlan(false)
                      setPlanForm({
                        title: '',
                        description: '',
                        startDate: '',
                        startTime: '',
                        targetDate: '',
                        targetTime: '',
                        estimatedHours: ''
                      })
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // Renderizar plan existente
  return (
    <div className="space-y-6">
      {/* Resumen del plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle className="flex items-center space-x-2">
                <Target className="h-5 w-5" />
                <span>{plan.title}</span>
              </CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={getStatusColor(plan.status as any)}>
                {getStatusLabel(plan.status)}
              </Badge>
              {canEdit && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {plan.status === 'draft' && (
                      <>
                        <DropdownMenuItem onClick={activatePlan}>
                          <PlayCircle className="h-4 w-4 mr-2" />
                          Activar Plan
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    {plan.status === 'active' && (
                      <>
                        <DropdownMenuItem onClick={completePlan}>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Marcar como Completado
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem onClick={() => {
                      // Cargar datos actuales del plan en el formulario
                      setPlanForm({
                        title: plan.title,
                        description: plan.description || '',
                        startDate: plan.startDate ? new Date(plan.startDate).toISOString().split('T')[0] : '',
                        startTime: plan.startDate ? new Date(plan.startDate).toTimeString().slice(0, 5) : '',
                        targetDate: plan.targetDate ? new Date(plan.targetDate).toISOString().split('T')[0] : '',
                        targetTime: plan.targetDate ? new Date(plan.targetDate).toTimeString().slice(0, 5) : '',
                        estimatedHours: plan.estimatedHours?.toString() || ''
                      })
                      setShowEditPlan(true)
                    }}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      Editar Plan
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => setShowDeletePlan(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar Plan
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                  <Input
                    type="date"
                    value={newTask.dueDate}
                    onChange={(e) => setNewTask(prev => ({ ...prev, dueDate: e.target.value }))}
                    placeholder="Fecha programada"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Horario de la Tarea</label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div>
                      <label className="text-xs text-muted-foreground">Hora inicio</label>
                      <Input
                        type="time"
                        value={newTask.startTime}
                        onChange={(e) => setNewTask(prev => ({ ...prev, startTime: e.target.value }))}
                        placeholder="HH:MM"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Hora fin</label>
                      <Input
                        type="time"
                        value={newTask.endTime}
                        onChange={(e) => setNewTask(prev => ({ ...prev, endTime: e.target.value }))}
                        placeholder="HH:MM"
                      />
                    </div>
                  </div>
                  {newTask.startTime && newTask.endTime && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Duración: {calculateDuration(newTask.startTime, newTask.endTime)}
                    </p>
                  )}
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

      {/* Diálogo de confirmación de eliminación de tarea */}
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

      {/* Diálogo de edición del plan */}
      <AlertDialog open={showEditPlan} onOpenChange={setShowEditPlan}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Editar Plan de Resolución</AlertDialogTitle>
            <AlertDialogDescription>
              Actualiza la información del plan de resolución
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Título del Plan *</label>
              <Input
                placeholder="Ej: Reparación del servidor principal"
                value={planForm.title}
                onChange={(e) => setPlanForm(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Descripción</label>
              <Textarea
                placeholder="Describe el plan de trabajo..."
                value={planForm.description}
                onChange={(e) => setPlanForm(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Fecha de Inicio</label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={planForm.startDate}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                  <Input
                    type="time"
                    value={planForm.startTime}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, startTime: e.target.value }))}
                    placeholder="HH:MM"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Fecha Objetivo</label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={planForm.targetDate}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, targetDate: e.target.value }))}
                  />
                  <Input
                    type="time"
                    value={planForm.targetTime}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, targetTime: e.target.value }))}
                    placeholder="HH:MM"
                  />
                </div>
              </div>
            </div>

            {planForm.startDate && planForm.startTime && planForm.targetDate && planForm.targetTime && (() => {
              const start = new Date(`${planForm.startDate}T${planForm.startTime}`)
              const target = new Date(`${planForm.targetDate}T${planForm.targetTime}`)
              const diffMs = target.getTime() - start.getTime()
              const diffHours = diffMs / (1000 * 60 * 60)
              
              if (diffHours > 0) {
                return (
                  <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <div>
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          Horas Estimadas Totales: {diffHours.toFixed(1)} horas
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          Calculado automáticamente
                        </p>
                      </div>
                    </div>
                  </div>
                )
              } else if (diffHours < 0) {
                return (
                  <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      <p className="text-sm text-red-900 dark:text-red-100">
                        La fecha objetivo debe ser posterior a la fecha de inicio
                      </p>
                    </div>
                  </div>
                )
              }
              return null
            })()}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={updatePlan}>
              Actualizar Plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de confirmación de eliminación del plan */}
      <AlertDialog open={showDeletePlan} onOpenChange={setShowDeletePlan}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar plan de resolución?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de eliminar el plan:{' '}
              <span className="font-semibold text-foreground">"{plan?.title}"</span>
              <br /><br />
              Esta acción eliminará el plan y todas sus tareas permanentemente. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={deletePlan}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar Plan Completo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}