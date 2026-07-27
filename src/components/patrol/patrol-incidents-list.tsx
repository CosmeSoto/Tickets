'use client'
import { DEFAULT_TIMEZONE } from '@/lib/constants'

/**
 * PatrolIncidentsList
 * Mini-lista de novedades reportadas durante una ronda.
 * Se muestra solo cuando hay al menos una novedad.
 */

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PatrolIncidentItem } from '@/hooks/use-patrol-execution'

const SEVERITY_COLORS: Record<string, string> = {
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

interface PatrolIncidentsListProps {
  incidents: PatrolIncidentItem[]
}

export function PatrolIncidentsList({ incidents }: PatrolIncidentsListProps) {
  if (incidents.length === 0) return null

  return (
    <Card>
      <CardHeader className='pb-2'>
        <CardTitle className='text-sm flex items-center gap-2'>
          📋 Novedades reportadas ({incidents.length})
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-2'>
        {incidents.map(incident => (
          <div
            key={incident.id}
            className='flex items-start justify-between gap-2 p-2 rounded-md border bg-muted/30'
          >
            <div className='flex-1 min-w-0'>
              <p className='text-sm truncate'>{incident.description}</p>
              <p className='text-xs text-muted-foreground mt-0.5'>
                {incident.checkpoint?.name ?? 'Checkpoint'} ·{' '}
                {new Date(incident.createdAt).toLocaleTimeString('es-EC', {
                  timeZone: DEFAULT_TIMEZONE,
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <Badge
              variant='secondary'
              className={`text-xs shrink-0 ${SEVERITY_COLORS[incident.severity] ?? ''}`}
            >
              {SEVERITY_LABELS[incident.severity] ?? incident.severity}
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
