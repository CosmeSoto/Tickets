'use client'

import { User, Tag, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TicketCollaborators } from '@/components/tickets/ticket-collaborators'
import { formatDate, type Ticket } from '@/hooks/use-ticket-data'

interface SidebarDetailsCardProps {
  ticket: Ticket
  isEditing: boolean
  editForm: {
    assigneeId: string
  }
  filteredResolvers: any[]
  onEditFormChange: (field: 'assigneeId', value: string) => void
}

export function SidebarDetailsCard({
  ticket,
  isEditing,
  editForm,
  filteredResolvers,
  onEditFormChange,
}: SidebarDetailsCardProps) {
  return (
    <Card>
      <CardHeader className='pb-2'>
        <CardTitle className='text-sm font-semibold'>Detalles</CardTitle>
      </CardHeader>
      <CardContent className='space-y-3 pt-0 text-sm'>
        <div className='flex items-start gap-2'>
          <User className='h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0' />
          <div className='min-w-0'>
            <p className='text-xs text-muted-foreground'>Cliente</p>
            <p className='font-medium'>{ticket.client.name}</p>
            <p className='text-xs text-muted-foreground'>{ticket.client.email}</p>
            {ticket.client.department && (
              <Badge
                variant='outline'
                className='text-xs mt-1'
                style={{
                  borderColor: (ticket.client.department as any)?.color || '#6B7280',
                  color: (ticket.client.department as any)?.color || '#6B7280',
                }}
              >
                {typeof ticket.client.department === 'string'
                  ? ticket.client.department
                  : (ticket.client.department as any)?.name}
              </Badge>
            )}
          </div>
        </div>
        <Separator />
        <div className='flex items-start gap-2'>
          <User className='h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0' />
          <div className='flex-1 min-w-0'>
            <p className='text-xs text-muted-foreground'>Asignado a</p>
            {isEditing ? (
              <Select
                value={editForm.assigneeId || 'unassigned'}
                onValueChange={v => onEditFormChange('assigneeId', v === 'unassigned' ? '' : v)}
              >
                <SelectTrigger className='mt-1 h-8 text-xs'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='unassigned'>Sin asignar</SelectItem>
                  {filteredResolvers
                    .filter(r => r.id !== ticket.client?.id)
                    .map(r => (
                      <SelectItem key={r.id} value={r.id}>
                        <div className='flex flex-col leading-tight'>
                          <div className='flex items-center gap-1.5'>
                            <span>{r.name}</span>
                            {r.role === 'ADMIN' && (
                              <span className='text-xs text-muted-foreground'>(Admin)</span>
                            )}
                          </div>
                          {r.email && (
                            <span className='text-xs text-muted-foreground'>{r.email}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            ) : (
              <>
                <p>
                  {ticket.assignee?.name ?? (
                    <span className='text-muted-foreground'>Sin asignar</span>
                  )}
                </p>
                {ticket.assignee && (
                  <p className='text-xs text-muted-foreground'>{ticket.assignee.email}</p>
                )}
              </>
            )}
          </div>
        </div>
        <Separator />
        <div className='flex items-start gap-2'>
          <User className='h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0' />
          <TicketCollaborators
            ticketId={ticket.id}
            familyId={(ticket as any).familyId}
            assigneeId={ticket.assignee?.id}
            canManage
          />
        </div>
        <Separator />
        <div className='flex items-start gap-2'>
          <Tag className='h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0' />
          <div>
            <p className='text-xs text-muted-foreground'>Categoría</p>
            <div className='flex items-center gap-1.5 mt-0.5'>
              <div
                className='w-2.5 h-2.5 rounded-full shrink-0'
                style={{ backgroundColor: ticket.category.color }}
              />
              <span>{ticket.category.name}</span>
            </div>
          </div>
        </div>
        <Separator />
        <div className='flex items-start gap-2'>
          <Clock className='h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0' />
          <div>
            <p className='text-xs text-muted-foreground'>Fechas</p>
            <p className='text-xs'>Creado: {formatDate(ticket.createdAt)}</p>
            <p className='text-xs'>Actualizado: {formatDate(ticket.updatedAt)}</p>
            {ticket.resolvedAt && (
              <p className='text-xs text-emerald-600 dark:text-emerald-400'>
                Resuelto: {formatDate(ticket.resolvedAt)}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
