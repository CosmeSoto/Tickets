'use client'

import { Card, CardContent } from './card'
import { Badge } from './badge'
import { StatusBadge, PriorityBadge } from './status-badge'
import { 
  Ticket, 
  User, 
  Clock, 
  Calendar, 
  MessageSquare, 
  Paperclip, 
  Eye,
  Edit,
  Trash2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  PlayCircle,
  PauseCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface TicketStatsCardProps {
  ticket: {
    id: string
    title: string
    description?: string
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
    status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'ON_HOLD'
    client: { 
      id: string
      name: string
      email: string 
    }
    assignee?: { 
      id: string
      name: string
      email: string 
    }
    category: { 
      id: string
      name: string
      color: string
      level?: number
    }
    createdAt: string
    updatedAt: string
    _count?: { 
      comments: number
      attachments: number
    }
  }
  onView: (ticket: any) => void
  onEdit?: (ticket: any) => void
  onDelete?: (ticket: any) => void
  canEdit?: boolean
  canDelete?: boolean
  showDetailedStats?: boolean
  className?: string
}

const statusIcons = {
  OPEN: PlayCircle,
  IN_PROGRESS: Clock,
  RESOLVED: CheckCircle,
  CLOSED: XCircle,
  ON_HOLD: PauseCircle,
}

const statusBorderColors = {
  OPEN: 'border-l-blue-500 hover:border-l-blue-600',
  IN_PROGRESS: 'border-l-purple-500 hover:border-l-purple-600',
  RESOLVED: 'border-l-green-500 hover:border-l-green-600',
  CLOSED: 'border-l-gray-500 hover:border-l-gray-600',
  ON_HOLD: 'border-l-orange-500 hover:border-l-orange-600',
}

export function TicketStatsCard({
  ticket,
  onView,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
  showDetailedStats = true,
  className
}: TicketStatsCardProps) {
  
  const StatusIcon = statusIcons[ticket.status]
  
  // Calcular tiempo transcurrido
  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d`
    if (hours > 0) return `${hours}h`
    if (minutes > 0) return `${minutes}min`
    return 'Ahora'
  }

  // Formatear fecha completa
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Obtener nivel de urgencia
  const getUrgencyLevel = () => {
    const createdDate = new Date(ticket.createdAt)
    const now = new Date()
    const daysDiff = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))
    
    if (ticket.priority === 'URGENT' && daysDiff > 1) return {
      level: 'Crítico',
      color: 'text-red-600',
      bgColor: 'bg-red-100'
    }
    if (ticket.priority === 'HIGH' && daysDiff > 3) return {
      level: 'Atención',
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
    }
    if (daysDiff > 7 && ticket.status === 'OPEN') return {
      level: 'Rezagado',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100'
    }
    return {
      level: 'Normal',
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    }
  }

  const urgency = getUrgencyLevel()

  return (
    <Card className={cn(
      "group hover:shadow-md transition-all duration-200 border-l-4 cursor-pointer relative h-[180px]",
      statusBorderColors[ticket.status],
      className
    )}
    onClick={() => onView(ticket)}
    >
      <CardContent className="p-3 h-full flex flex-col">
        {/* Header con icono de estado y ID */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-full flex items-center justify-center border bg-muted border-border flex-shrink-0">
              <StatusIcon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate text-sm leading-tight">
                {ticket.title}
              </h3>
              <div className="flex items-center space-x-1 mt-0.5">
                <Badge variant="outline" className="text-xs h-4 px-1">
                  #{ticket.id.slice(-6)}
                </Badge>
                <Badge className={cn("text-xs h-4 px-1", urgency.bgColor, urgency.color)}>
                  {urgency.level}
                </Badge>
              </div>
            </div>
          </div>
          
          {/* Estado y prioridad */}
          <div className="flex flex-col items-end space-y-0.5 flex-shrink-0 ml-2">
            <StatusBadge status={ticket.status} size="sm" />
            <PriorityBadge priority={ticket.priority} size="sm" />
          </div>
        </div>

        {/* Descripción */}
        {ticket.description && (
          <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
            {ticket.description}
          </p>
        )}

        {/* Información de cliente y técnico */}
        <div className="space-y-1 mb-2 flex-1">
          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
            <User className="h-3 w-3 flex-shrink-0" />
            <span className="font-medium truncate">{ticket.client.name}</span>
          </div>
          
          {ticket.assignee ? (
            <div className="flex items-center space-x-1 text-xs text-blue-600">
              <User className="h-3 w-3 flex-shrink-0" />
              <span className="font-medium truncate">{ticket.assignee.name}</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              <User className="h-3 w-3 flex-shrink-0" />
              <span className="italic">Sin asignar</span>
            </div>
          )}
        </div>

        {/* Categoría */}
        <div className="mb-2">
          <div className="flex items-center space-x-1 text-xs">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: ticket.category.color }}
            />
            <span className="font-medium text-foreground truncate">{ticket.category.name}</span>
          </div>
        </div>

        {/* Estadísticas en una fila */}
        <div className="grid grid-cols-3 gap-1 mb-2">
          <div className="bg-blue-50 rounded p-1 text-center">
            <div className="text-xs font-bold text-blue-700">
              {ticket._count?.comments || 0}
            </div>
            <div className="text-xs text-blue-600">Msgs</div>
          </div>
          
          <div className="bg-purple-50 rounded p-1 text-center">
            <div className="text-xs font-bold text-purple-700">
              {ticket._count?.attachments || 0}
            </div>
            <div className="text-xs text-purple-600">Files</div>
          </div>
          
          <div className="bg-orange-50 rounded p-1 text-center">
            <div className="text-xs font-bold text-orange-700">
              {getTimeAgo(ticket.updatedAt)}
            </div>
            <div className="text-xs text-orange-600">Act.</div>
          </div>
        </div>

        {/* Información temporal */}
        <div className="text-xs text-muted-foreground mb-2">
          <div className="flex items-center justify-between">
            <span>Creado: {formatDate(ticket.createdAt)}</span>
            <span>Act: {getTimeAgo(ticket.updatedAt)}</span>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-100 mt-auto">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onView(ticket)
            }}
            className="px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded text-xs font-medium transition-colors flex items-center space-x-1"
          >
            <Eye className="h-3 w-3" />
            <span>Ver</span>
          </button>
          
          <div className="flex items-center space-x-1">
            {canEdit && onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(ticket)
                }}
                className="px-2 py-1 bg-muted text-foreground hover:bg-gray-200 rounded text-xs font-medium transition-colors"
              >
                <Edit className="h-3 w-3" />
              </button>
            )}
            
            {canDelete && onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(ticket)
                }}
                className="px-2 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded text-xs font-medium transition-colors"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}