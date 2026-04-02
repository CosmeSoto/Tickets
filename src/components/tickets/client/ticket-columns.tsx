/**
 * Definición de columnas para la tabla de tickets del cliente
 * Adaptada para clientes que ven sus propios tickets
 * Patrón factory para permitir callbacks
 */

'use client'

import { Calendar, Clock, MessageSquare, Paperclip, User, Eye, Hash, Layers, PenLine } from 'lucide-react'
import { StatusBadge, PriorityBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Column } from '@/components/ui/data-table'
import type { Ticket as TicketType } from '@/hooks/use-ticket-data'
import { formatTimeAgo } from '@/hooks/use-ticket-data'

interface ClientTicketColumnsProps {
  onView: (ticket: TicketType) => void
}

export function createClientTicketColumns({
  onView
}: ClientTicketColumnsProps): Column<TicketType>[] {
  return [
    {
      key: 'title',
      label: 'Ticket',
      render: (ticket: TicketType) => (
        <div>
          <div className="font-medium text-foreground truncate max-w-[200px]">
            {ticket.title}
          </div>
          {/* ticketCode badge */}
          {(ticket as any).ticketCode ? (
            <div className="flex items-center space-x-1 mt-1">
              <Badge
                variant="outline"
                className="text-xs font-mono px-1.5 py-0 border-blue-300 text-blue-700 dark:text-blue-300"
              >
                <Hash className="h-3 w-3 mr-0.5" />
                {(ticket as any).ticketCode}
              </Badge>
              {(ticket as any).codeIsManual && (
                <Badge variant="secondary" className="text-xs px-1 py-0">
                  <PenLine className="h-3 w-3 mr-0.5" />
                  Manual
                </Badge>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">#{ticket.id.slice(-8)}</div>
          )}
        </div>
      ),
    },
    {
      key: 'family',
      label: 'Familia',
      render: (ticket: TicketType) => {
        const family = (ticket as any).families ?? (ticket as any).family
        if (!family) return <span className="text-muted-foreground text-xs">—</span>
        return (
          <div className="flex items-center space-x-1">
            {family.color && (
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: family.color }} />
            )}
            <span className="text-xs font-medium">{family.name}</span>
          </div>
        )
      },
    },
    {
      key: 'status',
      label: 'Estado',
      render: (ticket: TicketType) => <StatusBadge status={ticket.status} size="sm" />,
    },
    {
      key: 'priority',
      label: 'Prioridad',
      render: (ticket: TicketType) => <PriorityBadge priority={ticket.priority} size="sm" />,
    },
    {
      key: 'assignee',
      label: 'Técnico Asignado',
      render: (ticket: TicketType) => (
        ticket.assignee ? (
          <div className="flex items-center space-x-2">
            <User className="h-4 w-4 text-blue-400" />
            <div>
              <div className="font-medium text-sm text-blue-700">{ticket.assignee.name}</div>
              <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                {ticket.assignee.email}
              </div>
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">Sin asignar</span>
        )
      )
    },
    {
      key: 'category',
      label: 'Categoría',
      render: (ticket: TicketType) => (
        <div className="flex items-center space-x-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: ticket.category?.color || '#6B7280' }}
          />
          <span className="text-sm">{ticket.category?.name || 'Sin categoría'}</span>
        </div>
      )
    },
    {
      key: 'createdAt',
      label: 'Creado',
      render: (ticket: TicketType) => (
        <div className="flex items-center space-x-1 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>{formatTimeAgo(ticket.createdAt)}</span>
        </div>
      ),
    },
    {
      key: 'activity',
      label: 'Actividad',
      render: (ticket: TicketType) => (
        <div className="flex items-center space-x-3 text-sm text-muted-foreground">
          {ticket._count?.comments && ticket._count.comments > 0 && (
            <div className="flex items-center space-x-1">
              <MessageSquare className="h-4 w-4" />
              <span>{ticket._count.comments}</span>
            </div>
          )}
          {ticket._count?.attachments && ticket._count.attachments > 0 && (
            <div className="flex items-center space-x-1">
              <Paperclip className="h-4 w-4" />
              <span>{ticket._count.attachments}</span>
            </div>
          )}
          <div className="flex items-center space-x-1">
            <Clock className="h-4 w-4" />
            <span>{formatTimeAgo(ticket.updatedAt)}</span>
          </div>
        </div>
      )
    },
    {
      key: 'actions',
      label: 'Acciones',
      render: (ticket: TicketType) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            onView(ticket)
          }}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ]
}

// Mantener exportación legacy para compatibilidad temporal
export const clientTicketColumns = createClientTicketColumns({
  onView: () => {}
})
