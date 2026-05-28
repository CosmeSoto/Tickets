'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useToast } from '@/hooks/use-toast'
import { formatDuration } from '@/lib/utils/time-utils'

// ── Types ──────────────────────────────────────────────────────────────────

export interface ResolutionTask {
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

export interface ResolutionPlan {
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

export interface PlanFormData {
  title: string
  description: string
  startDate: string
  startTime: string
  targetDate: string
  targetTime: string
  estimatedHours: string
}

export interface TaskFormData {
  title: string
  description: string
  priority: 'low' | 'medium' | 'high'
  dueDate: string
  startTime: string
  endTime: string
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useResolutionPlan(ticketId: string, onPlanChange?: () => void) {
  const { toast } = useToast()

  // Ref para onPlanChange — evita que el callback cause re-renders/loops
  const onPlanChangeRef = useRef(onPlanChange)
  onPlanChangeRef.current = onPlanChange

  // Estado del plan
  const [plan, setPlan] = useState<ResolutionPlan | null>(null)
  const [loading, setLoading] = useState(true)

  // Estados de UI
  const [showAddTask, setShowAddTask] = useState(false)
  const [showCreatePlan, setShowCreatePlan] = useState(false)
  const [showEditPlan, setShowEditPlan] = useState(false)
  const [showDeletePlan, setShowDeletePlan] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null)
  const [openPlanMenu, setOpenPlanMenu] = useState(false)

  // Formularios
  const [planForm, setPlanForm] = useState<PlanFormData>({
    title: '',
    description: '',
    startDate: '',
    startTime: '',
    targetDate: '',
    targetTime: '',
    estimatedHours: '',
  })

  const [newTask, setNewTask] = useState<TaskFormData>({
    title: '',
    description: '',
    priority: 'medium',
    dueDate: '',
    startTime: '',
    endTime: '',
  })

  // ── Cargar plan ──────────────────────────────────────────────────────────

  const loadResolutionPlan = useCallback(
    async (notifyChange = false) => {
      try {
        setLoading(true)
        const response = await fetch(`/api/tickets/${ticketId}/resolution-plan`)

        if (response.ok) {
          const data = await response.json()
          if (data.success && data.data) {
            setPlan(data.data)
            if (notifyChange) onPlanChangeRef.current?.()
          } else {
            setPlan(null)
          }
        } else {
          console.error('Error loading resolution plan: HTTP', response.status)
          // No resetear plan si ya existe (evitar flash)
        }
      } catch (err) {
        console.error('Error loading resolution plan:', err)
      } finally {
        setLoading(false)
      }
    },
    // Solo depender de ticketId — onPlanChange se usa via ref para evitar loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ticketId]
  )

  useEffect(() => {
    loadResolutionPlan()
  }, [loadResolutionPlan])

  // ── Crear plan ───────────────────────────────────────────────────────────

  const createResolutionPlan = async () => {
    if (!planForm.title.trim()) {
      toast({
        variant: 'destructive',
        title: 'Título requerido',
        description: 'Debes ingresar un título para el plan',
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
            variant: 'destructive',
            title: 'Fechas inválidas',
            description: 'La fecha objetivo debe ser posterior a la fecha de inicio',
          })
          return
        }
      }

      const response = await fetch(`/api/tickets/${ticketId}/resolution-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: planForm.title.trim(),
          description: planForm.description.trim() || undefined,
          startDate,
          targetDate,
          estimatedHours,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Error al crear plan de resolución')
      }

      const data = await response.json()
      if (data.success) {
        setPlan(data.data)
        onPlanChangeRef.current?.()
        setShowCreatePlan(false)
        setPlanForm({
          title: '',
          description: '',
          startDate: '',
          startTime: '',
          targetDate: '',
          targetTime: '',
          estimatedHours: '',
        })
        toast({
          title: 'Plan de resolución creado',
          description: `Plan creado con ${estimatedHours ? formatDuration(estimatedHours) + ' estimadas' : 'éxito'}. Se ha notificado al cliente.`,
          duration: 5000,
        })
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error al crear plan',
        description:
          err instanceof Error
            ? err.message
            : 'No se pudo crear el plan de resolución. Intenta nuevamente.',
      })
    }
  }

  // ── Actualizar plan ──────────────────────────────────────────────────────

  const updatePlan = async () => {
    if (!planForm.title.trim()) {
      toast({
        variant: 'destructive',
        title: 'Título requerido',
        description: 'Debes ingresar un título para el plan',
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
            variant: 'destructive',
            title: 'Fechas inválidas',
            description: 'La fecha objetivo debe ser posterior a la fecha de inicio',
          })
          return
        }
      }

      const response = await fetch(`/api/tickets/${ticketId}/resolution-plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: planForm.title.trim(),
          description: planForm.description.trim() || undefined,
          startDate,
          targetDate,
          estimatedHours,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Error al actualizar plan')
      }

