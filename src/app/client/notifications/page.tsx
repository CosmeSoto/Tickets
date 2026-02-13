'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Filter,
  RefreshCw,
  Ticket,
  AlertCircle,
  Info,
  CheckCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Notification {
  id: string
  type: 'SUCCESS' | 'INFO' | 'WARNING' | 'ERROR'
  title: string
  message: string
  isRead: boolean
  createdAt: string
  ticket?: {
    id: string
    title: string
  }
}

export default function ClientNotificationsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (!session) {
      router.push('/login')
      return
    }

    if (session.user.role !== 'CLIENT') {
      router.push('/unauthorized')
      return
    }

    loadNotifications()
  }, [session, router])

  const loadNotifications = async (showToast = false) => {
    setIsRefreshing(true)
    try {
      const response = await fetch('/api/notifications?limit=50')
      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications || [])
        
        if (showToast) {
          toast({
            title: 'Notificaciones actualizadas',
            description: 'Se cargaron las últimas notificaciones',
            variant: 'success',
          })
        }
      }
    } catch (error) {
      console.error('Error loading notifications:', error)
      toast({
        title: 'Error al cargar notificaciones',
        description: 'No se pudieron cargar las notificaciones',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
      })

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
        )
        
        toast({
          title: 'Marcada como leída',
          variant: 'success',
        })
      }
    } catch (error) {
      console.error('Error marking as read:', error)
      toast({
        title: 'Error',
        description: 'No se pudo marcar como leída',
        variant: 'destructive',
      })
    }
  }

  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'POST',
      })

      if (response.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
        
        toast({
          title: 'Todas marcadas como leídas',
          variant: 'success',
        })
      }
    } catch (error) {
      console.error('Error marking all as read:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron marcar todas como leídas',
        variant: 'destructive',
      })
    }
  }

  const deleteNotification = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId))
        
        toast({
          title: 'Notificación eliminada',
          variant: 'success',
        })
      }
    } catch (error) {
      console.error('Error deleting notification:', error)
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la notificación',
        variant: 'destructive',
      })
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 1) return 'Ahora'
    if (minutes < 60) return `Hace ${minutes}min`
    if (hours < 24) return `Hace ${hours}h`
    if (days < 7) return `Hace ${days}d`
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'SUCCESS':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'WARNING':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />
      case 'ERROR':
        return <AlertCircle className="h-5 w-5 text-red-600" />
      case 'INFO':
      default:
        return <Info className="h-5 w-5 text-blue-600" />
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'SUCCESS':
        return 'border-l-green-500'
      case 'WARNING':
        return 'border-l-yellow-500'
      case 'ERROR':
        return 'border-l-red-500'
      case 'INFO':
      default:
        return 'border-l-blue-500'
    }
  }

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.isRead
    if (filter === 'read') return n.isRead
    return true
  })

  const unreadCount = notifications.filter((n) => !n.isRead).length

  if (isLoading) {
    return (
      <RoleDashboardLayout title="Notificaciones" subtitle="Centro de notificaciones">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </RoleDashboardLayout>
    )
  }

  return (
    <RoleDashboardLayout
      title="Notificaciones"
      subtitle={`${unreadCount} notificaciones sin leer`}
    >
      <div className="max-w-4xl mx-auto">
        {/* Actions Bar */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Button
                  variant={filter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('all')}
                >
                  <Bell className="h-4 w-4 mr-2" />
                  Todas ({notifications.length})
                </Button>
                <Button
                  variant={filter === 'unread' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('unread')}
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Sin leer ({unreadCount})
                </Button>
                <Button
                  variant={filter === 'read' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('read')}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Leídas ({notifications.length - unreadCount})
                </Button>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadNotifications(true)}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={cn('h-4 w-4 mr-2', isRefreshing && 'animate-spin')} />
                  Actualizar
                </Button>
                {unreadCount > 0 && (
                  <Button variant="outline" size="sm" onClick={markAllAsRead}>
                    <CheckCheck className="h-4 w-4 mr-2" />
                    Marcar todas como leídas
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications List */}
        {filteredNotifications.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Bell className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No hay notificaciones
              </h3>
              <p className="text-muted-foreground">
                {filter === 'unread'
                  ? 'No tienes notificaciones sin leer'
                  : filter === 'read'
                  ? 'No tienes notificaciones leídas'
                  : 'No tienes notificaciones aún'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notification) => (
              <Card
                key={notification.id}
                className={cn(
                  'border-l-4 transition-all hover:shadow-md',
                  getNotificationColor(notification.type),
                  !notification.isRead && 'bg-blue-50/50'
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start space-x-4">
                    {/* Icon */}
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold text-foreground">
                            {notification.title}
                          </h3>
                          {!notification.isRead && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                          {formatDate(notification.createdAt)}
                        </span>
                      </div>

                      <p className="text-sm text-muted-foreground mb-3">
                        {notification.message}
                      </p>

                      {notification.ticket && (
                        <div className="mb-3 p-2 bg-muted rounded-lg">
                          <div className="flex items-center space-x-2 text-sm">
                            <Ticket className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-foreground">
                              Ticket relacionado:
                            </span>
                            <span className="text-muted-foreground truncate">
                              {notification.ticket.title}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center space-x-2">
                        {!notification.isRead && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markAsRead(notification.id)}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Marcar como leída
                          </Button>
                        )}
                        {notification.ticket && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              router.push(`/client/tickets/${notification.ticket?.id}`)
                            }
                          >
                            <Ticket className="h-4 w-4 mr-1" />
                            Ver Ticket
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteNotification(notification.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </RoleDashboardLayout>
  )
}
