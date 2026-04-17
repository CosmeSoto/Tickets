'use client'

import { Calendar, Clock, MessageSquare, Paperclip, User, Eye } from 'lucide-react'
import { StatusBadge, PriorityBadge } from '@/components/ui/status-badge'
import { Button } from '@/components/ui/button'
import type { Column } from '@/components/ui/data-table'
import type { Ticket as TicketType } from '@/hooks/use-ticket-data'
import { formatTimeAgo, getTicketDisplayCode } from '@/hooks/use-ticket-data'

interface TechnicianTicketColumnsProps {
  onView: (ticket: TicketType) => void
}

export function createTechnicianTicketColumns({ onView }: TechnicianTicketColumnsProps): Column<TicketType>[] {
  return [
    {
      key: 'title',
      label: 'Ticket',
      render: (ticket: TicketType) => (
        <div className="min-w-0">
          <div className="font-medium text-foreground truncate max-w-[200px]">{ticket.title}</div>
          <div className="text-xs text-muted-foreground font-mono mt-0.5">#{getTicketDisplayCode(ticket)}</div>
        </div>
      ),
    },
    {
      key: 'family',
      label: 'Área',
      render: (ticket: TicketType) => {
        const family = ticket.family
        if (!family) return <span className="text-muted-foreground text-xs">—</span>
        return (
          <div className="flex items-start gap-1.5 max-w-[130px]">
            <div className="w-2.5 h-2.5 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: family.color || '#6B7280' }} />
            <span className="text-xs font-medium leading-tight">{family.name}</span>
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
      key: 'client',
      label: 'Cliente',
      render: (ticket: TicketType) => (
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{ticket.client?.name || '—'}</div>
            <div className="text-xs text-muted-foreground truncate max-w-[150px]">{ticket.client?.email || ''}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Categoría',
      render: (ticket: TicketType) => (
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ticket.category?.color || '#6B7280' }} />
          <span className="text-sm truncate max-w-[120px]">{ticket.category?.name || '—'}</span>
        </div>
      ),
    },
    {
      key: 'createdAt',
      label: 'Creado',
      render: (ticket: TicketType) => (
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>{formatTimeAgo(ticket.createdAt)}</span>
        </div>
      ),
    },
    {
      key: 'activity',
      label: 'Actividad',
      render: (ticket: TicketType) => (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {!!ticket._count?.comments && (
            <div className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /><span>{ticket._count.comments}</span></div>
          )}
          {!!ticket._count?.attachments && (
            <div className="flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" /><span>{ticket._count.attachments}</span></div>
          )}
          <div className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /><span>{formatTimeAgo(ticket.updatedAt)}</span></div>
        </div>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (ticket: TicketType) => (
        <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); onView(ticket) }}>
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ]
}

// Legacy export
export const technicianTicketColumns = createTechnicianTicketColumns({ onView: () => {} })
