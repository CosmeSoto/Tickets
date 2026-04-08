'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useToast } from './use-toast'
import { useTicketSSE } from './use-ticket-sse'
export interface TimelineEvent {
  id: string
  type: 'comment' | 'status_change' | 'assignment' | 'priority_change' | 'resolution' | 'rating' | 'created' | 'resolution_plan' | 'resolution_task' | 'file_uploaded'
  title: string
  description?: string
  user: {
    id: string
    name: string
    email: string
    role: string
  }
  metadata?: {
    oldValue?: string
    newValue?: string
    rating?: number
    // Para planes de resolución
    planId?: string
    planTitle?: string
    status?: string
    totalTasks?: number
    completedTasks?: number
    estimatedHours?: number
    actualHours?: number
    startDate?: string
    targetDate?: string
    completedDate?: string
    // Para tareas
    taskId?: string
    priority?: string
    dueDate?: string
    completedAt?: string
    assignedTo?: {
      id: string
      name: string
      email: string
    }
    attachments?: Array<{
      id: string
      name: string
      size: number
      type: string
      url?: string
    }>
  }
  createdAt: string
  isInternal?: boolean
}

export interface Comment {
  id: string
  content: string
  isInternal: boolean
  createdAt: string
  author: {
    id: string
    name: string
    role: string
  }
  attachments?: Array<{
    id: string
    name: string
    size: number
    type: string
    url?: string
  }>
}

