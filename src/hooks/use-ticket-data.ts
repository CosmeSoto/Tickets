'use client'

import { useState, useCallback } from 'react'
import { useToast } from './use-toast'

// Tipos base para el sistema
export interface TicketStatus {
  value: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'ON_HOLD'
  label: string
  color: string
  icon: string
}

export interface TicketPriority {
  value: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  label: string
  color: string
}

export interface User {
  id: string
  name: string
  email: string
  role: 'CLIENT' | 'TECHNICIAN' | 'ADMIN'
  department?: string
  isActive: boolean
  avatar?: string
}

export interface Category {
  id: string
  name: string
  color: string
  level: number
  parent?: Category
  isActive: boolean
}

export interface Ticket {
  id: string
  title: string
  description: string
  status: TicketStatus['value']
  priority: TicketPriority['value']
  client: User
  assignee?: User
  category: Category
  createdAt: string
  updatedAt: string
  resolvedAt?: string
  dueDate?: string
  knowledgeArticleId?: string | null
  tags?: string[]
  attachments?: Array<{
    id: string
    filename: string
    originalName: string
    filepath: string
    size: number
    mimeType: string
    uploadedAt: string
    createdAt: string
  }>
  comments?: Array<{
    id: string
    content: string
    isInternal: boolean
    createdAt: string
    user: User
  }>
  history?: Array<{
    id: string
    action: string
    field?: string
    oldValue?: string
    newValue?: string
    comment?: string
    createdAt: string
    user: User
  }>
  _count?: {
    comments: number
    attachments: number
    timeEntries: number
  }
}

// Hook para gestión de tickets
export function useTicketData() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleApiCall = useCallback(async <T>(
    apiCall: () => Promise<Response>,
    successMessage?: string,
    suppressErrorToast?: boolean
  ): Promise<T | null> => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await apiCall()
      
      if (!response.ok) {
        // Manejo especial para 404
        if (response.status === 404) {
          const errorData = await response.json().catch(() => ({ message: 'Recurso no encontrado' }))
          throw new Error(errorData.message || 'Recurso no encontrado')
        }
        
        const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }))
        throw new Error(errorData.message || `Error ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.message || 'Error en la respuesta del servidor')
      }

      if (successMessage) {
        toast({
          title: "Éxito",
          description: successMessage
        })
      }

      return data.data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      setError(errorMessage)
      
      if (!suppressErrorToast) {
        toast({
          variant: "destructive",
          title: "Error",
          description: errorMessage
        })
      }
      return null
    } finally {
      setLoading(false)
    }
  }, [toast])

  // Obtener ticket por ID
  const getTicket = useCallback(async (id: string): Promise<Ticket | null> => {
    return handleApiCall<Ticket>(
      () => fetch(`/api/tickets/${id}`)
    )
  }, [handleApiCall])

  // Obtener lista de tickets con filtros
  const getTickets = useCallback(async (params: {
    page?: number
    limit?: number
    status?: string
    priority?: string
    assigneeId?: string
    categoryId?: string
    clientId?: string
    search?: string
  } = {}): Promise<{ data: Ticket[], meta: any } | null> => {
    try {
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          searchParams.append(key, value.toString())
        }
      })

      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/tickets?${searchParams}`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }))
        throw new Error(errorData.message || `Error ${response.status}`)
      }

      const apiResponse = await response.json()
      
      if (!apiResponse.success) {
        throw new Error(apiResponse.message || 'Error en la respuesta del servidor')
      }

      // La API retorna { success: true, data: Ticket[], meta: {...} }
      // Asegurar que data es un array
      const tickets = Array.isArray(apiResponse.data) ? apiResponse.data : []
      
      return {
        data: tickets,
        meta: apiResponse.meta || null
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      setError(errorMessage)
      
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage
      })
      
      return { data: [], meta: null }
    } finally {
      setLoading(false)
    }
  }, [toast])

  // Actualizar ticket
  const updateTicket = useCallback(async (
    id: string, 
    updates: Partial<Ticket>
  ): Promise<Ticket | null> => {
    return handleApiCall<Ticket>(
      () => fetch(`/api/tickets/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      }),
      'Ticket actualizado exitosamente'
    )
  }, [handleApiCall])

  // Crear ticket
  const createTicket = useCallback(async (
    ticketData: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Ticket | null> => {
    return handleApiCall<Ticket>(
      () => fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticketData)
      }),
      'Ticket creado exitosamente'
    )
  }, [handleApiCall])

  // Eliminar ticket
  const deleteTicket = useCallback(async (id: string): Promise<boolean> => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/tickets/${id}`, { method: 'DELETE' })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Error al eliminar el ticket')
      }

      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setError(msg)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    loading,
    error,
    getTicket,
    getTickets,
    updateTicket,
    createTicket,
    deleteTicket
  }
}

