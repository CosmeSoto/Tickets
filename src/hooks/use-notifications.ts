'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useToast } from '@/hooks/use-toast'
import { usePagination } from './common/use-pagination'

// Tipos optimizados para el hook
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

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

interface UseNotificationsOptions {
  cacheTTL?: number
  enableCache?: boolean
  autoConnect?: boolean
  enablePagination?: boolean
  pageSize?: number
  enableSound?: boolean
  maxRetries?: number
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const {
    cacheTTL = 5 * 60 * 1000, // 5 minutos
    enableCache = true,
    autoConnect = true,
    enablePagination = true,
    pageSize = 20,
    enableSound = true,
    maxRetries = 3,
  } = options

  // Estados principales
  const [notifications, setNotifications] = useState<NotificationData[]>([])
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    emailNotifications: true,
    pushNotifications: true,
    soundEnabled: enableSound,
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
  
  // Estados de conexión
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  
  // Estados de carga
  const [loading, setLoading] = useState(false)
  const [loadingPreferences, setLoadingPreferences] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Estados de filtros
  const [filterType, setFilterType] = useState<string>('all')
  const [filterRead, setFilterRead] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  
  // Estados de UI
  const [showPreferences, setShowPreferences] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(enableSound)

  const { data: session } = useSession()
  const { toast } = useToast()

  // Cache inteligente
  const cache = useMemo(() => new Map<string, CacheEntry<any>>(), [])

  const getCacheKey = useCallback((endpoint: string, params?: Record<string, any>) => {
    const paramString = params ? JSON.stringify(params) : ''
    return `${endpoint}:${paramString}`
  }, [])

