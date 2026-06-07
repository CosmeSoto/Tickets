'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2, Clock, ExternalLink } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface IncidentCardProps {
  incident: {
    id: string
    description: string
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    status: 'OPEN' | 'RESOLVED' | 'ESCALATED'
    createdAt: string
    checkpoint: { name: string; location: string }
    patrol: { route: { name: string }; scheduledStart: string }
    photos: { id: string; path: string }[]
    ticket?: { id: string; ticketCode: string; status: string } | null
    isEditable?: boolean
  }
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  editWindowRemaining?: number
}

const SEVERITY_BORDER: Record<string, string> = {
  LOW: 'border-l-green-500',
  MEDIUM: 'border-l-yellow-500',
  HIGH: 'border-l-orange-500',
  CRITICAL: 'border-l-red-500',
}

const SEVERITY_BADGE: Record<string, string> = {
  LOW: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

const SEVERITY_LABELS: Record<string, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
}

const STATUS_BADGE: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  RESOLVED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  ESCALATED: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Abierta',
  RESOLVED: 'Resuelta',
  ESCALATED: 'Escalada',
}

const formatRemainingTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

export function IncidentCard({ incident, onEdit, onDelete, editWindowRemaining }: IncidentCardProps) {
  const timeAgo = formatDistanceToNow(new Date(incident.createdAt), { addSuffix: true, locale: es })

  return (
    <div
      className={`rounded-lg p-4 border bg-card hover:shadow-sm transition-all border-l-4 ${SEVERITY_BORDER[incident.severity]}`}
    >
      <div className='flex items-start justify-between gap-3'>
        <div className='flex-1 min-w-0'>
          {/* Badges */}
          <div className='flex items-center gap-2 flex-wrap mb-2'>
            <Badge className={`text-[10px] px-1.5 py-0 ${SEVERITY_BADGE[incident.severity]}`}>
              {SEVERITY_LABELS[incident.severity]}
            </Badge>
            <Badge className={`text-[10px] px-1.5 py-0 ${STATUS_BADGE[incident.status]}`}>
              {STATUS_LABELS[incident.status]}
            </Badge>
            {incident.isEditable && editWindowRemaining && editWindowRemaining > 0 && (
              <span className='inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full'>
                <Clock className='h-3 w-3' />
                ⏱ {formatRemainingTime(editWindowRemaining)} restantes
              </span>
            )}
          </div>

          {/* Description */}
          <p className='text-sm font-medium line-clamp-2 mb-2'>{incident.description}</p>

          {/* Context */}
          <div className='flex items-center gap-3 text-xs text-muted-foreground flex-wrap'>
            <span>{incident.checkpoint.name}</span>
            <span>•</span>
            <span>{incident.patrol.route.name}</span>
            <span>•</span>
            <span>{timeAgo}</span>
          </div>

          {/* Ticket link */}
          {incident.status === 'ESCALATED' && incident.ticket && (
            <a
              href={`/admin/tickets/${incident.ticket.id}`}
              className='inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2'
            >
              <ExternalLink className='h-3 w-3' />
              Ver ticket #{incident.ticket.ticketCode}
            </a>
          )}
        </div>

        {/* Photo thumbnail */}
        {incident.photos.length > 0 && (
          <div className='flex-shrink-0'>
            <img
              src={`/uploads/${incident.photos[0].path}`}
              alt='Foto de novedad'
              className='w-14 h-14 rounded-md object-cover border'
            />
          </div>
        )}
      </div>

      {/* Edit/Delete actions */}
      {incident.isEditable && (
        <div className='flex items-center gap-1 mt-3 pt-3 border-t'>
          {onEdit && (
            <Button variant='ghost' size='sm' onClick={() => onEdit(incident.id)}>
              <Pencil className='h-3.5 w-3.5 mr-1' />
              Editar
            </Button>
          )}
          {onDelete && (
            <Button
              variant='ghost'
              size='sm'
              className='text-destructive hover:text-destructive'
              onClick={() => onDelete(incident.id)}
            >
              <Trash2 className='h-3.5 w-3.5 mr-1' />
              Eliminar
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
