'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { safeFetch } from '@/lib/auth-fetch'
import { useNotificationSSE } from '@/hooks/use-notification-sse'

export interface NotificationData {
  id: string
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
  title: string
  message: string
  isRead: boolean
  ticketId?: string | null
  metadata?: Record<string, any>
  createdAt: string
  tickets?: {
    id: string
    title: string
    status: string
  } | null
}

interface UseNotificationsOptions {
  autoLoad?: boolean
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { autoLoad = true } = options

  const [notifications, setNotifications] = useState<NotificationData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterRead, setFilterRead] = useState<'all' | 'unread' | 'read'>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  const deletedIds = useRef<Set<string>>(new Set())
  const readIds = useRef<Set<string>>(new Set())
  const pendingOps = useRef(0)

  const { data: session, status } = useSession()
  const { toast } = useToast()
  const router = useRouter()

  const loadNotifications = useCallback(async (force = false) => {
    // No hacer fetch si no hay sesión activa
    if (status !== 'authenticated' || !session?.user?.id) return
    if (!force && pendingOps.current > 0) return

    setLoading(true)
    setError(null)
    try {
      const res = await safeFetch('/api/notifications?limit=50', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })
      if (!res) return // sesión expirada — silencioso
      const data = await res.json()
      const arr: NotificationData[] = Array.isArray(data) ? data : []

      setNotifications(
        arr
          .filter(n => !deletedIds.current.has(n.id))
          .map(n => readIds.current.has(n.id) ? { ...n, isRead: true } : n)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [status, session?.user?.id])

  // Marcar una como leída
  const markAsRead = useCallback(async (id: string) => {
    // Optimistic update inmediato
    readIds.current.add(id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))

    pendingOps.current++
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
      if (!res.ok) {
        // Revertir si falla
        readIds.current.delete(id)
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: false } : n))
      }
    } catch {
      readIds.current.delete(id)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: false } : n))
    } finally {
      pendingOps.current--
    }
  }, [])

  // Marcar todas como leídas
  const markAllAsRead = useCallback(async () => {
    // Optimistic update inmediato
    setNotifications(prev => {
      prev.forEach(n => readIds.current.add(n.id))
      return prev.map(n => ({ ...n, isRead: true }))
    })

    pendingOps.current++
    try {
      const res = await fetch('/api/notifications/read-all', { method: 'PATCH' })
      if (res.ok) {
        toast({ title: 'Todas marcadas como leídas' })
      } else {
        // Revertir
        readIds.current.clear()
        await loadNotifications(true)
        toast({ title: 'Error al marcar', variant: 'destructive' })
      }
    } catch {
      readIds.current.clear()
      await loadNotifications(true)
      toast({ title: 'Error al marcar', variant: 'destructive' })
    } finally {
      pendingOps.current--
    }
  }, [toast, loadNotifications])

  // Eliminar una notificación
  const deleteNotification = useCallback(async (id: string) => {
    // Optimistic update inmediato
    deletedIds.current.add(id)
    setNotifications(prev => prev.filter(n => n.id !== id))

    pendingOps.current++
    try {
      const res = await fetch(`/api/notifications/${id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 404 && res.status !== 403) {
        // Revertir solo si es un error real del servidor (no 404 ni 403)
        // 404 = ya no existe (éxito silencioso)
        // 403 = no pertenece al usuario — mantener fuera de la UI igualmente
        deletedIds.current.delete(id)
        await loadNotifications(true)
        toast({ title: 'Error al eliminar', variant: 'destructive' })
      }
    } catch {
      deletedIds.current.delete(id)
      await loadNotifications(true)
      toast({ title: 'Error al eliminar', variant: 'destructive' })
    } finally {
      pendingOps.current--
    }
  }, [toast, loadNotifications])

  // Eliminar todas
  const clearAllNotifications = useCallback(async () => {
    // Capturar IDs actuales antes de limpiar
    const currentIds = notifications.map(n => n.id)

    // Optimistic update inmediato
    currentIds.forEach(id => deletedIds.current.add(id))
    setNotifications([])

    pendingOps.current++
    try {
      await Promise.all(currentIds.map(id =>
        fetch(`/api/notifications/${id}`, { method: 'DELETE' }).catch(() => {})
      ))
      toast({ title: 'Notificaciones eliminadas' })
    } catch {
      // Si falla, recargar desde servidor
      currentIds.forEach(id => deletedIds.current.delete(id))
      await loadNotifications(true)
      toast({ title: 'Error al eliminar', variant: 'destructive' })
    } finally {
      pendingOps.current--
    }
  }, [notifications, toast, loadNotifications])

  // Navegar a la acción relacionada con la notificación
  const navigateToTicket = useCallback((notification: NotificationData) => {
    markAsRead(notification.id)
    // Prioridad 1: link explícito en metadata (actas, mantenimiento, inventario)
    if (notification.metadata?.link) {
      router.push(notification.metadata.link)
      return
    }
    // Prioridad 2: actId → página del acta autenticada
    if (notification.metadata?.actId) {
      router.push(`/inventory/acts/${notification.metadata.actId}`)
      return
    }
    // Prioridad 3: maintenanceId → página de mantenimiento
    if (notification.metadata?.maintenanceId) {
      router.push(`/inventory/maintenance/${notification.metadata.maintenanceId}`)
      return
    }
    // Prioridad 4: equipmentId → detalle del equipo
    if (notification.metadata?.equipmentId) {
      router.push(`/inventory/equipment/${notification.metadata.equipmentId}`)
      return
    }
    // Prioridad 5: ticketId → ticket según rol
    if (notification.ticketId) {
      const role = session?.user?.role?.toLowerCase() || 'client'
      router.push(`/${role}/tickets/${notification.ticketId}`)
      return
    }
  }, [session?.user?.role, markAsRead, router])

  // Notificaciones filtradas
  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      const matchRead =
        filterRead === 'all' ||
        (filterRead === 'unread' && !n.isRead) ||
        (filterRead === 'read' && n.isRead)
      const matchType = filterType === 'all' || n.type === filterType
      const matchSearch =
        !searchTerm ||
        n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.message.toLowerCase().includes(searchTerm.toLowerCase())
      return matchRead && matchType && matchSearch
    })
  }, [notifications, filterRead, filterType, searchTerm])

  const stats = useMemo(() => ({
    total: notifications.length,
    unread: notifications.filter(n => !n.isRead).length,
    read: notifications.filter(n => n.isRead).length,
    filtered: filteredNotifications.length,
    hasActiveFilters: filterRead !== 'all' || filterType !== 'all' || searchTerm !== '',
  }), [notifications, filteredNotifications, filterRead, filterType, searchTerm])

  // Carga inicial — solo cuando hay sesión activa
  useEffect(() => {
    if (!autoLoad || status !== 'authenticated' || !session?.user?.id) return
    loadNotifications(true)
  }, [autoLoad, status, session?.user?.id, loadNotifications])

  // SSE: recibe notificaciones en tiempo real y las inserta al inicio de la lista
  useNotificationSSE({
    onNotification: (notif) => {
      setNotifications(prev => {
        if (prev.some(n => n.id === notif.id)) return prev
        const newNotif: NotificationData = {
          id: notif.id,
          type: notif.notificationType,
          title: notif.title,
          message: notif.message,
          isRead: false,
          ticketId: notif.ticketId,
          metadata: notif.metadata,
          createdAt: notif.createdAt,
        }
        return [newNotif, ...prev]
          .filter(n => !deletedIds.current.has(n.id))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      })
    },
    sound: true,
  })

  return {
    notifications,
    loading,
    error,
    filterRead,
    setFilterRead,
    filterType,
    setFilterType,
    searchTerm,
    setSearchTerm,
    filteredNotifications,
    stats,
    loadNotifications: () => loadNotifications(true),
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    navigateToTicket,
    refresh: () => loadNotifications(true),
    isAuthenticated: !!session?.user?.id,
  }
}