export function useTimeline(ticketId: string) {
  const { toast } = useToast()
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Refs estables para evitar recrear callbacks en cada render
  const submittingRef = useRef(false)
  const toastRef = useRef(toast)
  const ticketIdRef = useRef(ticketId)
  // useRef para que el flag sea visible inmediatamente en todos los closures
  // sin esperar re-render (a diferencia de useState)
  const stoppedRef = useRef(false)

  useEffect(() => { toastRef.current = toast }, [toast])
  useEffect(() => {
    ticketIdRef.current = ticketId
    stoppedRef.current = false  // resetear al navegar a otro ticket
    if (ticketId) loadTimeline()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId])

  const loadTimeline = useCallback(async (silent = false) => {
    const currentTicketId = ticketIdRef.current
    if (!currentTicketId || stoppedRef.current) return

    try {
      if (!silent) setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/tickets/${currentTicketId}/timeline`)
      
      if (!response.ok) {
        if (response.status === 404) {
          // Ticket eliminado — detener polling permanentemente e inmediatamente
          stoppedRef.current = true
          setEvents([])
          return
        }
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.success) {
        const incoming: TimelineEvent[] = data.data || []
        setEvents(incoming)
      } else {
        throw new Error(data.message || data.error || 'Error al cargar el historial')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      setError(errorMessage)
      if (!errorMessage.includes('404')) {
        toastRef.current({
          variant: "destructive",
          title: "Error",
          description: "No se pudo cargar el historial del ticket"
        })
      }
      setEvents([])
    } finally {
      if (!silent) setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addComment = useCallback(async (content: string, isInternal: boolean = false, attachments?: File[]) => {
    if (!content.trim()) {
      toastRef.current({
        variant: "destructive",
        title: "Contenido requerido",
        description: "Debes escribir un comentario antes de enviarlo"
      })
      return false
    }

    submittingRef.current = true // bloquear recargas del polling

    try {
      const formData = new FormData()
      formData.append('content', content)
      formData.append('isInternal', isInternal.toString())
      
      if (attachments && attachments.length > 0) {
        attachments.forEach((file, index) => {
          formData.append(`attachments[${index}]`, file)
        })
      }

      const response = await fetch(`/api/tickets/${ticketIdRef.current}/comments`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Error al agregar comentario')
      }

      const data = await response.json()
      
      if (data.success) {
        const commentType = isInternal ? 'interno' : 'público'
        const attachmentInfo = attachments && attachments.length > 0 
          ? ` con ${attachments.length} archivo(s) adjunto(s)` 
          : ''
        toastRef.current({
          title: "Comentario agregado",
          description: `Comentario ${commentType} agregado${attachmentInfo}`,
          duration: 3000
        })
        // Recargar inmediatamente para el usuario que envió el comentario
        loadTimeline(true)
        // Notificar a otros componentes (ej: notificaciones) que hay actividad
        window.dispatchEvent(new CustomEvent('ticket-updated', { detail: { ticketId: ticketIdRef.current, type: 'comment_added' } }))
        return data.data
      } else {
        throw new Error(data.message || 'Error al agregar comentario')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      toastRef.current({
        variant: "destructive",
        title: "Error al agregar comentario",
        description: `No se pudo agregar el comentario. ${errorMessage}. Intenta nuevamente.`
      })
      return false
    } finally {
      submittingRef.current = false // liberar bloqueo siempre
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadTimeline])

  const updateTicketStatus = useCallback(async (newStatus: string, comment?: string) => {
    try {
      const response = await fetch(`/api/tickets/${ticketIdRef.current}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, comment })
      })
      if (!response.ok) throw new Error('Error al actualizar estado')
      const data = await response.json()
      if (data.success) {
        toastRef.current({ title: "Estado actualizado", description: "El estado del ticket se ha actualizado" })
        loadTimeline()
        return true
      } else {
        throw new Error(data.message || 'Error al actualizar estado')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      toastRef.current({ variant: "destructive", title: "Error", description: errorMessage })
      return false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadTimeline])

  const assignTicket = useCallback(async (assigneeId: string | null, comment?: string) => {
    try {
      const response = await fetch(`/api/tickets/${ticketIdRef.current}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigneeId, comment })
      })
      if (!response.ok) throw new Error('Error al asignar ticket')
      const data = await response.json()
      if (data.success) {
        toastRef.current({ title: "Ticket asignado", description: "La asignación del ticket se ha actualizado" })
        loadTimeline()
        return true
      } else {
        throw new Error(data.message || 'Error al asignar ticket')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      toastRef.current({ variant: "destructive", title: "Error", description: errorMessage })
      return false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadTimeline])

  // Polling cada 3s — usa stoppedRef para detención inmediata sin esperar re-render
  useEffect(() => {
    if (stoppedRef.current) return
    loadTimeline()

    let interval: ReturnType<typeof setInterval> | null = null

    const startPolling = () => {
      if (interval) return
      interval = setInterval(() => {
        if (stoppedRef.current) {
          clearInterval(interval!)
          interval = null
          return
        }
        loadTimeline(true)
      }, 3 * 1000)
    }

    const stopPolling = () => {
      if (interval) { clearInterval(interval); interval = null }
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (!stoppedRef.current) { loadTimeline(true); startPolling() }
      } else {
        stopPolling()
      }
    }

    startPolling()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [loadTimeline])

  // SSE: recarga inmediata cuando el servidor emite un evento (comment_added, etc.)
  useTicketSSE(ticketId, useCallback(() => {
    loadTimeline(true)
  }, [loadTimeline]))

  /** Detiene el polling permanentemente (ej: antes de eliminar el ticket) */
  const stopPolling = () => { stoppedRef.current = true }

  return {
    events,
    loading,
    error,
    loadTimeline,
    addComment,
    updateTicketStatus,
    assignTicket,
    setEvents,
    stopPolling,
  }
}

// Hook para ratings
export function useRating(ticketId: string) {
  const { toast } = useToast()
  const [rating, setRating] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const loadRating = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/tickets/${ticketId}/rating`)
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          setRating(data.data)
        }
      }
    } catch (err) {
      console.error('Error loading rating:', err)
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  const submitRating = useCallback(async (ratingData: {
    rating: number
    feedback?: string
    categories: {
      responseTime: number
      technicalSkill: number
      communication: number
      problemResolution: number
    }
  }) => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}/rating`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ratingData)
      })

      if (!response.ok) {
        throw new Error('Error al enviar calificación')
      }

      const data = await response.json()
      
      if (data.success) {
        toast({
          title: "Calificación enviada",
          description: "Gracias por tu feedback. Nos ayuda a mejorar nuestro servicio."
        })
        loadRating() // Recargar rating
        return true
      } else {
        throw new Error(data.message || 'Error al enviar calificación')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage
      })
      return false
    }
  }, [ticketId, toast, loadRating])

  useEffect(() => {
    loadRating()
  }, [loadRating])

  return {
    rating,
    loading,
    loadRating,
    submitRating
  }
}

// Hook para resolution plans
export function useResolutionPlan(ticketId: string) {
  const { toast } = useToast()
  const [plan, setPlan] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const loadPlan = useCallback(async () => {
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
  }, [ticketId])

  const createPlan = useCallback(async (planData: {
    title: string
    description?: string
  }) => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}/resolution-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(planData)
      })

      if (!response.ok) {
        throw new Error('Error al crear plan de resolución')
      }

      const data = await response.json()
      
      if (data.success) {
        setPlan(data.data)
        toast({
          title: "Plan creado",
          description: "Se ha creado el plan de resolución exitosamente"
        })
        return true
      } else {
        throw new Error(data.message || 'Error al crear plan')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage
      })
      return false
    }
  }, [ticketId, toast])

  const addTask = useCallback(async (taskData: {
    title: string
    description?: string
    priority: 'low' | 'medium' | 'high'
    estimatedHours?: number
    dueDate?: string
  }) => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}/resolution-plan/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(taskData)
      })

      if (!response.ok) {
        throw new Error('Error al agregar tarea')
      }

      const data = await response.json()
      
      if (data.success) {
        loadPlan() // Recargar plan
        toast({
          title: "Tarea agregada",
          description: "La tarea se ha agregado al plan de resolución"
        })
        return true
      } else {
        throw new Error(data.message || 'Error al agregar tarea')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage
      })
      return false
    }
  }, [ticketId, toast, loadPlan])

  const updateTaskStatus = useCallback(async (taskId: string, status: string) => {
    try {
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
        loadPlan() // Recargar plan
        toast({
          title: "Tarea actualizada",
          description: "El estado de la tarea se ha actualizado"
        })
        return true
      } else {
        throw new Error(data.message || 'Error al actualizar tarea')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage
      })
      return false
    }
  }, [ticketId, toast, loadPlan])

  useEffect(() => {
    loadPlan()
  }, [loadPlan])

  return {
    plan,
    loading,
    loadPlan,
    createPlan,
    addTask,
    updateTaskStatus
  }
}