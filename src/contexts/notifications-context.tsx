'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { safeFetch } from '@/lib/auth-fetch'
import { useNotificationSSE } from '@/hooks/use-notification-sse'
import { useUserSettings } from '@/hooks/use-user-settings'
import { buildEntityKey } from '@/lib/notifications/entity-key'

export interface NotificationData {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  ticketId?: string | null
  metadata?: Record<string, any>
  createdAt: string
  tickets?: { id: string; title: string; status: string } | null
}

interface NotificationsPageResponse {
  items: NotificationData[]
  nextCursor: string | null
  hasMore: boolean
  total: number
  unread: number
}

interface NotificationsContextValue {
  notifications: NotificationData[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  error: string | null
  filterRead: 'all' | 'unread' | 'read'
  setFilterRead: (v: 'all' | 'unread' | 'read') => void
  filterType: string
  setFilterType: (v: string) => void
  searchTerm: string
  setSearchTerm: (v: string) => void
  /** Alias de notifications (filtros van al servidor) */
  filteredNotifications: NotificationData[]
  stats: {
    total: number
    unread: number
    read: number
    filtered: number
    hasActiveFilters: boolean
  }
  loadNotifications: () => void
  loadMore: () => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAsUnread: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (id: string) => Promise<void>
  clearAllNotifications: () => Promise<void>
  /** Posponer notificación (1h|8h|24h); muteThread también silencia el hilo */
  snoozeNotification: (
    id: string,
    duration: '1h' | '8h' | '24h',
    muteThread?: boolean
  ) => Promise<void>
  /** Silenciar hilo por entityKey */
  muteEntity: (entityKey: string, duration: '1h' | '8h' | '24h' | 'forever') => Promise<void>
  unmuteEntity: (entityKey: string) => Promise<void>
  navigateToTicket: (notification: NotificationData) => Promise<void>
  refresh: () => void
  isAuthenticated: boolean
}

const PAGE_SIZE = 20

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

function mergeUnique(existing: NotificationData[], incoming: NotificationData[]) {
  const seen = new Set(existing.map(n => n.id))
  const merged = [...existing]
  for (const n of incoming) {
    if (!seen.has(n.id)) {
      seen.add(n.id)
      merged.push(n)
    }
  }
  return merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationData[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [filterRead, setFilterRead] = useState<'all' | 'unread' | 'read'>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const deletedIds = useRef<Set<string>>(new Set())
  const readOverrides = useRef<Map<string, boolean>>(new Map())
  const pendingOps = useRef(0)
  const nextCursorRef = useRef<string | null>(null)
  const notificationsLoadInFlightRef = useRef(false)

  const { data: session, status } = useSession()
  const { toast } = useToast()
  const router = useRouter()
  const { settings } = useUserSettings()

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 300)
    return () => clearTimeout(t)
  }, [searchTerm])

  const applyLocalOverrides = useCallback((arr: NotificationData[]) => {
    return arr
      .filter(n => !deletedIds.current.has(n.id))
      .map(n => {
        if (readOverrides.current.has(n.id)) {
          return { ...n, isRead: readOverrides.current.get(n.id)! }
        }
        return n
      })
  }, [])

  const buildQuery = useCallback(
    (cursor?: string | null) => {
      const params = new URLSearchParams()
      params.set('limit', String(PAGE_SIZE))
      if (cursor) params.set('cursor', cursor)
      if (filterRead !== 'all') params.set('filterRead', filterRead)
      if (filterType !== 'all') params.set('type', filterType)
      if (debouncedSearch.trim()) params.set('q', debouncedSearch.trim())
      return params.toString()
    },
    [filterRead, filterType, debouncedSearch]
  )

  const loadNotifications = useCallback(
    async (force = false) => {
      if (status !== 'authenticated' || !session?.user?.id) return
      if (!force && pendingOps.current > 0) return
      if (notificationsLoadInFlightRef.current) return

      notificationsLoadInFlightRef.current = true
      setLoading(true)
      setError(null)
      try {
        const res = await safeFetch(`/api/notifications?${buildQuery(null)}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        })
        if (!res) {
          setError('No se pudieron cargar las notificaciones')
          return
        }
        const data = (await res.json()) as NotificationsPageResponse | NotificationData[]

        // Compat: respuesta antigua (array) o nueva (página)
        if (Array.isArray(data)) {
          setNotifications(applyLocalOverrides(data))
          setHasMore(false)
          nextCursorRef.current = null
          setTotalCount(data.length)
          setUnreadCount(data.filter(n => !n.isRead).length)
        } else {
          setNotifications(applyLocalOverrides(data.items ?? []))
          setHasMore(!!data.hasMore)
          nextCursorRef.current = data.nextCursor
          setTotalCount(data.total ?? 0)
          setUnreadCount(data.unread ?? 0)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      } finally {
        notificationsLoadInFlightRef.current = false
        setLoading(false)
      }
    },
    [status, session?.user?.id, buildQuery, applyLocalOverrides]
  )

  const loadNotificationsRef = useRef(loadNotifications)
  useEffect(() => {
    loadNotificationsRef.current = loadNotifications
  }, [loadNotifications])

  const loadMore = useCallback(async () => {
    if (status !== 'authenticated' || !session?.user?.id) return
    if (!hasMore || loadingMore || loading || !nextCursorRef.current) return

    setLoadingMore(true)
    try {
      const res = await safeFetch(`/api/notifications?${buildQuery(nextCursorRef.current)}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      })
      if (!res) return
      const data = (await res.json()) as NotificationsPageResponse
      const pageItems = applyLocalOverrides(data.items ?? [])
      setNotifications(prev => mergeUnique(prev, pageItems))
      setHasMore(!!data.hasMore)
      nextCursorRef.current = data.nextCursor
      if (typeof data.total === 'number') setTotalCount(data.total)
      if (typeof data.unread === 'number') setUnreadCount(data.unread)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoadingMore(false)
    }
  }, [status, session?.user?.id, hasMore, loadingMore, loading, buildQuery, applyLocalOverrides])

  // Recargar al autenticar o al cambiar filtros/búsqueda
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return
    void loadNotificationsRef.current(true)
  }, [status, session?.user?.id, filterRead, filterType, debouncedSearch])

  const markAsRead = useCallback(async (id: string) => {
    let shouldUpdate = false
    setNotifications(list => {
      const target = list.find(n => n.id === id)
      if (!target || target.isRead) return list
      shouldUpdate = true
      readOverrides.current.set(id, true)
      return list.map(n => (n.id === id ? { ...n, isRead: true } : n))
    })
    if (!shouldUpdate) return

    setUnreadCount(c => Math.max(0, c - 1))
    pendingOps.current++
    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: true }),
      })
      if (!res.ok) {
        readOverrides.current.set(id, false)
        setNotifications(list => list.map(n => (n.id === id ? { ...n, isRead: false } : n)))
        setUnreadCount(c => c + 1)
      }
    } catch {
      readOverrides.current.set(id, false)
      setNotifications(list => list.map(n => (n.id === id ? { ...n, isRead: false } : n)))
      setUnreadCount(c => c + 1)
    } finally {
      pendingOps.current--
    }
  }, [])

  const markAsUnread = useCallback(async (id: string) => {
    let shouldUpdate = false
    setNotifications(list => {
      const target = list.find(n => n.id === id)
      if (!target || !target.isRead) return list
      shouldUpdate = true
      readOverrides.current.set(id, false)
      return list.map(n => (n.id === id ? { ...n, isRead: false } : n))
    })
    if (!shouldUpdate) return

    setUnreadCount(c => c + 1)
    pendingOps.current++
    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead: false }),
      })
      if (!res.ok) {
        readOverrides.current.set(id, true)
        setNotifications(list => list.map(n => (n.id === id ? { ...n, isRead: true } : n)))
        setUnreadCount(c => Math.max(0, c - 1))
      }
    } catch {
      readOverrides.current.set(id, true)
      setNotifications(list => list.map(n => (n.id === id ? { ...n, isRead: true } : n)))
      setUnreadCount(c => Math.max(0, c - 1))
    } finally {
      pendingOps.current--
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
    setNotifications(prev => {
      prev.forEach(n => readOverrides.current.set(n.id, true))
      return prev.map(n => ({ ...n, isRead: true }))
    })
    const previousUnread = unreadCount
    setUnreadCount(0)
    pendingOps.current++
    try {
      const res = await fetch('/api/notifications/read-all', { method: 'PATCH' })
      if (res.ok) {
        toast({ title: 'Todas marcadas como leídas' })
      } else {
        readOverrides.current.clear()
        setUnreadCount(previousUnread)
        await loadNotifications(true)
        toast({ title: 'Error al marcar', variant: 'destructive' })
      }
    } catch {
      readOverrides.current.clear()
      setUnreadCount(previousUnread)
      await loadNotifications(true)
      toast({ title: 'Error al marcar', variant: 'destructive' })
    } finally {
      pendingOps.current--
    }
  }, [toast, loadNotifications, unreadCount])

  const deleteNotification = useCallback(
    async (id: string) => {
      const target = notifications.find(n => n.id === id)
      deletedIds.current.add(id)
      setNotifications(prev => prev.filter(n => n.id !== id))
      setTotalCount(c => Math.max(0, c - 1))
      if (target && !target.isRead) setUnreadCount(c => Math.max(0, c - 1))
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
    },
    [notifications, toast, loadNotifications]
  )

  const snoozeNotification = useCallback(
    async (id: string, duration: '1h' | '8h' | '24h', muteThread = false) => {
      setNotifications(prev => prev.filter(n => n.id !== id))
      setTotalCount(c => Math.max(0, c - 1))
      pendingOps.current++
      try {
        const res = await fetch(`/api/notifications/${id}/snooze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ duration, muteThread }),
        })
        if (!res.ok) {
          await loadNotifications(true)
          toast({ title: 'Error al posponer', variant: 'destructive' })
        } else {
          toast({
            title: muteThread ? 'Hilo silenciado temporalmente' : 'Notificación pospuesta',
            description:
              duration === '1h'
                ? 'Volverá en 1 hora'
                : duration === '8h'
                  ? 'Volverá en 8 horas'
                  : 'Volverá en 24 horas',
          })
          if (muteThread) {
            window.dispatchEvent(new CustomEvent('notification-mutes-changed'))
          }
        }
      } catch {
        await loadNotifications(true)
        toast({ title: 'Error al posponer', variant: 'destructive' })
      } finally {
        pendingOps.current--
      }
    },
    [loadNotifications, toast]
  )

  const muteEntity = useCallback(
    async (entityKey: string, duration: '1h' | '8h' | '24h' | 'forever') => {
      pendingOps.current++
      try {
        const res = await fetch('/api/notifications/mutes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entityKey, duration }),
        })
        if (!res.ok) {
          toast({ title: 'Error al silenciar', variant: 'destructive' })
        } else {
          toast({
            title: duration === 'forever' ? 'Hilo silenciado' : 'Hilo pospuesto',
            description: 'No recibirás más avisos de este hilo mientras esté silenciado',
          })
          setNotifications(prev =>
            prev.filter(
              n => buildEntityKey({ ticketId: n.ticketId, metadata: n.metadata }) !== entityKey
            )
          )
          window.dispatchEvent(new CustomEvent('notification-mutes-changed'))
          await loadNotifications(true)
        }
      } catch {
        toast({ title: 'Error al silenciar', variant: 'destructive' })
      } finally {
        pendingOps.current--
      }
    },
    [loadNotifications, toast]
  )

  const unmuteEntity = useCallback(
    async (entityKey: string) => {
      try {
        const res = await fetch(
          `/api/notifications/mutes?entityKey=${encodeURIComponent(entityKey)}`,
          { method: 'DELETE' }
        )
        if (res.ok) {
          toast({ title: 'Silencio eliminado' })
          window.dispatchEvent(new CustomEvent('notification-mutes-changed'))
        } else {
          toast({ title: 'Error al reactivar', variant: 'destructive' })
        }
      } catch {
        toast({ title: 'Error al reactivar', variant: 'destructive' })
      }
    },
    [toast]
  )

  const clearAllNotifications = useCallback(async () => {
    const currentIds = notifications.map(n => n.id)
    currentIds.forEach(id => deletedIds.current.add(id))
    setNotifications([])
    setTotalCount(0)
    setUnreadCount(0)
    setHasMore(false)
    nextCursorRef.current = null
    pendingOps.current++
    try {
      await Promise.all(
        currentIds.map(id =>
          fetch(`/api/notifications/${id}`, { method: 'DELETE' }).catch(() => {})
        )
      )
      toast({ title: 'Notificaciones eliminadas' })
    } catch {
      currentIds.forEach(id => deletedIds.current.delete(id))
      await loadNotifications(true)
      toast({ title: 'Error al eliminar', variant: 'destructive' })
    } finally {
      pendingOps.current--
    }
  }, [notifications, toast, loadNotifications])

  const navigateToTicket = useCallback(
    async (notification: NotificationData) => {
      markAsRead(notification.id)

      const role = (session?.user?.role ?? 'CLIENT').toLowerCase()
      const rolePrefix =
        role === 'admin' ? 'admin' : role === 'technician' ? 'technician' : 'client'

      let destination: string | null = null

      if (notification.ticketId) {
        destination = `/${rolePrefix}/tickets/${notification.ticketId}`
      } else if (notification.metadata?.link) {
        destination = notification.metadata.link as string
        if (destination.includes('/tickets/')) {
          const ticketIdMatch = destination.match(/\/tickets\/([^/]+)/)
          if (ticketIdMatch) {
            destination = `/${rolePrefix}/tickets/${ticketIdMatch[1]}`
          }
        }
      } else if (notification.metadata?.incidentId) {
        destination =
          role === 'admin'
            ? '/admin/patrols/incidents'
            : `/patrol/incidents/${notification.metadata.incidentId}`
      } else if (notification.metadata?.patrolId) {
        destination =
          role === 'admin' ? '/admin/patrols' : `/patrol/${notification.metadata.patrolId}`
      } else if (notification.metadata?.scheduleId) {
        destination = role === 'admin' ? '/admin/patrols/schedules' : '/patrol'
      } else if (notification.metadata?.actId) {
        destination = `/inventory/acts/${notification.metadata.actId}`
      } else if (notification.metadata?.maintenanceId) {
        destination = `/inventory/maintenance/${notification.metadata.maintenanceId}`
      } else if (notification.metadata?.equipmentId) {
        destination = `/inventory/equipment/${notification.metadata.equipmentId}`
      } else if (notification.metadata?.routeId) {
        destination = role === 'admin' ? '/admin/patrols/routes' : '/patrol'
      } else if (notification.metadata?.ticketId) {
        destination = `/${rolePrefix}/tickets/${notification.metadata.ticketId}`
      }

      if (!destination) return

      const isSharedRoute =
        destination.startsWith('/inventory') ||
        destination.startsWith('/admin/news') ||
        destination.startsWith('/admin/forms') ||
        destination.startsWith('/patrol')

      if (!isSharedRoute) {
        const destRole = destination.startsWith('/admin')
          ? 'ADMIN'
          : destination.startsWith('/technician')
            ? 'TECHNICIAN'
            : destination.startsWith('/client')
              ? 'CLIENT'
              : null

        if (destRole && destRole !== session?.user?.role) {
          window.location.href = destination
          return
        }
      }

      router.push(destination)
    },
    [session?.user?.role, markAsRead, router]
  )

  useNotificationSSE({
    onNotification: notif => {
      setUnreadCount(c => c + 1)
      setTotalCount(c => c + 1)

      // Con filtros de leídas/tipo/búsqueda, no insertar a ciegas (evitar inconsistencias)
      if (filterRead === 'read' || filterType !== 'all' || debouncedSearch.trim()) return

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
        return [newNotif, ...prev].filter(n => !deletedIds.current.has(n.id))
      })
    },
    sound: settings.soundEnabled,
  })

  const stats = useMemo(
    () => ({
      total: totalCount,
      unread: unreadCount,
      read: Math.max(0, totalCount - unreadCount),
      filtered: totalCount,
      hasActiveFilters: filterRead !== 'all' || filterType !== 'all' || searchTerm !== '',
    }),
    [totalCount, unreadCount, filterRead, filterType, searchTerm]
  )

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notifications,
      loading,
      loadingMore,
      hasMore,
      error,
      filterRead,
      setFilterRead,
      filterType,
      setFilterType,
      searchTerm,
      setSearchTerm,
      filteredNotifications: notifications,
      stats,
      loadNotifications: () => loadNotifications(true),
      loadMore,
      markAsRead,
      markAsUnread,
      markAllAsRead,
      deleteNotification,
      clearAllNotifications,
      snoozeNotification,
      muteEntity,
      unmuteEntity,
      navigateToTicket,
      refresh: () => loadNotifications(true),
      isAuthenticated: !!session?.user?.id,
    }),
    [
      notifications,
      loading,
      loadingMore,
      hasMore,
      error,
      filterRead,
      filterType,
      searchTerm,
      stats,
      loadNotifications,
      loadMore,
      markAsRead,
      markAsUnread,
      markAllAsRead,
      deleteNotification,
      clearAllNotifications,
      snoozeNotification,
      muteEntity,
      unmuteEntity,
      navigateToTicket,
      session?.user?.id,
    ]
  )

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export function useNotificationsContext(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext)
  if (!ctx) {
    throw new Error('useNotificationsContext must be used within NotificationsProvider')
  }
  return ctx
}

/** Hook público — consume el provider único (sin SSE/fetch duplicados). */
export function useNotifications(_options?: { autoLoad?: boolean }): NotificationsContextValue {
  return useNotificationsContext()
}