  const getFromCache = useCallback(<T>(key: string): T | null => {
    if (!enableCache) return null
    
    const entry = cache.get(key)
    if (!entry) return null
    
    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      cache.delete(key)
      return null
    }
    
    return entry.data
  }, [cache, enableCache])

  const setToCache = useCallback(<T>(key: string, data: T, ttl = cacheTTL) => {
    if (!enableCache) return
    
    cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }, [cache, enableCache, cacheTTL])

  const invalidateCache = useCallback((pattern?: string) => {
    if (pattern) {
      const keysToDelete = Array.from(cache.keys()).filter(key => key.includes(pattern))
      keysToDelete.forEach(key => cache.delete(key))
    } else {
      cache.clear()
    }
  }, [cache])

  // Servicio de notificaciones (carga dinámica para evitar SSR)
  const [notificationService, setNotificationService] = useState<any>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('@/lib/notifications').then((module) => {
        setNotificationService(module.notificationService)
      })
    }
  }, [])

  // Función para cargar notificaciones
  const loadNotifications = useCallback(async (forceRefresh = false) => {
    if (!session?.user?.id) return

    const cacheKey = getCacheKey('/api/notifications', { userId: session.user.id })
    
    if (!forceRefresh) {
      const cached = getFromCache<NotificationData[]>(cacheKey)
      if (cached) {
        setNotifications(cached)
        return
      }
    }

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
        setToCache(cacheKey, sortedNotifications)
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
  }, [session?.user?.id, getCacheKey, getFromCache, setToCache, toast])

  // Función para cargar preferencias
  const loadPreferences = useCallback(async (forceRefresh = false) => {
    if (!session?.user?.id) return

    const cacheKey = getCacheKey('/api/notifications/preferences', { userId: session.user.id })
    
    if (!forceRefresh) {
      const cached = getFromCache<NotificationPreferences>(cacheKey)
      if (cached) {
        setPreferences(cached)
        setSoundEnabled(cached.soundEnabled)
        return
      }
    }

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
          setSoundEnabled(data.data.soundEnabled)
          setToCache(cacheKey, data.data)
        }
      }
      
    } catch (error) {
      console.error('[NOTIFICATIONS] Error loading preferences:', error)
    } finally {
      setLoadingPreferences(false)
    }
  }, [session?.user?.id, getCacheKey, getFromCache, setToCache])

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
          setSoundEnabled(updatedPreferences.soundEnabled)
          
          // Invalidar cache
          invalidateCache('preferences')
          
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
  }, [session?.user?.id, preferences, invalidateCache, toast])

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
        
        // Invalidar cache
        invalidateCache('notifications')
      }
      
    } catch (error) {
      console.error('[NOTIFICATIONS] Error marking as read:', error)
    }
  }, [invalidateCache])

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
        
        // Invalidar cache
        invalidateCache('notifications')
        
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
  }, [invalidateCache, toast])

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
        
        // Invalidar cache
        invalidateCache('notifications')
        
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
  }, [invalidateCache, toast])

  // Función para limpiar todas las notificaciones
  const clearAllNotifications = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/clear-all', {
        method: 'DELETE',
        credentials: 'include',
      })
      
      if (response.ok) {
        setNotifications([])
        
        // Invalidar cache
        invalidateCache('notifications')
        
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
  }, [invalidateCache, toast])

  // Función para conectar al stream de notificaciones
  const connect = useCallback(async () => {
    if (!session?.user?.id || !notificationService || connected || connecting) return

    setConnecting(true)
    setConnectionError(null)
    
    try {
      await notificationService.connect(session.user.id)
      
      notificationService.onNotification((notification: NotificationData) => {
        // Agregar nueva notificación al estado
        setNotifications(prev => [notification, ...prev])
        
        // Mostrar toast si las preferencias lo permiten
        if (shouldShowNotification(notification)) {
          toast({
            title: notification.title,
            description: notification.message,
            variant: notification.type.includes('ERROR') ? 'destructive' : 'default'
          })
          
          // Reproducir sonido si está habilitado
          if (soundEnabled && preferences.soundEnabled) {
            playNotificationSound()
          }
        }
        
        // Invalidar cache
        invalidateCache('notifications')
      })
      
      setConnected(true)
      setRetryCount(0)
      
    } catch (error) {
      console.error('[NOTIFICATIONS] Connection error:', error)
      setConnectionError(error instanceof Error ? error.message : 'Error de conexión')
      
      // Reintentar conexión
      if (retryCount < maxRetries) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1)
          connect()
        }, 5000 * (retryCount + 1)) // Backoff exponencial
      }
    } finally {
      setConnecting(false)
    }
  }, [session?.user?.id, notificationService, connected, connecting, retryCount, maxRetries, soundEnabled, preferences.soundEnabled, toast, invalidateCache])

  // Función para desconectar
  const disconnect = useCallback(() => {
    if (notificationService && connected) {
      notificationService.disconnect()
      setConnected(false)
      setConnectionError(null)
      setRetryCount(0)
    }
  }, [notificationService, connected])

  // Función para verificar si mostrar notificación
  const shouldShowNotification = useCallback((notification: NotificationData) => {
    // Verificar preferencias por tipo
    switch (notification.type) {
      case 'TICKET_CREATED':
        return preferences.ticketCreated
      case 'TICKET_ASSIGNED':
        return preferences.ticketAssigned
      case 'TICKET_STATUS_CHANGED':
        return preferences.statusChanged
      case 'COMMENT_ADDED':
        return preferences.newComments
      case 'TICKET_UPDATED':
        return preferences.ticketUpdated
      default:
        return true
    }
  }, [preferences])

  // Función para reproducir sonido
  const playNotificationSound = useCallback(() => {
    if (typeof window !== 'undefined' && soundEnabled) {
      try {
        const audio = new Audio('/sounds/notification.mp3')
        audio.volume = 0.5
        audio.play().catch(() => {
          // Ignorar errores de reproducción (permisos, etc.)
        })
      } catch (error) {
        // Ignorar errores de audio
      }
    }
  }, [soundEnabled])

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

  // Paginación
  const pagination = usePagination(filteredNotifications, {
    pageSize,
  })

  // Estadísticas
  const stats = useMemo(() => ({
    total: notifications.length,
    unread: notifications.filter(n => !n.read).length,
    read: notifications.filter(n => n.read).length,
    filtered: filteredNotifications.length,
    byType: {
      TICKET_CREATED: notifications.filter(n => n.type === 'TICKET_CREATED').length,
      TICKET_ASSIGNED: notifications.filter(n => n.type === 'TICKET_ASSIGNED').length,
      TICKET_STATUS_CHANGED: notifications.filter(n => n.type === 'TICKET_STATUS_CHANGED').length,
      COMMENT_ADDED: notifications.filter(n => n.type === 'COMMENT_ADDED').length,
      TICKET_UPDATED: notifications.filter(n => n.type === 'TICKET_UPDATED').length,
    },
    hasActiveFilters: filterType !== 'all' || filterRead !== 'all' || searchTerm !== '',
  }), [notifications, filteredNotifications, filterType, filterRead, searchTerm])

  // Efectos
  useEffect(() => {
    if (session?.user?.id) {
      loadNotifications()
      loadPreferences()
    }
  }, [session?.user?.id, loadNotifications, loadPreferences])

  useEffect(() => {
    if (autoConnect && session?.user?.id && notificationService) {
      connect()
    }
    
    return () => {
      disconnect()
    }
  }, [autoConnect, session?.user?.id, notificationService, connect, disconnect])

  return {
    // Estados principales
    notifications,
    preferences,
    
    // Estados de conexión
    connected,
    connecting,
    connectionError,
    
    // Estados de carga
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
    soundEnabled,
    setSoundEnabled,
    
    // Datos procesados
    filteredNotifications,
    stats,
    pagination: enablePagination ? pagination : null,
    
    // Funciones principales
    loadNotifications,
    loadPreferences,
    savePreferences,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    
    // Funciones de conexión
    connect,
    disconnect,
    
    // Funciones de cache
    invalidateCache,
    
    // Funciones de utilidad
    refresh: () => {
      loadNotifications(true)
      loadPreferences(true)
    },
    
    // Estados de sesión
    isAuthenticated: !!session?.user?.id,
  }
}