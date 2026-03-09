'use client'

import { useState, useEffect, useCallback } from 'react'
import { useToast } from './use-toast'

export interface TimelineEvent {
  id: string
  type: 'comment' | 'status_change' | 'assignment' | 'priority_change' | 'resolution' | 'rating' | 'created' | 'resolution_plan' | 'resolution_task'
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
    status?: string
    totalTasks?: number
    estimatedHours?: number
    startDate?: string
    targetDate?: string
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

  const loadTimeline = useCallback(async () => {
    if (!ticketId) return

    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/tickets/${ticketId}/timeline`)
      
      if (!response.ok) {
        // Si es 404, mostrar mensaje más amigable
        if (response.status === 404) {
          console.warn(`Timeline API not found for ticket ${ticketId}. Using empty timeline.`)
          setEvents([])
          return
        }
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.success) {
        setEvents(data.data || [])
      } else {
        throw new Error(data.message || 'Error al cargar el historial')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      setError(errorMessage)
      
      // Solo mostrar toast si no es un error de desarrollo (404)
      if (!errorMessage.includes('404')) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo cargar el historial del ticket"
        })
      }
      
      // Establecer eventos vacíos como fallback
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [ticketId, toast])

  const addComment = useCallback(async (content: string, isInternal: boolean = false, attachments?: File[]) => {
    if (!content.trim()) {
      toast({
        variant: "destructive",
        title: "Contenido requerido",
        description: "Debes escribir un comentario antes de enviarlo"
      })
      return false
    }

    try {
      const formData = new FormData()
      formData.append('content', content)
      formData.append('isInternal', isInternal.toString())
      
      if (attachments && attachments.length > 0) {
        attachments.forEach((file, index) => {
          formData.append(`attachments[${index}]`, file)
        })
      }

      const response = await fetch(`/api/tickets/${ticketId}/comments`, {
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
        
        toast({
          title: "Comentario agregado exitosamente",
          description: `Tu comentario ${commentType} ha sido agregado al historial del ticket${attachmentInfo}`,
          duration: 4000
        })
        loadTimeline() // Recargar timeline
        return true
      } else {
        throw new Error(data.message || 'Error al agregar comentario')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      toast({
        variant: "destructive",
        title: "Error al agregar comentario",
        description: `No se pudo agregar el comentario. ${errorMessage}. Intenta nuevamente.`
      })
      return false
    }
  }, [ticketId, toast, loadTimeline])

  const updateTicketStatus = useCallback(async (newStatus: string, comment?: string) => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: newStatus,
          comment
        })
      })

      if (!response.ok) {
        throw new Error('Error al actualizar estado')
      }

      const data = await response.json()
      
      if (data.success) {
        toast({
          title: "Estado actualizado",
          description: "El estado del ticket se ha actualizado"
        })
        loadTimeline() // Recargar timeline
        return true
      } else {
        throw new Error(data.message || 'Error al actualizar estado')
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
  }, [ticketId, toast, loadTimeline])

  const assignTicket = useCallback(async (assigneeId: string | null, comment?: string) => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}/assign`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          assigneeId,
          comment
        })
      })

      if (!response.ok) {
        throw new Error('Error al asignar ticket')
      }

      const data = await response.json()
      
      if (data.success) {
        toast({
          title: "Ticket asignado",
          description: "La asignación del ticket se ha actualizado"
        })
        loadTimeline() // Recargar timeline
        return true
      } else {
        throw new Error(data.message || 'Error al asignar ticket')
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
  }, [ticketId, toast, loadTimeline])

  // Cargar timeline al montar
  useEffect(() => {
    loadTimeline()
  }, [loadTimeline])

  return {
    events,
    loading,
    error,
    loadTimeline,
    addComment,
    updateTicketStatus,
    assignTicket
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