// Hook para usuarios
export function useUserData() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const getUsers = useCallback(async (params: {
    role?: User['role']
    isActive?: boolean
    department?: string
  } = {}): Promise<User[]> => {
    try {
      setLoading(true)
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString())
        }
      })

      const response = await fetch(`/api/users?${searchParams}`)
      
      if (!response.ok) {
        throw new Error('Error al cargar usuarios')
      }

      const data = await response.json()
      return data.success ? data.data : []
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron cargar los usuarios"
      })
      return []
    } finally {
      setLoading(false)
    }
  }, [toast])

  const getTechnicians = useCallback(() => 
    getUsers({ role: 'TECHNICIAN', isActive: true })
  , [getUsers])

  return {
    loading,
    getUsers,
    getTechnicians
  }
}

// Hook para categorías
export function useCategoryData() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const getCategories = useCallback(async (params: {
    isActive?: boolean
    level?: number
    parentId?: string
  } = {}): Promise<Category[]> => {
    try {
      setLoading(true)
      const searchParams = new URLSearchParams()
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString())
        }
      })

      const response = await fetch(`/api/categories?${searchParams}`)
      
      if (!response.ok) {
        throw new Error('Error al cargar categorías')
      }

      const data = await response.json()
      return data.success ? data.data : []
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron cargar las categorías"
      })
      return []
    } finally {
      setLoading(false)
    }
  }, [toast])

  return {
    loading,
    getCategories
  }
}

// Constantes del sistema
export const TICKET_STATUSES: TicketStatus[] = [
  { value: 'OPEN', label: 'Abierto', color: 'bg-blue-100 text-blue-800', icon: 'AlertCircle' },
  { value: 'IN_PROGRESS', label: 'En Progreso', color: 'bg-yellow-100 text-yellow-800', icon: 'Clock' },
  { value: 'RESOLVED', label: 'Resuelto', color: 'bg-green-100 text-green-800', icon: 'CheckCircle' },
  { value: 'CLOSED', label: 'Cerrado', color: 'bg-gray-100 text-gray-800', icon: 'XCircle' },
  { value: 'ON_HOLD', label: 'En Espera', color: 'bg-purple-100 text-purple-800', icon: 'Pause' }
]

export const TICKET_PRIORITIES: TicketPriority[] = [
  { value: 'LOW', label: 'Baja', color: 'bg-gray-100 text-gray-800' },
  { value: 'MEDIUM', label: 'Media', color: 'bg-blue-100 text-blue-800' },
  { value: 'HIGH', label: 'Alta', color: 'bg-orange-100 text-orange-800' },
  { value: 'URGENT', label: 'Urgente', color: 'bg-red-100 text-red-800' }
]

// Utilidades
export const getStatusConfig = (status: TicketStatus['value']) => 
  TICKET_STATUSES.find(s => s.value === status)

export const getPriorityConfig = (priority: TicketPriority['value']) => 
  TICKET_PRIORITIES.find(p => p.value === priority)

export const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `hace ${days} día${days > 1 ? 's' : ''}`
  if (hours > 0) return `hace ${hours} hora${hours > 1 ? 's' : ''}`
  if (minutes > 0) return `hace ${minutes} minuto${minutes > 1 ? 's' : ''}`
  return 'Ahora mismo'
}

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}