      const data = await response.json()
      if (data.success) {
        setPlan(data.data)
        onPlanChangeRef.current?.()
        setShowEditPlan(false)
        toast({
          title: 'Plan actualizado',
          description: 'El plan de resolución ha sido actualizado exitosamente',
        })
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error al actualizar plan',
        description: err instanceof Error ? err.message : 'No se pudo actualizar el plan',
      })
    }
  }

  // ── Eliminar plan ────────────────────────────────────────────────────────

  const deletePlan = async () => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}/resolution-plan`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Error al eliminar plan')
      }

      const data = await response.json()
      if (data.success) {
        setPlan(null)
        setShowDeletePlan(false)
        onPlanChangeRef.current?.()
        toast({
          title: 'Plan eliminado',
          description: 'El plan de resolución ha sido eliminado permanentemente',
        })
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error al eliminar plan',
        description: err instanceof Error ? err.message : 'No se pudo eliminar el plan',
      })
    }
  }

  // ── Cambiar estado del plan ──────────────────────────────────────────────

  const activatePlan = async () => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}/resolution-plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      })

      if (!response.ok) throw new Error('Error al activar plan')

      const data = await response.json()
      if (data.success) {
        setPlan(data.data)
        onPlanChangeRef.current?.()
        toast({
          title: 'Plan activado',
          description: 'El plan de resolución está ahora activo',
        })
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error al activar plan',
        description: 'No se pudo activar el plan',
      })
    }
  }

  const completePlan = async () => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}/resolution-plan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          completedDate: new Date().toISOString(),
        }),
      })

      if (!response.ok) throw new Error('Error al completar plan')

      const data = await response.json()
      if (data.success) {
        setPlan(data.data)
        onPlanChangeRef.current?.()
        toast({
          title: 'Plan completado',
          description: 'El plan de resolución ha sido marcado como completado exitosamente',
        })
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error al completar plan',
        description: 'No se pudo completar el plan',
      })
    }
  }

  // ── Tareas ───────────────────────────────────────────────────────────────

  const addTask = async () => {
    if (!newTask.title.trim()) {
      toast({
        variant: 'destructive',
        title: 'Título requerido',
        description: 'Debes ingresar un título para la tarea antes de agregarla',
      })
      return
    }

    try {
      let dueDate = null
      let estimatedHours = null

      if (newTask.dueDate && newTask.startTime && newTask.endTime) {
        const startDateTime = new Date(`${newTask.dueDate}T${newTask.startTime}:00`)
        dueDate = startDateTime.toISOString()

        const endDateTime = new Date(`${newTask.dueDate}T${newTask.endTime}:00`)
        const durationMs = endDateTime.getTime() - startDateTime.getTime()
        estimatedHours = durationMs / (1000 * 60 * 60)

        if (estimatedHours <= 0) {
          toast({
            variant: 'destructive',
            title: 'Horario inválido',
            description: 'La hora de fin debe ser posterior a la hora de inicio',
          })
          return
        }
      }

      const response = await fetch(`/api/tickets/${ticketId}/resolution-plan/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTask.title,
          description: newTask.description,
          priority: newTask.priority,
          estimatedHours,
          dueDate,
        }),
      })

      if (!response.ok) throw new Error('Error al agregar tarea')

      const data = await response.json()
      if (data.success) {
        if (plan) {
          setPlan({
            ...plan,
            tasks: [...plan.tasks, data.data],
            totalTasks: plan.totalTasks + 1,
          })
          onPlanChangeRef.current?.()
        }
        const taskTitle = newTask.title
        setNewTask({
          title: '',
          description: '',
          priority: 'medium',
          dueDate: '',
          startTime: '',
          endTime: '',
        })
        setShowAddTask(false)
        toast({
          title: 'Tarea agregada exitosamente',
          description: `"${taskTitle}" ha sido agregada al plan de resolución`,
          duration: 4000,
        })
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error al agregar tarea',
        description: 'No se pudo agregar la tarea al plan. Intenta nuevamente.',
      })
    }
  }

  const updateTaskStatus = async (taskId: string, status: ResolutionTask['status']) => {
    try {
      const task = plan?.tasks.find(t => t.id === taskId)
      const taskTitle = task?.title || 'la tarea'

      const response = await fetch(`/api/tickets/${ticketId}/resolution-plan/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) throw new Error('Error al actualizar tarea')

      const data = await response.json()
      if (data.success) {
        if (plan) {
          const updatedTasks = plan.tasks.map(t =>
            t.id === taskId
              ? {
                  ...t,
                  status,
                  completedAt: status === 'completed' ? new Date().toISOString() : undefined,
                }
              : t
          )
          const completedTasks = updatedTasks.filter(t => t.status === 'completed').length
          setPlan({ ...plan, tasks: updatedTasks, completedTasks })
          onPlanChangeRef.current?.()
        }

        const messages = {
          pending: {
            title: 'Tarea marcada como pendiente',
            description: `"${taskTitle}" está ahora pendiente de iniciar`,
          },
          in_progress: {
            title: 'Tarea iniciada',
            description: `Comenzaste a trabajar en "${taskTitle}". El tiempo se está registrando.`,
          },
          completed: {
            title: '¡Tarea completada!',
            description: `"${taskTitle}" ha sido marcada como completada exitosamente`,
          },
          blocked: {
            title: 'Tarea bloqueada',
            description: `"${taskTitle}" está bloqueada y no se puede continuar`,
          },
        }

        const message = messages[status]
        toast({
          title: message.title,
          description: message.description,
          duration: 4000,
        })
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error al actualizar tarea',
        description: 'No se pudo cambiar el estado de la tarea. Intenta nuevamente.',
      })
    }
  }

  const deleteTask = async (taskId: string) => {
    try {
      const task = plan?.tasks.find(t => t.id === taskId)
      const taskTitle = task?.title || 'la tarea'

      const response = await fetch(`/api/tickets/${ticketId}/resolution-plan/tasks/${taskId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Error al eliminar tarea')

      const data = await response.json()
      if (data.success) {
        if (plan) {
          const remainingTasks = plan.tasks.filter(t => t.id !== taskId)
          const completedTasks = remainingTasks.filter(t => t.status === 'completed').length
          setPlan({
            ...plan,
            tasks: remainingTasks,
            totalTasks: remainingTasks.length,
            completedTasks,
          })
          onPlanChangeRef.current?.()
        }
        setTaskToDelete(null)
        toast({
          title: 'Tarea eliminada',
          description: `"${taskTitle}" ha sido eliminada permanentemente del plan de resolución`,
          duration: 4000,
        })
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error al eliminar tarea',
        description: 'No se pudo eliminar la tarea. Intenta nuevamente.',
      })
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  const calculateProgress = () => {
    if (!plan || plan.totalTasks === 0) return 0
    return Math.round((plan.completedTasks / plan.totalTasks) * 100)
  }

  const resetPlanForm = () => {
    setPlanForm({
      title: '',
      description: '',
      startDate: '',
      startTime: '',
      targetDate: '',
      targetTime: '',
      estimatedHours: '',
    })
  }

  const loadPlanToForm = () => {
    if (!plan) return
    setPlanForm({
      title: plan.title,
      description: plan.description || '',
      startDate: plan.startDate ? new Date(plan.startDate).toISOString().split('T')[0] : '',
      startTime: plan.startDate ? new Date(plan.startDate).toTimeString().slice(0, 5) : '',
      targetDate: plan.targetDate ? new Date(plan.targetDate).toISOString().split('T')[0] : '',
      targetTime: plan.targetDate ? new Date(plan.targetDate).toTimeString().slice(0, 5) : '',
      estimatedHours: plan.estimatedHours?.toString() || '',
    })
  }

  return {
    // Estado
    plan,
    loading,

    // UI
    showAddTask,
    setShowAddTask,
    showCreatePlan,
    setShowCreatePlan,
    showEditPlan,
    setShowEditPlan,
    showDeletePlan,
    setShowDeletePlan,
    taskToDelete,
    setTaskToDelete,
    openPlanMenu,
    setOpenPlanMenu,

    // Formularios
    planForm,
    setPlanForm,
    newTask,
    setNewTask,

    // Acciones del plan
    createResolutionPlan,
    updatePlan,
    deletePlan,
    activatePlan,
    completePlan,

    // Acciones de tareas
    addTask,
    updateTaskStatus,
    deleteTask,

    // Helpers
    calculateProgress,
    resetPlanForm,
    loadPlanToForm,
  }
}
