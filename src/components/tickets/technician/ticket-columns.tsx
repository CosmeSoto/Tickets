/**
 * Definición de columnas para la tabla de tickets del técnico
 * Adaptada para técnicos que ven sus propios tickets asignados
 * Patrón factory para permitir callbacks
 */

'use client'

import { Calendar, Clock, MessageSquare, Paperclip, User, Eye } from 'lucide-react'
import { StatusBadge, PriorityBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import type { Column } from '@/components/ui/data-table'
import type { Ticket as TicketType } from '@/hooks/use-ticket-data'
import { formatTimeAgo } from '@/hooks/use-ticket-data'

interface TechnicianTicketColumnsProps {
  onView: (ticket: TicketType) => void
}

export function createTechnicianTicketColumns({
  onView
}: TechnicianTicketColumnsProps): Column<TicketType>[] {
  return [
    {
      key: 'title',
      label: 'Ticket',
      render: (ticket: TicketType) => (
        <div>
          <div className="font-medium text-foreground truncate max-w-[200px]">
            {ticket.title}
          </div>
          <div className="text-sm text-muted-foreground">#{ticket.id.slice(-8)}</div>
        </div>
      ),
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
      key: 'client',
      label: 'Cliente',
      render: (ticket: TicketType) => (
        <div className="flex items-center space-x-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="font-medium text-sm">{ticket.client?.name || 'Sin asignar'}</div>
            <div className="text-xs text-muted-foreground truncate max-w-[150px]">
              {ticket.client?.email || '-'}
            </div>
          </div>
        </div>
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
          onClick={() => onView(ticket)}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ]
}

// Mantener exportación legacy para compatibilidad temporal
export const technicianTicketColumns = createTechnicianTicketColumns({
  onView: () => {}
})
