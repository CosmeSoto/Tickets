'use client'
import { DEFAULT_TIMEZONE } from '@/lib/constants'

import { useMemo } from 'react'
import {
  addWeeks,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  isToday,
  startOfWeek,
  subWeeks,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AgendaEvent } from '@/components/patrols/patrol-agenda-calendar'
import { agendaDayKey, formatAgendaTime } from '@/components/patrols/patrol-agenda-calendar'

const STATUS_BG: Record<string, string> = {
  PENDING:
    'bg-slate-100 border-slate-300 text-slate-800 dark:bg-slate-800/60 dark:border-slate-600 dark:text-slate-100',
  IN_PROGRESS:
    'bg-blue-100 border-blue-300 text-blue-900 dark:bg-blue-950/50 dark:border-blue-700 dark:text-blue-100',
  COMPLETED:
    'bg-emerald-100 border-emerald-300 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-700 dark:text-emerald-100',
  MISSED:
    'bg-red-100 border-red-300 text-red-900 dark:bg-red-950/40 dark:border-red-700 dark:text-red-100',
  INCOMPLETE:
    'bg-orange-100 border-orange-300 text-orange-900 dark:bg-orange-950/40 dark:border-orange-700 dark:text-orange-100',
}

/** Hora local (0–23) en zona de la app a partir de un ISO UTC. */
function localHour(iso: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: DEFAULT_TIMEZONE,
    hour: 'numeric',
    hour12: false,
  }).formatToParts(new Date(iso))
  return parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10)
}

interface PatrolAgendaWeekProps {
  weekAnchor: Date
  onWeekChange: (anchor: Date) => void
  selectedDay: Date
  onSelectDay: (day: Date) => void
  events: AgendaEvent[]
  loading?: boolean
  onEventClick?: (event: AgendaEvent) => void
}

