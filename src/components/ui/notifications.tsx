'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  Bell, 
  X, 
  Check, 
  CheckCheck, 
  Trash2, 
  Info, 
  CheckCircle, 
  AlertTriangle, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Clock
} from 'lucide-react'
import { Badge } from './badge'
import { Button } from './button'
import { Card, CardContent, CardHeader, CardTitle } from './card'
import { Alert, AlertDescription } from './alert'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { Notification } from '@/lib/services/notification-service'

interface NotificationsProps {
  className?: string
  variant?: 'bell' | 'dashboard' | 'full'
  maxVisible?: number
}

export function Notifications({ 
  className, 
  variant = 'bell', 
  maxVisible = 5 
}: NotificationsProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [dismissedNotifications, setDismissedNotifications] = useState<string[]>([])

  // Cargar notificaciones
  const loadNotifications = async () => {
    if (!session?.user?.id) return

    setLoading(true)
    try {
      // Obtener estado de localStorage para notificaciones dinámicas
      const dynamicState = getDynamicNotificationState()
      
      const response = await fetch('/api/notifications', {
        headers: {
          'x-dynamic-notifications-state': JSON.stringify(dynamicState)
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        const activeNotifications = data.notifications.filter((notification: Notification) => 
          !dismissedNotifications.includes(notification.id)
        )
        setNotifications(activeNotifications)
      }
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  // Manejar acción de notificación
  const handleNotificationAction = (notification: Notification) => {
    if (notification.actionUrl) {
      // Marcar como leída si no lo está
      if (!notification.isRead) {
        markAsRead(notification.id)
      }
      
      // Cerrar panel si es campanita
      if (variant === 'bell') {
        setIsOpen(false)
      }
      
      // Redirigir
      router.push(notification.actionUrl)
      
      toast({
        title: 'Redirigiendo...',
        description: `${notification.actionText}: ${notification.title}`,
        duration: 3000,
      })
    }
  }

  // Marcar como leída
  const markAsRead = async (notificationId: string) => {
    try {
      if (isDynamicNotification(notificationId)) {
        markDynamicAsRead(notificationId)
        setNotifications(prev => 
          prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
        )
      } else {
        const response = await fetch(`/api/notifications/${notificationId}/read`, {
          method: 'POST'
        })
        
        if (response.ok) {
          setNotifications(prev => 
            prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
          )
        }
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  // Eliminar notificación
  const dismissNotification = (notificationId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    
    if (isDynamicNotification(notificationId)) {
      markDynamicAsDismissed(notificationId)
    }
    
    setDismissedNotifications(prev => [...prev, notificationId])
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
    
    const notification = notifications.find(n => n.id === notificationId)
    toast({
      title: 'Notificación eliminada',
      description: notification ? `"${notification.title}" ha sido eliminada` : 'La notificación ha sido eliminada',
      duration: 3000,
    })
  }

  // Marcar todas como leídas
  const markAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.isRead)
      
      // Separar dinámicas y persistentes
      const dynamicUnread = unreadNotifications.filter(n => isDynamicNotification(n.id))
      const persistentUnread = unreadNotifications.filter(n => !isDynamicNotification(n.id))
      
      // Marcar persistentes via API
      if (persistentUnread.length > 0) {
        await fetch('/api/notifications/read-all', { method: 'POST' })
      }
      
      // Marcar dinámicas en localStorage
      if (dynamicUnread.length > 0) {
        markAllDynamicAsRead(dynamicUnread.map(n => n.id))
      }
      
      // Actualizar estado local
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      
      toast({
        title: 'Notificaciones marcadas como leídas',
        description: `${unreadNotifications.length} notificación${unreadNotifications.length !== 1 ? 'es' : ''} marcada${unreadNotifications.length !== 1 ? 's' : ''} como leída${unreadNotifications.length !== 1 ? 's' : ''}`,
        duration: 4000,
      })
    } catch (error) {
      console.error('Error marking all as read:', error)
      toast({
        title: 'Error al marcar notificaciones',
        description: 'No se pudieron marcar todas las notificaciones como leídas',
        variant: 'destructive',
        duration: 4000,
      })
    }
  }

  // Obtener icono según tipo
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'CRITICAL': return <AlertTriangle className="h-4 w-4 text-red-600" />
      case 'WARNING': return <Clock className="h-4 w-4 text-orange-600" />
      case 'SUCCESS': return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'INFO': return <Info className="h-4 w-4 text-blue-600" />
      default: return <Bell className="h-4 w-4 text-gray-600" />
    }
  }

  // Obtener color según tipo
  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'CRITICAL': return 'border-l-red-500 bg-red-50/50 hover:bg-red-100/70'
      case 'WARNING': return 'border-l-orange-500 bg-orange-50/50 hover:bg-orange-100/70'
      case 'SUCCESS': return 'border-l-green-500 bg-green-50/50 hover:bg-green-100/70'
      case 'INFO': return 'border-l-blue-500 bg-blue-50/50 hover:bg-blue-100/70'
      default: return 'border-l-gray-500 bg-gray-50/50 hover:bg-gray-100/70'
    }
  }

  // Obtener badge según tipo
  const getNotificationBadge = (type: string) => {
    switch (type) {
      case 'CRITICAL': return <Badge variant="destructive" className="text-xs">Crítico</Badge>
      case 'WARNING': return <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800">Atención</Badge>
      case 'SUCCESS': return <Badge variant="default" className="text-xs bg-green-100 text-green-800">Éxito</Badge>
      case 'INFO': return <Badge variant="outline" className="text-xs">Info</Badge>
      default: return <Badge variant="outline" className="text-xs">Normal</Badge>
    }
  }

  // Formatear tiempo relativo
  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - new Date(date).getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    
    if (minutes < 60) return `${minutes}min`
    if (hours < 24) return `${hours}h`
    return `${Math.floor(hours / 24)}d`
  }

  // Cargar notificaciones al montar
  useEffect(() => {
    if (session?.user?.id) {
      loadNotifications()
      const interval = setInterval(loadNotifications, 2 * 60 * 1000) // Cada 2 minutos
      return () => clearInterval(interval)
    }
    return undefined
  }, [session?.user?.id, dismissedNotifications])

  if (!session?.user) return null

  const unreadCount = notifications.filter(n => !n.isRead).length
  const visibleNotifications = expanded ? notifications : notifications.slice(0, maxVisible)
  const hasMoreNotifications = notifications.length > maxVisible

  // Renderizado para campanita (bell)
  if (variant === 'bell') {
    return (
      <div className="relative">
        {/* Botón de campana */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className={cn("relative p-2 hover:bg-muted", className)}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-red-500 text-white border-2 border-background"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>

        {/* Panel de notificaciones */}
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            
            <Card className="absolute right-0 top-full mt-2 w-80 max-h-96 z-50 shadow-xl border-2">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">
                    Notificaciones
                    {unreadCount > 0 && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {unreadCount} nuevas
                      </Badge>
                    )}
                  </CardTitle>
                  <div className="flex items-center space-x-1">
                    {unreadCount > 0 && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={markAllAsRead}
                              className="h-7 w-7 p-0"
                            >
                              <CheckCheck className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Marcar todas como leídas</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsOpen(false)}
                            className="h-7 w-7 p-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Cerrar panel de notificaciones</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    <div className="animate-pulse">Cargando...</div>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    <Bell className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <div>No hay notificaciones</div>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto">
                    {visibleNotifications.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onAction={handleNotificationAction}
                        onMarkRead={markAsRead}
                        onDismiss={dismissNotification}
                        formatTimeAgo={formatTimeAgo}
                        getIcon={getNotificationIcon}
                        getColor={getNotificationColor}
                        getBadge={getNotificationBadge}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    )
  }

  // Renderizado para dashboard
  if (variant === 'dashboard') {
    if (notifications.length === 0) return null

    return (
      <div className={cn("space-y-3", className)}>
        {visibleNotifications.map((notification) => (
          <Alert
            key={notification.id}
            className={cn(
              "border-l-4 cursor-pointer transition-all duration-200 hover:shadow-md",
              getNotificationColor(notification.type)
            )}
            onClick={() => handleNotificationAction(notification)}
          >
            <div className="flex items-start justify-between w-full">
              <div className="flex items-start space-x-3 flex-1 min-w-0">
                {getNotificationIcon(notification.type)}
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <div className="font-semibold text-sm text-foreground truncate">
                      {notification.title}
                    </div>
                    {getNotificationBadge(notification.type)}
                    <div className="text-xs text-muted-foreground">
                      {formatTimeAgo(notification.createdAt)}
                    </div>
                  </div>
                  
                  <AlertDescription className="text-sm text-muted-foreground mb-2 leading-relaxed">
                    {notification.message}
                  </AlertDescription>
                  
                  {notification.actionText && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs font-medium"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleNotificationAction(notification)
                      }}
                    >
                      {notification.actionText}
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => dismissNotification(notification.id, e)}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground ml-2 flex-shrink-0"
                title="Descartar"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </Alert>
        ))}

        {hasMoreNotifications && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3 w-3 mr-1" />
                  Mostrar menos
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3 mr-1" />
                  Ver {notifications.length - maxVisible} más
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    )
  }

  return null
}

