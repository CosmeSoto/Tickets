'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
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
import { cn } from '@/lib/utils'
import { useNotifications, type NotificationData } from '@/hooks/use-notifications'

interface NotificationsProps {
  className?: string
  variant?: 'bell' | 'dashboard' | 'full'
  maxVisible?: number
}

// Helpers de presentación
function getNotificationIcon(type: string) {
  switch (type) {
    case 'ERROR':
    case 'CRITICAL': return <AlertTriangle className="h-4 w-4 text-red-600" />
    case 'WARNING': return <Clock className="h-4 w-4 text-orange-600" />
    case 'SUCCESS': return <CheckCircle className="h-4 w-4 text-green-600" />
    default: return <Info className="h-4 w-4 text-blue-600" />
  }
}

function getNotificationColor(type: string) {
  switch (type) {
    case 'ERROR':
    case 'CRITICAL': return 'border-l-red-500 bg-red-50/50 hover:bg-red-100/70'
    case 'WARNING': return 'border-l-orange-500 bg-orange-50/50 hover:bg-orange-100/70'
    case 'SUCCESS': return 'border-l-green-500 bg-green-50/50 hover:bg-green-100/70'
    default: return 'border-l-blue-500 bg-blue-50/50 hover:bg-blue-100/70'
  }
}

function getNotificationBadge(type: string) {
  switch (type) {
    case 'ERROR':
    case 'CRITICAL': return <Badge variant="destructive" className="text-xs">Crítico</Badge>
    case 'WARNING': return <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800">Atención</Badge>
    case 'SUCCESS': return <Badge variant="default" className="text-xs bg-green-100 text-green-800">Éxito</Badge>
    default: return <Badge variant="outline" className="text-xs">Info</Badge>
  }
}

function formatTimeAgo(date: string | Date) {
  const now = new Date()
  const diff = now.getTime() - new Date(date).getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (minutes < 60) return `${minutes}min`
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export function Notifications({ 
  className, 
  variant = 'bell', 
  maxVisible = 5 
}: NotificationsProps) {
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const {
    notifications,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    navigateToTicket,
  } = useNotifications({ autoLoad: true, refreshInterval: 15 * 1000 })

  if (!session?.user) return null

  const unreadCount = notifications.filter(n => !n.isRead).length
  const visibleNotifications = expanded ? notifications : notifications.slice(0, maxVisible)
  const hasMoreNotifications = notifications.length > maxVisible

  const handleAction = (notification: NotificationData) => {
    if (!notification.isRead) markAsRead(notification.id)
    if (variant === 'bell') setIsOpen(false)
    if (notification.ticketId) navigateToTicket(notification)
  }

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    deleteNotification(id)
  }

  // ── BELL VARIANT ──────────────────────────────────────────────────────────
  if (variant === 'bell') {
    return (
      <div className="relative">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className={cn("relative p-2 hover:bg-muted", className)}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-red-500 text-white border-2 border-background">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>

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
                            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-7 w-7 p-0">
                              <CheckCheck className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Marcar todas como leídas</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} className="h-7 w-7 p-0">
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loading && notifications.length === 0 ? (
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
                    {visibleNotifications.map((n) => (
                      <BellNotificationItem
                        key={n.id}
                        notification={n}
                        onAction={handleAction}
                        onMarkRead={markAsRead}
                        onDismiss={handleDismiss}
                      />
                    ))}
                  </div>
                )}
                {/* Footer: enlace a página completa */}
                <div className="border-t border-border p-2">
                  <Link
                    href={`/${session.user.role?.toLowerCase()}/notifications`}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center justify-center w-full px-3 py-2 text-xs font-medium text-primary hover:bg-primary/5 rounded-md transition-colors"
                  >
                    Ver todas las notificaciones
                    <ExternalLink className="h-3 w-3 ml-1.5" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    )
  }

  // ── DASHBOARD VARIANT ─────────────────────────────────────────────────────
  if (variant === 'dashboard') {
    if (notifications.length === 0) return null

    return (
      <div className={cn("space-y-3", className)}>
        {visibleNotifications.map((n) => (
          <Alert
            key={n.id}
            className={cn(
              "border-l-4 cursor-pointer transition-all duration-200 hover:shadow-md",
              getNotificationColor(n.type)
            )}
            onClick={() => handleAction(n)}
          >
            <div className="flex items-start justify-between w-full">
              <div className="flex items-start space-x-3 flex-1 min-w-0">
                {getNotificationIcon(n.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <div className="font-semibold text-sm text-foreground truncate">{n.title}</div>
                    {getNotificationBadge(n.type)}
                    <div className="text-xs text-muted-foreground">{formatTimeAgo(n.createdAt)}</div>
                  </div>
                  <AlertDescription className="text-sm text-muted-foreground mb-2 leading-relaxed">
                    {n.message}
                  </AlertDescription>
                  {n.ticketId && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs font-medium"
                      onClick={(e) => { e.stopPropagation(); handleAction(n) }}
                    >
                      Ver ticket
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => handleDismiss(n.id, e)}
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
                <><ChevronUp className="h-3 w-3 mr-1" />Mostrar menos</>
              ) : (
                <><ChevronDown className="h-3 w-3 mr-1" />Ver {notifications.length - maxVisible} más</>
              )}
            </Button>
          </div>
        )}
      </div>
    )
  }

  return null
}

// Item individual para la campanita
function BellNotificationItem({
  notification: n,
  onAction,
  onMarkRead,
  onDismiss,
}: {
  notification: NotificationData
  onAction: (n: NotificationData) => void
  onMarkRead: (id: string) => void
  onDismiss: (id: string, e: React.MouseEvent) => void
}) {
  const isClickable = !!n.ticketId

  return (
    <div
      className={cn(
        "p-3 border-b border-gray-100 transition-colors border-l-4",
        getNotificationColor(n.type),
        !n.isRead && "bg-primary/5",
        isClickable && "hover:bg-muted/70 cursor-pointer"
      )}
      onClick={isClickable ? () => onAction(n) : undefined}
    >
      <div className="flex items-start justify-between space-x-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            {getNotificationIcon(n.type)}
            <div className="text-sm font-medium text-foreground truncate">{n.title}</div>
            {getNotificationBadge(n.type)}
            {isClickable && <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
            {!n.isRead && <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />}
          </div>
          <div className="text-xs text-muted-foreground mb-2 leading-relaxed line-clamp-2">
            {n.message}
          </div>
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground font-medium">{formatTimeAgo(n.createdAt)}</div>
            <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
              {!n.isRead && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={() => onMarkRead(n.id)} className="h-6 w-6 p-0 text-muted-foreground hover:text-primary">
                        <Check className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Marcar como leída</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={(e) => onDismiss(n.id, e)} className="h-6 w-6 p-0 text-muted-foreground hover:text-red-600">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Eliminar notificación</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