export function PatrolAgendaWeek({
  weekAnchor,
  onWeekChange,
  selectedDay,
  onSelectDay,
  events,
  loading,
  onEventClick,
}: PatrolAgendaWeekProps) {
  const weekStart = startOfWeek(weekAnchor, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(weekAnchor, { weekStartsOn: 1 })
  const days = useMemo(
    () => eachDayOfInterval({ start: weekStart, end: weekEnd }),
    [weekStart.getTime(), weekEnd.getTime()]
  )

  const byDay = useMemo(() => {
    const map = new Map<string, AgendaEvent[]>()
    for (const e of events) {
      const list = map.get(e.dayKey) ?? []
      list.push(e)
      map.set(e.dayKey, list)
    }
    for (const [, list] of map) {
      list.sort(
        (a, b) => new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime()
      )
    }
    return map
  }, [events])

  // Rango horario visible según eventos de la semana (mín 6–20)
  const { hourStart, hourEnd } = useMemo(() => {
    let minH = 6
    let maxH = 20
    for (const e of events) {
      const h0 = localHour(e.scheduledStart)
      const h1 = localHour(e.scheduledEnd)
      minH = Math.min(minH, h0)
      maxH = Math.max(maxH, h1 + (h1 === h0 ? 1 : 0))
    }
    minH = Math.max(0, minH - 1)
    maxH = Math.min(23, Math.max(minH + 8, maxH + 1))
    return { hourStart: minH, hourEnd: maxH }
  }, [events])

  const hours = useMemo(() => {
    const list: number[] = []
    for (let h = hourStart; h <= hourEnd; h++) list.push(h)
    return list
  }, [hourStart, hourEnd])

  return (
    <div className={cn('rounded-xl border bg-card overflow-hidden', loading && 'opacity-70')}>
      <div className='flex items-center justify-between px-4 py-3 border-b'>
        <div>
          <p className='text-sm font-semibold capitalize'>
            {format(weekStart, 'd MMM', { locale: es })} –{' '}
            {format(weekEnd, 'd MMM yyyy', { locale: es })}
          </p>
          <p className='text-xs text-muted-foreground'>Vista semanal por horario</p>
        </div>
        <div className='flex items-center gap-1'>
          <Button
            type='button'
            variant='outline'
            size='icon'
            className='h-8 w-8'
            onClick={() => onWeekChange(subWeeks(weekAnchor, 1))}
          >
            <ChevronLeft className='h-4 w-4' />
          </Button>
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='h-8'
            onClick={() => {
              const today = new Date()
              onWeekChange(today)
              onSelectDay(today)
            }}
          >
            Hoy
          </Button>
          <Button
            type='button'
            variant='outline'
            size='icon'
            className='h-8 w-8'
            onClick={() => onWeekChange(addWeeks(weekAnchor, 1))}
          >
            <ChevronRight className='h-4 w-4' />
          </Button>
        </div>
      </div>

      <div className='overflow-x-auto'>
        <div className='min-w-[720px]'>
          {/* Cabecera días */}
          <div className='grid grid-cols-[48px_repeat(7,1fr)] border-b bg-muted/30'>
            <div />
            {days.map(day => {
              const selected = isSameDay(day, selectedDay)
              const today = isToday(day)
              return (
                <button
                  key={day.toISOString()}
                  type='button'
                  onClick={() => onSelectDay(day)}
                  className={cn(
                    'py-2 text-center border-l transition-colors',
                    selected && 'bg-primary/10',
                    today && !selected && 'bg-amber-50/70 dark:bg-amber-950/20'
                  )}
                >
                  <p className='text-[11px] uppercase text-muted-foreground'>
                    {format(day, 'EEE', { locale: es })}
                  </p>
                  <p
                    className={cn(
                      'text-sm font-semibold inline-flex h-7 w-7 items-center justify-center rounded-full mx-auto',
                      today && 'bg-primary text-primary-foreground',
                      selected && !today && 'bg-primary/15 text-primary'
                    )}
                  >
                    {format(day, 'd')}
                  </p>
                </button>
              )
            })}
          </div>

          {/* Timeline por hora — eventos anclados al día en columna */}
          <div className='grid grid-cols-[48px_repeat(7,1fr)]'>
            <div className='border-r'>
              {hours.map(h => (
                <div
                  key={h}
                  className='h-14 border-b text-[10px] text-muted-foreground pr-1 text-right pt-0.5'
                >
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>
            {days.map(day => {
              const key = agendaDayKey(day)
              const dayEvents = byDay.get(key) ?? []
              const selected = isSameDay(day, selectedDay)
              return (
                <div
                  key={key}
                  className={cn('relative border-l', selected && 'bg-primary/[0.03]')}
                  style={{ height: hours.length * 56 }}
                >
                  {hours.map(h => (
                    <div
                      key={h}
                      className='absolute left-0 right-0 border-b border-border/60'
                      style={{ top: (h - hourStart) * 56, height: 56 }}
                    />
                  ))}
                  {dayEvents.map(event => {
                    const startH = localHour(event.scheduledStart)
                    const endH = Math.max(
                      startH + 0.75,
                      localHour(event.scheduledEnd) || startH + 1
                    )
                    const top = Math.max(0, (startH - hourStart) * 56)
                    const height = Math.max(40, (endH - startH) * 56 - 4)
                    return (
                      <button
                        key={event.id}
                        type='button'
                        onClick={() => {
                          onSelectDay(day)
                          onEventClick?.(event)
                        }}
                        className={cn(
                          'absolute left-0.5 right-0.5 rounded border px-1 py-0.5 text-left overflow-hidden z-[1] hover:ring-2 hover:ring-primary/40',
                          STATUS_BG[event.status] ?? STATUS_BG.PENDING
                        )}
                        style={{ top: top + 2, height }}
                        title={`${event.route.name} · ${event.agent.name}`}
                      >
                        <p className='text-[10px] font-semibold truncate leading-tight'>
                          {formatAgendaTime(event.scheduledStart)} {event.route.name}
                        </p>
                        <p className='text-[10px] truncate opacity-80'>{event.agent.name}</p>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export function weekRangeFromAnchor(anchor: Date) {
  const from = startOfWeek(anchor, { weekStartsOn: 1 })
  const to = endOfWeek(anchor, { weekStartsOn: 1 })
  to.setHours(23, 59, 59, 999)
  return { from, to }
}
