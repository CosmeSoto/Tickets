'use client'

import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { 
  Bell, 
  BellOff, 
  Trash2, 
  Eye, 
  EyeOff, 
  ExternalLink,
  Ticket,
  User,
  MessageCircle,
  RefreshCw,
  AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { NotificationData } from '@/hooks/use-notifications'

interface NotificationListProps {
  notifications: NotificationData[]
  onMarkAsRead: (id: string) => void
  onDelete: (id: string) => void
  searchTerm: string
  loading?: boolean
}

const NOTIFICATION_CONFIG = {
  TICKET_CREATED: {
    icon: Ticket,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
    label: 'Ticket Creado',
    emoji: '🎫'
  },
  TICKET_ASSIGNED: {
    icon: User,
    color: 'text-green-600 bg-green-50 border-green-200',
    label: 'Ticket Asignado',
    emoji: '👤'
  },
  TICKET_STATUS_CHANGED: {
    icon: RefreshCw,
    color: 'text-orange-600 bg-orange-50 border-orange-200',
    label: 'Estado Cambiado',
    emoji: '🔄'
  },
  COMMENT_ADDED: {
    icon: MessageCircle,
    color: 'text-purple-600 bg-purple-50 border-purple-200',
    label: 'Nuevo Comentario',
    emoji: '💬'
  },
  TICKET_UPDATED: {
    icon: AlertCircle,
    color: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    label: 'Ticket Actualizado',
    emoji: '✏️'
  },
}

export function NotificationList({
  notifications,
  onMarkAsRead,
  onDelete,
  searchTerm,
  loading = false,
}: NotificationListProps) {

  const handleTicketClick = (ticketId: string) => {
    if (ticketId) {
      window.open(`/tickets/${ticketId}`, '_blank')
    }
  }

  const highlightText = (text: string, search: string) => {
    if (!search) return text
    
    const regex = new RegExp(`(${search})`, 'gi')
    const parts = text.split(regex)
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 px-1 rounded">
          {part}
        </mark>
      ) : part
    )
  }

  if (loading && notifications.length === 0) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (notifications.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Bell className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            No hay notificaciones
          </h3>
          <p className="text-muted-foreground text-center">
            {searchTerm
              ? 'No se encontraron notificaciones con ese criterio de búsqueda'
              : 'No tienes notificaciones en este momento'}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {notifications.map((notification) => {
        const config = NOTIFICATION_CONFIG[notification.type] || NOTIFICATION_CONFIG.TICKET_UPDATED
        const IconComponent = config.icon
        const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
          addSuffix: true,
          locale: es
        })

        return (
          <Card 
            key={notification.id} 
            className={`transition-all hover:shadow-md ${
              !notification.read 
                ? 'border-l-4 border-l-blue-500 bg-blue-50/30' 
                : 'hover:bg-muted'
            }`}
          >
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                {/* Icono de tipo */}
                <div className={`p-2 rounded-full ${config.color} flex-shrink-0`}>
                  <IconComponent className="h-4 w-4" />
                </div>

                {/* Contenido principal */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium text-foreground text-sm">
                        {highlightText(notification.title, searchTerm)}
                      </h4>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center space-x-1 ml-2">
                      <Badge variant="outline" className="text-xs">
                        {config.label}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {highlightText(notification.message, searchTerm)}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                      <span>{timeAgo}</span>
                      {notification.data.ticketId && (
                        <span className="flex items-center space-x-1">
                          <Ticket className="h-3 w-3" />
                          <span>#{notification.data.ticketId.slice(-6)}</span>
                        </span>
                      )}
                      {notification.data.priority && (
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            notification.data.priority === 'URGENT' ? 'border-red-300 text-red-700' :
                            notification.data.priority === 'HIGH' ? 'border-orange-300 text-orange-700' :
                            notification.data.priority === 'MEDIUM' ? 'border-yellow-300 text-yellow-700' :
                            'border-green-300 text-green-700'
                          }`}
                        >
                          {notification.data.priority}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center space-x-1">
                      {/* Botón para ver ticket */}
                      {notification.data.ticketId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTicketClick(notification.data.ticketId!)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-blue-600"
                          title="Ver ticket"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      )}

                      {/* Botón marcar como leída/no leída */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onMarkAsRead(notification.id)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-green-600"
                        title={notification.read ? 'Marcar como no leída' : 'Marcar como leída'}
                      >
                        {notification.read ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                      </Button>

                      {/* Botón eliminar */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(notification.id)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                        title="Eliminar notificación"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}