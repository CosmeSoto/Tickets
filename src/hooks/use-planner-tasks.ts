'use client'

import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@/hooks/use-toast'

export type PlannerTaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked'

export interface PlannerTask {
  id: string
  title: string
  description: string | null
  status: PlannerTaskStatus
  priority: 'low' | 'medium' | 'high'
  dueDate: string | null
  startTime: string | null
  endTime: string | null
  completedAt: string | null
  assignee: { id: string; name: string; email: string } | null
  ticketId: string
  ticketTitle: string
  planTitle: string
  family: { id: string; name: string; color: string | null } | null
}

/**
 * Tablero/calendario del módulo de Tareas — carga resolution_tasks agregadas
 * de todos los tickets visibles y expone updateStatus, que reusa el mismo
 * endpoint que ya usa la ficha del ticket (PATCH .../resolution-plan/tasks/[taskId])
 * en vez de duplicar la lógica de auditoría/notificaciones/sync con Planner.
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
        const res = await fetch(`/api/tickets/${task.ticketId}/resolution-plan/tasks/${task.id}`, {
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

  return { tasks, loading, error, reload: load, updateStatus }
}