// Componente para item individual de notificación
function NotificationItem({
  notification,
  onAction,
  onMarkRead,
  onDismiss,
  formatTimeAgo,
  getIcon,
  getColor,
  getBadge
}: {
  notification: Notification
  onAction: (notification: Notification) => void
  onMarkRead: (id: string) => void
  onDismiss: (id: string, event: React.MouseEvent) => void
  formatTimeAgo: (date: Date) => string
  getIcon: (type: string) => React.ReactNode
  getColor: (type: string) => string
  getBadge: (type: string) => React.ReactNode
}) {
  const isClickable = notification.actionUrl !== undefined

  return (
    <div
      className={cn(
        "p-3 border-b border-gray-100 transition-colors border-l-4",
        getColor(notification.type),
        !notification.isRead && "bg-primary/5",
        isClickable && "hover:bg-muted/70 cursor-pointer"
      )}
      onClick={isClickable ? () => onAction(notification) : undefined}
    >
      <div className="flex items-start justify-between space-x-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            {getIcon(notification.type)}
            <div className="text-sm font-medium text-foreground truncate">
              {notification.title}
            </div>
            {getBadge(notification.type)}
            {isClickable && (
              <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            )}
            {!notification.isRead && (
              <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
            )}
          </div>
          
          <div className="text-xs text-muted-foreground mb-2 leading-relaxed line-clamp-2">
            {notification.message}
          </div>
          
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground font-medium">
              {formatTimeAgo(notification.createdAt)}
            </div>
            
            <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
              {!notification.isRead && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onMarkRead(notification.id)}
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Marcar como leída</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => onDismiss(notification.id, e)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Eliminar notificación</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Funciones de utilidad para localStorage
const isDynamicNotification = (notificationId: string): boolean => {
  const dynamicPrefixes = [
    'activity-spike-',
    'critical-unassigned-',
    'sla-warning-',
    'urgent-assigned-',
    'overdue-sla-',
    'no-response-',
    'rating-pending-',
    'ticket-update-',
    'stale-ticket-',
    // Nuevos prefijos
    'overloaded-tech-',
    'weekly-summary-',
    'newly-assigned-',
    'client-response-',
    'new-rating-',
    'ticket-assigned-',
    'status-change-',
    'resolved-confirm-'
  ]
  
  return dynamicPrefixes.some(prefix => notificationId.includes(prefix))
}

const getDynamicNotificationState = () => {
  if (typeof window === 'undefined') return { read: [], dismissed: [] }
  
  try {
    const stored = localStorage.getItem('dynamic-notifications-state')
    return stored ? JSON.parse(stored) : { read: [], dismissed: [] }
  } catch (error) {
    console.error('Error loading notification state:', error)
    return { read: [], dismissed: [] }
  }
}

const saveDynamicNotificationState = (state: { read: string[], dismissed: string[] }) => {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem('dynamic-notifications-state', JSON.stringify(state))
  } catch (error) {
    console.error('Error saving notification state:', error)
  }
}

const markDynamicAsRead = (notificationId: string) => {
  const state = getDynamicNotificationState()
  if (!state.read.includes(notificationId)) {
    state.read.push(notificationId)
    saveDynamicNotificationState(state)
  }
}

const markDynamicAsDismissed = (notificationId: string) => {
  const state = getDynamicNotificationState()
  if (!state.dismissed.includes(notificationId)) {
    state.dismissed.push(notificationId)
    saveDynamicNotificationState(state)
  }
}

const markAllDynamicAsRead = (notificationIds: string[]) => {
  const state = getDynamicNotificationState()
  const newReadIds = notificationIds.filter(id => !state.read.includes(id))
  if (newReadIds.length > 0) {
    state.read.push(...newReadIds)
    saveDynamicNotificationState(state)
  }
}