'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Bell, Check, CheckCheck, Eye } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { formatTimeAgo } from '@/hooks/use-users'

interface Notification {
  id: string
  title: string
  message: string
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
  isRead: boolean
  ticketId?: string
  metadata?: Record<string, any>
  createdAt: string
  tickets?: {
    id: string
    title: string
    status: string
  }
}

export function NotificationBell() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const fetchNotifications = async () => {
    if (status !== 'authenticated') return
    try {
      const response = await fetch('/api/notifications?limit=20')
      if (response.ok) {
        const data = await response.json()
        setNotifications(data)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }

  const fetchUnreadCount = async () => {
    if (status !== 'authenticated') return
    try {
      const response = await fetch('/api/notifications/unread-count')
      if (response.ok) {
        const data = await response.json()
        setUnreadCount(data.count)
      }
    } catch (error) {
      console.error('Error fetching unread count:', error)
    }
  }

  // Mark as read
  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
      })

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, isRead: true } : n
          )
        )
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('Error marking as read:', error)
    }
  }

  // Mark all as read
  const markAllAsRead = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/notifications/read-all', {
        method: 'PATCH',
      })

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, isRead: true }))
        )
        setUnreadCount(0)
      }
    } catch (error) {
      console.error('Error marking all as read:', error)
    } finally {
      setLoading(false)
    }
  }

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id)
    }

    setIsOpen(false)

    // Navegar según el tipo de notificación
    const meta = notification.metadata as Record<string, any> | undefined
    if (meta?.maintenanceId) {
      router.push(`/inventory/maintenance/${meta.maintenanceId}`)
      return
    }
    if (meta?.equipmentId && !notification.ticketId) {
      router.push(`/inventory/equipment/${meta.equipmentId}`)
      return
    }

    if (notification.ticketId) {
      const role = session?.user?.role?.toLowerCase() || 'client'
      router.push(`/${role}/tickets/${notification.ticketId}`)
    }
  }

  // Polling every 15 seconds — solo cuando hay sesión activa
  useEffect(() => {
    if (status !== 'authenticated') return
    fetchNotifications()
    fetchUnreadCount()

    const interval = setInterval(() => {
      fetchUnreadCount()
      if (!isOpen) fetchNotifications()
    }, 15000)

    return () => clearInterval(interval)
  }, [isOpen, status])

  // Refresh when popover opens — solo si hay sesión
  useEffect(() => {
    if (isOpen && status === 'authenticated') {
      fetchNotifications()
      fetchUnreadCount()
    }
  }, [isOpen, status])

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'SUCCESS':
        return 'text-green-600 dark:text-green-400'
      case 'WARNING':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'ERROR':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-blue-600 dark:text-blue-400'
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant='ghost' size='icon' className='relative'>
          <Bell className='h-5 w-5' />
          {unreadCount > 0 && (
            <Badge
              variant='destructive'
              className='absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs'
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-96 p-0' align='end'>
        <div className='flex items-center justify-between p-4 border-b'>
          <h3 className='font-semibold text-lg'>Notificaciones</h3>
          {unreadCount > 0 && (
            <Button
              variant='ghost'
              size='sm'
              onClick={markAllAsRead}
              disabled={loading}
              className='text-xs'
            >
              <CheckCheck className='h-4 w-4 mr-1' />
              Marcar todas
            </Button>
          )}
        </div>

        <ScrollArea className='h-[400px]'>
          {notifications.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-12 text-center'>
              <Bell className='h-12 w-12 text-muted-foreground opacity-50 mb-3' />
              <p className='text-sm text-muted-foreground'>
                No tienes notificaciones
              </p>
            </div>
          ) : (
            <div className='divide-y'>
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors ${
                    !notification.isRead ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className='flex items-start space-x-3'>
                    <div
                      className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                        !notification.isRead
                          ? 'bg-blue-600'
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    />
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-start justify-between gap-2'>
                        <p
                          className={`text-sm font-medium ${
                            !notification.isRead
                              ? 'text-foreground'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {notification.title}
                        </p>
                        {!notification.isRead && (
                          <Button
                            variant='ghost'
                            size='icon'
                            className='h-6 w-6 flex-shrink-0'
                            onClick={(e) => {
                              e.stopPropagation()
                              markAsRead(notification.id)
                            }}
                          >
                            <Check className='h-3 w-3' />
                          </Button>
                        )}
                      </div>
                      <p className='text-xs text-muted-foreground mt-1 line-clamp-2'>
                        {notification.message}
                      </p>
                      <div className='flex items-center gap-2 mt-2'>
                        <span className='text-xs text-muted-foreground'>
                          {formatTimeAgo(notification.createdAt)}
                        </span>
                        {notification.tickets && (
                          <>
                            <span className='text-xs text-muted-foreground'>•</span>
                            <span className='text-xs text-muted-foreground'>
                              #{notification.tickets.id.slice(-8)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <>
            <Separator />
            <div className='p-2'>
              <Button
                variant='ghost'
                size='sm'
                className='w-full text-xs'
                onClick={() => {
                  setIsOpen(false)
                  router.push('/notifications')
                }}
              >
                Ver todas las notificaciones
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
