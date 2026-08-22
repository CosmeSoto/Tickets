'use client'

import { useState } from 'react'
import {
  Clock,
  Package,
  Edit,
  UserPlus,
  RotateCcw,
  Wrench,
  AlertCircle,
  ArrowRightLeft,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import { formatTimeAgo, formatExactDateTime } from '@/lib/utils/date-utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { EquipmentHistoryEvent } from '@/types/inventory/equipment'
import { getEventIconColor } from '@/lib/utils/inventory-utils'

interface EquipmentHistoryProps {
  history: EquipmentHistoryEvent[]
}

const EVENT_ICONS: Record<string, any> = {
  CREATED: Package,
  UPDATED: Edit,
  ASSIGNED: UserPlus,
  RETURNED: RotateCcw,
  MAINTENANCE: Wrench,
  STATUS_CHANGE: AlertCircle,
  CONDITION_CHANGE: AlertCircle,
  FAMILY_TRANSFER: ArrowRightLeft,
}

const INITIAL_VISIBLE = 6

/** Etiqueta de día para separadores (ej. "martes, 19 de agosto de 2026") */
function dayLabel(date: Date | string): string {
  return new Date(date).toLocaleDateString('es-EC', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export function EquipmentHistory({ history }: EquipmentHistoryProps) {
  const [showAll, setShowAll] = useState(false)

  if (!history || history.length === 0) {
    return <div className='text-center py-8 text-muted-foreground'>No hay eventos registrados</div>
  }

  const hiddenCount = history.length > INITIAL_VISIBLE ? history.length - INITIAL_VISIBLE : 0
  const displayed = showAll || hiddenCount === 0 ? history : history.slice(0, INITIAL_VISIBLE)

  return (
    <TooltipProvider delayDuration={300}>
      <div className='space-y-0'>
        {/* Botón "Ver más" — arriba porque el listado es newest-first */}
        {hiddenCount > 0 && !showAll && (
          <button
            type='button'
            onClick={() => setShowAll(true)}
            className='w-full flex items-center justify-center gap-1.5 py-2 mb-2 text-xs text-muted-foreground hover:text-foreground transition-colors group'
          >
            <ChevronUp className='h-3.5 w-3.5 group-hover:text-primary transition-colors' />
            <span>
              Ver {hiddenCount} evento{hiddenCount > 1 ? 's' : ''} anterior
              {hiddenCount > 1 ? 'es' : ''}
            </span>
            <ChevronUp className='h-3.5 w-3.5 group-hover:text-primary transition-colors' />
          </button>
        )}

        {displayed.map((event, idx) => {
          const Icon = EVENT_ICONS[event.type] || Clock
          const colorClass = getEventIconColor(event.type)

          // Separador de fecha cuando cambia el día respecto al evento anterior
          const prevEvent = displayed[idx - 1]
          const showDaySeparator =
            idx === displayed.length - 1 ||
            (prevEvent && dayLabel(event.timestamp) !== dayLabel(prevEvent.timestamp))

          // Decidir si mostrar relativo (< 24 h) o absoluto
          const diff = Date.now() - new Date(event.timestamp).getTime()
          const isRelative = diff < 24 * 60 * 60 * 1000
          const timeLabel = formatTimeAgo(event.timestamp)
          const exactLabel = formatExactDateTime(event.timestamp)

          return (
            <div key={event.id}>
              <div className='flex gap-4 py-3'>
                {/* Ícono del evento */}
                <div className={`flex-shrink-0 mt-0.5 ${colorClass}`}>
                  <Icon className='h-5 w-5' />
                </div>

                {/* Contenido */}
                <div className='flex-1 space-y-1 min-w-0'>
                  <p className='text-sm font-medium'>{event.description}</p>

                  {/* Timestamp + usuario */}
                  <div className='flex items-center gap-2 text-xs text-muted-foreground flex-wrap'>
                    <Clock className='h-3 w-3 shrink-0' />

                    {isRelative ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className='cursor-default underline decoration-dotted decoration-muted-foreground/40 underline-offset-2'>
                            {timeLabel}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side='top' className='text-xs'>
                          {exactLabel}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span>{timeLabel}</span>
                    )}

                    {event.userName && (
                      <>
                        <span>•</span>
                        <span>{event.userName}</span>
                      </>
                    )}
                  </div>

                  {/* Metadata del evento */}
                  {event.metadata && Object.keys(event.metadata).length > 0 && (
                    <div className='mt-2 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground space-y-1'>
                      {Object.entries(event.metadata).map(([key, value]) => (
                        <div key={key} className='flex gap-2'>
                          <span className='font-medium min-w-[120px]'>{key}:</span>
                          <span>{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Separador de fecha al cambiar de día */}
              {showDaySeparator && (
                <div className='flex items-center gap-3 py-1.5'>
                  <div className='flex-1 h-px bg-border' />
                  <span className='text-xs text-muted-foreground capitalize shrink-0'>
                    {dayLabel(event.timestamp)}
                  </span>
                  <div className='flex-1 h-px bg-border' />
                </div>
              )}
            </div>
          )
        })}

        {/* Botón "Colapsar" cuando está expandido */}
        {showAll && hiddenCount > 0 && (
          <button
            type='button'
            onClick={() => setShowAll(false)}
            className='w-full flex items-center justify-center gap-1.5 py-2 mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors group'
          >
            <ChevronDown className='h-3.5 w-3.5 group-hover:text-primary transition-colors' />
            <span>Colapsar historial</span>
            <ChevronDown className='h-3.5 w-3.5 group-hover:text-primary transition-colors' />
          </button>
        )}
      </div>
    </TooltipProvider>
  )
}
