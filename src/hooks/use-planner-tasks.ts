'use client'

import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@/hooks/use-toast'

export type PlannerTaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked'
export type PlannerTaskOrigin = 'ticket' | 'personal'

export interface PlannerTask {
  id: string
  origin: PlannerTaskOrigin
  title: string
  description: string | null
  status: PlannerTaskStatus
  priority: 'low' | 'medium' | 'high'
  dueDate: string | null
  startTime: string | null
  endTime: string | null
  completedAt: string | null
  assignee: { id: string; name: string; email: string } | null
  ticketId: string | null
  ticketTitle: string | null
  planTitle: string | null
  family: { id: string; name: string; color: string | null } | null
  /** Calculado en servidor — ver GET /api/planner/tasks. Una tarea de ticket
   *  usa el mismo criterio global que ya regía el arrastre en el tablero
   *  (canManagePlanner); una tarea independiente es siempre editable/borrable
   *  por su dueño (v1: sin asignación a otros). */
  canEdit: boolean
  canDelete: boolean
}

export interface PersonalTaskInput {
  title: string
  description?: string
  priority?: 'low' | 'medium' | 'high'
  dueDate?: string
  startTime?: string
  endTime?: string
  familyId?: string | null
}

/**
 * Tablero/calendario del módulo de Tareas — carga en un solo array las
 * tareas de ticket (resolution_tasks, agregadas de todos los tickets
 * visibles) y las tareas independientes del propio usuario (personal_tasks),
 * distinguidas por `origin`. Expone updateStatus (reusa el endpoint de la
 * ficha del ticket para las de ticket) y create/update/deletePersonalTask
 * para las independientes — cada una contra su propio endpoint, sin duplicar
 * la lógica de auditoría/notificaciones/sync de cada lado.
 */
export function usePlannerTasks() {
  const { toast } = useToast()
  const [tasks, setTasks] = useState<PlannerTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/planner/tasks')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No fue posible cargar las tareas.')
      setTasks(data.tasks ?? [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando tareas.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const updateStatus = useCallback(
    async (task: PlannerTask, status: PlannerTaskStatus) => {
      const previous = tasks
      setTasks(current => current.map(t => (t.id === task.id ? { ...t, status } : t)))
      try {
        const url =
          task.origin === 'personal'
            ? `/api/planner/personal-tasks/${task.id}`
            : `/api/tickets/${task.ticketId}/resolution-plan/tasks/${task.id}`
        const res = await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        })
        const data = await res.json()
        if (!res.ok || data.success === false) {
          throw new Error(data.message || 'No fue posible actualizar la tarea.')
        }
      } catch (err) {
        setTasks(previous)
        toast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'No fue posible actualizar la tarea.',
          variant: 'destructive',
        })
      }
    },
    [tasks, toast]
  )

  const createPersonalTask = useCallback(
    async (input: PersonalTaskInput): Promise<boolean> => {
      try {
        const res = await fetch('/api/planner/personal-tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })
        const data = await res.json()
        if (!res.ok || data.success === false) {
          throw new Error(data.message || 'No fue posible crear la tarea.')
        }
        setTasks(current => [...current, data.data as PlannerTask])
        return true
      } catch (err) {
        toast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'No fue posible crear la tarea.',
          variant: 'destructive',
        })
        return false
      }
    },
    [toast]
  )

  const updatePersonalTask = useCallback(
    async (taskId: string, input: Partial<PersonalTaskInput> & { status?: PlannerTaskStatus }) => {
      try {
        const res = await fetch(`/api/planner/personal-tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })
        const data = await res.json()
        if (!res.ok || data.success === false) {
          throw new Error(data.message || 'No fue posible actualizar la tarea.')
        }
        setTasks(current => current.map(t => (t.id === taskId ? (data.data as PlannerTask) : t)))
        return true
      } catch (err) {
        toast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'No fue posible actualizar la tarea.',
          variant: 'destructive',
        })
        return false
      }
    },
    [toast]
  )

  const deletePersonalTask = useCallback(
    async (taskId: string) => {
      const previous = tasks
      setTasks(current => current.filter(t => t.id !== taskId))
      try {
        const res = await fetch(`/api/planner/personal-tasks/${taskId}`, { method: 'DELETE' })
        const data = await res.json()
        if (!res.ok || data.success === false) {
          throw new Error(data.message || 'No fue posible eliminar la tarea.')
        }
        return true
      } catch (err) {
        setTasks(previous)
        toast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'No fue posible eliminar la tarea.',
          variant: 'destructive',
        })
        return false
      }
    },
    [tasks, toast]
  )

  return {
    tasks,
    loading,
    error,
    reload: load,
    updateStatus,
    createPersonalTask,
    updatePersonalTask,
    deletePersonalTask,
  }
}
