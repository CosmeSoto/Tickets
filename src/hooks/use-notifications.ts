'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { safeFetch } from '@/lib/auth-fetch'
import { useNotificationSSE } from '@/hooks/use-notification-sse'
import { useUserSettings } from '@/hooks/use-user-settings'

export interface NotificationData {
  id: string
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
  title: string
  message: string
  isRead: boolean
  ticketId?: string | null
  metadata?: Record<string, any>
  createdAt: string
  tickets?: { id: string; title: string; status: string } | null
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
  const { settings } = useUserSettings()

  // ── Carga de notificaciones ─────────────────────────────────────────────────
  const loadNotifications = useCallback(async (force = false) => {
    if (status !== 'authenticated' || !session?.user?.id) return
    if (!force && pendingOps.current > 0) return

    setLoading(true)
    setError(null)
    try {
      const res = await safeFetch('/api/notifications?limit=50', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })
      if (!res) return
      const data = await res.json()
      const arr: NotificationData[] = Array.isArray(data) ? data : []
      setNotifications(
        arr
          .filter(n => !deletedIds.current.has(n.id))
          .map(n => (readIds.current.has(n.id) ? { ...n, isRead: true } : n))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [status, session?.user?.id])

  useEffect(() => {
    if (!autoLoad || status !== 'authenticated' || !session?.user?.id) return
    loadNotifications(true)
  }, [autoLoad, status, session?.user?.id, loadNotifications])

  // ── Acciones ────────────────────────────────────────────────────────────────
  const markAsRead = useCallback(async (id: string) => {
    readIds.current.add(id)
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, isRead: true } : n)))
    pendingOps.current++
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
      if (!res.ok) {
        readIds.current.delete(id)
        setNotifications(prev => prev.map(n => (n.id === id ? { ...n, isRead: false } : n)))
      }
    } catch {
      readIds.current.delete(id)
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, isRead: false } : n)))
    } finally {
      pendingOps.current--
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
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

  const deleteNotification = useCallback(async (id: string) => {
    deletedIds.current.add(id)
    setNotifications(prev => prev.filter(n => n.id !== id))
    pendingOps.current++
    try {
      const res = await fetch(`/api/notifications/${id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 404 && res.status !== 403) {
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

  const clearAllNotifications = useCallback(async () => {
    const currentIds = notifications.map(n => n.id)
    currentIds.forEach(id => deletedIds.current.add(id))
    setNotifications([])
    pendingOps.current++
    try {
      await Promise.all(currentIds.map(id =>
        fetch(`/api/notifications/${id}`, { method: 'DELETE' }).catch(() => {})
      ))
      toast({ title: 'Notificaciones eliminadas' })
    } catch {
      currentIds.forEach(id => deletedIds.current.delete(id))
      await loadNotifications(true)
      toast({ title: 'Error al eliminar', variant: 'destructive' })
    } finally {
      pendingOps.current--
    }
  }, [notifications, toast, loadNotifications])

  const navigateToTicket = useCallback(async (notification: NotificationData) => {
    markAsRead(notification.id)

    let destination: string | null = null
    if (notification.metadata?.link) {
      destination = notification.metadata.link as string
    } else if (notification.metadata?.actId) {
      destination = `/inventory/acts/${notification.metadata.actId}`
    } else if (notification.metadata?.maintenanceId) {
      destination = `/inventory/maintenance/${notification.metadata.maintenanceId}`
    } else if (notification.metadata?.equipmentId) {
      destination = `/inventory/equipment/${notification.metadata.equipmentId}`
    } else if (notification.ticketId) {
      destination = `/${(session?.user?.role ?? 'client').toLowerCase()}/tickets/${notification.ticketId}`
    }

    if (!destination) return

    const destRole = destination.startsWith('/admin') ? 'ADMIN'
      : destination.startsWith('/technician') ? 'TECHNICIAN'
      : destination.startsWith('/client') ? 'CLIENT'
      : null

    if (destRole && destRole !== session?.user?.role) {
      window.location.href = destination
      return
    }

    router.push(destination)
  }, [session?.user?.role, markAsRead, router])

  // ── SSE — usa soundEnabled del store global ─────────────────────────────────
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
    sound: settings.soundEnabled,
  })

  // ── Filtros ─────────────────────────────────────────────────────────────────
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
