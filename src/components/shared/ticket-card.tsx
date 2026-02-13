/**
 * Componente de tarjeta de ticket reutilizable
 * Usado en dashboards de ADMIN, TECHNICIAN y CLIENT
 */

'use client'

import { Clock, User, MessageSquare, Paperclip, Calendar } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusBadge, PriorityBadge } from '@/components/ui/status-badge'

interface TicketCardProps {
  ticket: {
    id: string
    title: string
    description?: string
    status: string
    priority: string
    createdAt: string
    updatedAt: string
    client?: {
      name: string
      email: string
    }
    assignee?: {
      name: string
      email: string
    } | null
    category: {
      name: string
      color: string
    }
    _count?: {
      comments: number
      attachments: number
    }
  }
  onView?: (ticket: any) => void
  onEdit?: (ticket: any) => void
  onDelete?: (ticket: any) => void
  showActions?: boolean
  role?: 'ADMIN' | 'TECHNICIAN' | 'CLIENT'
}

export function TicketCard({
  ticket,
  onView,
  onEdit,
  onDelete,
  showActions = true,
  role = 'ADMIN',
}: TicketCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `Hace ${diffMins} min`
    if (diffHours < 24) return `Hace ${diffHours}h`
    if (diffDays < 7) return `Hace ${diffDays}d`
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
  }

  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => onView?.(ticket)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base text-foreground truncate mb-1">
              {ticket.title}
            </h3>
            <p className="text-xs text-muted-foreground">#{ticket.id.slice(-8)}</p>
          </div>
          <div className="flex items-center space-x-2 ml-2">
            <StatusBadge status={ticket.status as any} size="sm" />
            <PriorityBadge priority={ticket.priority as any} size="sm" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        {ticket.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {ticket.description}
          </p>
        )}

        <div className="space-y-2">
          {/* Categoría */}
          <div className="flex items-center space-x-2">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: ticket.category.color }}
            />
            <span className="text-sm text-foreground truncate">{ticket.category.name}</span>
          </div>

          {/* Cliente (solo para ADMIN y TECHNICIAN) */}
          {(role === 'ADMIN' || role === 'TECHNICIAN') && ticket.client && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <User className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{ticket.client.name}</span>
            </div>
          )}

          {/* Técnico asignado */}
          {ticket.assignee ? (
            <div className="flex items-center space-x-2 text-sm text-blue-600">
              <User className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{ticket.assignee.name}</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <User className="h-4 w-4 flex-shrink-0" />
              <span>Sin asignar</span>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-3 border-t">
        <div className="flex items-center justify-between w-full">
          {/* Metadata */}
          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
            <div className="flex items-center space-x-1">
              <Calendar className="h-3 w-3" />
              <span>{formatDate(ticket.createdAt)}</span>
            </div>
            {ticket._count && ticket._count.comments > 0 && (
              <div className="flex items-center space-x-1">
                <MessageSquare className="h-3 w-3" />
                <span>{ticket._count.comments}</span>
              </div>
            )}
            {ticket._count && ticket._count.attachments > 0 && (
              <div className="flex items-center space-x-1">
                <Paperclip className="h-3 w-3" />
                <span>{ticket._count.attachments}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          {showActions && (
            <div className="flex items-center space-x-1">
              {onView && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onView(ticket)
                  }}
                  className="h-7 px-2 text-xs"
                >
                  Ver
                </Button>
              )}
              {onEdit && role === 'ADMIN' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit(ticket)
                  }}
                  className="h-7 px-2 text-xs"
                >
                  Editar
                </Button>
              )}
            </div>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}
