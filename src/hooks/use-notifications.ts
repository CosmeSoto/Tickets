'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useToast } from '@/hooks/use-toast'

// Tipos básicos para el hook
export interface NotificationData {
  id: string
  type: 'TICKET_CREATED' | 'TICKET_ASSIGNED' | 'TICKET_STATUS_CHANGED' | 'COMMENT_ADDED' | 'TICKET_UPDATED'
  title: string
  message: string
  data: {
    ticketId?: string
    userId?: string
    priority?: string
    status?: string
    [key: string]: any
  }
  read: boolean
  createdAt: string
  userId: string
}

export interface NotificationPreferences {
  emailNotifications: boolean
  pushNotifications: boolean
  soundEnabled: boolean
  ticketCreated: boolean
  ticketAssigned: boolean
  statusChanged: boolean
  newComments: boolean
  ticketUpdated: boolean
  quietHours: {
    enabled: boolean
    startTime: string
    endTime: string
  }
}

interface UseNotificationsOptions {
  autoLoad?: boolean
  refreshInterval?: number
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const {
    autoLoad = true,
    refreshInterval = 2 * 60 * 1000, // 2 minutos por defecto
  } = options

  // Estados principales
  const [notifications, setNotifications] = useState<NotificationData[]>([])
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    emailNotifications: true,
    pushNotifications: true,
    soundEnabled: true,
    ticketCreated: true,
    ticketAssigned: true,
    statusChanged: true,
    newComments: true,
    ticketUpdated: true,
    quietHours: {
      enabled: false,
      startTime: '22:00',
      endTime: '08:00',
    },
  })
  const [loading, setLoading] = useState(false)
  const [loadingPreferences, setLoadingPreferences] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Estados de filtros
  const [filterType, setFilterType] = useState<string>('all')
  const [filterRead, setFilterRead] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  
  // Estados de UI
  const [showPreferences, setShowPreferences] = useState(false)

  const { data: session } = useSession()
  const { toast } = useToast()

  // Función para cargar notificaciones
  const loadNotifications = useCallback(async () => {
    if (!session?.user?.id) return

    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/notifications', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.success && Array.isArray(data.data)) {
        // Ordenar por fecha (más recientes primero)
        const sortedNotifications = data.data.sort((a: NotificationData, b: NotificationData) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        
        setNotifications(sortedNotifications)
      } else {
        throw new Error('Formato de respuesta inválido')
      }
      
    } catch (error) {
      console.error('[NOTIFICATIONS] Error loading:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      setError(errorMessage)
      
      toast({
        title: 'Error al cargar notificaciones',
        description: `No se pudieron cargar las notificaciones: ${errorMessage}`,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [session?.user?.id, toast])

  // Función para marcar como leída
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        credentials: 'include',
      })
      
      if (response.ok) {
        setNotifications(prev => 
          prev.map(notification => 
            notification.id === notificationId 
              ? { ...notification, read: true }
              : notification
          )
        )
      }
      
    } catch (error) {
      console.error('[NOTIFICATIONS] Error marking as read:', error)
    }
  }, [])

  // Función para marcar todas como leídas
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'PUT',
        credentials: 'include',
      })
      
      if (response.ok) {
        setNotifications(prev => 
          prev.map(notification => ({ ...notification, read: true }))
        )
        
        toast({
          title: 'Notificaciones marcadas',
          description: 'Todas las notificaciones han sido marcadas como leídas',
        })
      }
      
    } catch (error) {
      console.error('[NOTIFICATIONS] Error marking all as read:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron marcar las notificaciones como leídas',
        variant: 'destructive',
      })
    }
  }, [toast])

  // Función para eliminar notificación
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      
      if (response.ok) {
        setNotifications(prev => 
          prev.filter(notification => notification.id !== notificationId)
        )
        
        toast({
          title: 'Notificación eliminada',
          description: 'La notificación ha sido eliminada',
        })
      }
      
    } catch (error) {
      console.error('[NOTIFICATIONS] Error deleting:', error)
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la notificación',
        variant: 'destructive',
      })
    }
  }, [toast])

  // Función para limpiar todas las notificaciones
  const clearAllNotifications = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/clear-all', {
        method: 'DELETE',
        credentials: 'include',
      })
      
      if (response.ok) {
        setNotifications([])
        
        toast({
          title: 'Notificaciones eliminadas',
          description: 'Todas las notificaciones han sido eliminadas',
        })
      }
      
    } catch (error) {
      console.error('[NOTIFICATIONS] Error clearing all:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron eliminar las notificaciones',
        variant: 'destructive',
      })
    }
  }, [toast])

  // Notificaciones filtradas
  const filteredNotifications = useMemo(() => {
    return notifications.filter(notification => {
      const matchesType = filterType === 'all' || notification.type === filterType
      const matchesRead = filterRead === 'all' || 
        (filterRead === 'read' && notification.read) ||
        (filterRead === 'unread' && !notification.read)
      const matchesSearch = !searchTerm || 
        notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        notification.message.toLowerCase().includes(searchTerm.toLowerCase())
      
      return matchesType && matchesRead && matchesSearch
    })
  }, [notifications, filterType, filterRead, searchTerm])

  // Función para cargar preferencias
  const loadPreferences = useCallback(async () => {
    if (!session?.user?.id) return

    setLoadingPreferences(true)
    
    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setPreferences(data.data)
        }
      }
      
    } catch (error) {
      console.error('[NOTIFICATIONS] Error loading preferences:', error)
    } finally {
      setLoadingPreferences(false)
    }
  }, [session?.user?.id])

  // Función para guardar preferencias
  const savePreferences = useCallback(async (newPreferences: Partial<NotificationPreferences>) => {
    if (!session?.user?.id) return

    setLoadingPreferences(true)
    
    try {
      const updatedPreferences = { ...preferences, ...newPreferences }
      
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedPreferences),
        credentials: 'include',
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setPreferences(updatedPreferences)
          
          toast({
            title: 'Preferencias guardadas',
            description: 'Tus preferencias de notificaciones han sido actualizadas',
          })
        }
      } else {
        throw new Error('Error al guardar preferencias')
      }
      
    } catch (error) {
      console.error('[NOTIFICATIONS] Error saving preferences:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron guardar las preferencias',
        variant: 'destructive',
      })
    } finally {
      setLoadingPreferences(false)
    }
  }, [session?.user?.id, preferences, toast])

  // Estadísticas básicas
  const stats = useMemo(() => ({
    total: notifications.length,
    unread: notifications.filter(n => !n.read).length,
    read: notifications.filter(n => n.read).length,
    filtered: filteredNotifications.length,
    hasActiveFilters: filterType !== 'all' || filterRead !== 'all' || searchTerm !== '',
    byType: {
      TICKET_CREATED: notifications.filter(n => n.type === 'TICKET_CREATED').length,
      TICKET_ASSIGNED: notifications.filter(n => n.type === 'TICKET_ASSIGNED').length,
      TICKET_STATUS_CHANGED: notifications.filter(n => n.type === 'TICKET_STATUS_CHANGED').length,
      COMMENT_ADDED: notifications.filter(n => n.type === 'COMMENT_ADDED').length,
      TICKET_UPDATED: notifications.filter(n => n.type === 'TICKET_UPDATED').length,
    }
  }), [notifications, filteredNotifications, filterType, filterRead, searchTerm])

  // Cargar notificaciones y preferencias al montar
  useEffect(() => {
    if (autoLoad && session?.user?.id) {
      loadNotifications()
      loadPreferences()
      
      if (refreshInterval > 0) {
        const interval = setInterval(loadNotifications, refreshInterval)
        return () => clearInterval(interval)
      }
    }
    return undefined
  }, [autoLoad, session?.user?.id, loadNotifications, loadPreferences, refreshInterval])

  return {
    // Estados principales
    notifications,
    preferences,
    loading,
    loadingPreferences,
    error,
    
    // Estados de filtros
    filterType,
    setFilterType,
    filterRead,
    setFilterRead,
    searchTerm,
    setSearchTerm,
    
    // Estados de UI
    showPreferences,
    setShowPreferences,
    
    // Datos procesados
    filteredNotifications,
    stats,
    pagination: null, // No se usa paginación en el hook
    
    // Funciones principales
    loadNotifications,
    loadPreferences,
    savePreferences,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    
    // Función de utilidad
    refresh: loadNotifications,
    
    // Estado de sesión
    isAuthenticated: !!session?.user?.id,
  }
}
