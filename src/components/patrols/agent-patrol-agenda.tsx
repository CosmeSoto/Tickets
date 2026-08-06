'use client'
import { DEFAULT_TIMEZONE } from '@/lib/constants'

/**
 * Agenda personal del agente (Mis Rondas): mes/semana + detalle del día.
 * Reutiliza los mismos componentes visuales que la agenda admin.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { addDays, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { PatrolStatusBadge } from '@/components/patrol/patrol-status-badge'
import {
  PatrolAgendaCalendar,
  agendaDayKey,
  formatAgendaTime,
  type AgendaEvent,
} from '@/components/patrols/patrol-agenda-calendar'
import { PatrolAgendaWeek, weekRangeFromAnchor } from '@/components/patrols/patrol-agenda-week'

type DayBucket = 'all' | 'pending' | 'done' | 'attention'

const BUCKET_FILTER: Record<DayBucket, (e: AgendaEvent) => boolean> = {
  all: () => true,
  pending: e => e.status === 'PENDING' || e.status === 'IN_PROGRESS',
  done: e => e.status === 'COMPLETED',
  attention: e => e.status === 'MISSED' || e.status === 'INCOMPLETE',
}

export function AgentPatrolAgenda() {
  const router = useRouter()
  const [month, setMonth] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState(() => new Date())
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')
  const [dayBucket, setDayBucket] = useState<DayBucket>('all')
  const [agendaEvents, setAgendaEvents] = useState<AgendaEvent[]>([])
  const [byDay, setByDay] = useState<
    Record<string, { total: number; byStatus: Partial<Record<string, number>> }>
  >({})
  const [agendaLoading, setAgendaLoading] = useState(true)

  const weekKey = agendaDayKey(startOfWeek(selectedDay, { weekStartsOn: 1 }))
  const monthKey = `${month.getFullYear()}-${month.getMonth()}`

  const agendaRange = useMemo(() => {
    if (viewMode === 'week') {
      return weekRangeFromAnchor(selectedDay)
    }
    const from = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
    const to = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
    to.setHours(23, 59, 59, 999)
    return { from, to }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, weekKey, monthKey])

  const fetchAgenda = useCallback(async () => {
    setAgendaLoading(true)
    try {
      const params = new URLSearchParams({
        from: agendaRange.from.toISOString(),
        to: agendaRange.to.toISOString(),
        mine: '1',
      })
      const res = await fetch(`/api/patrols/agenda?${params}`)
      if (!res.ok) throw new Error('Error al cargar agenda')
      const json = await res.json()
      setAgendaEvents(json.data?.events ?? [])
      setByDay(json.data?.byDay ?? {})
    } catch {
      setAgendaEvents([])
      setByDay({})
    } finally {
      setAgendaLoading(false)
    }
  }, [agendaRange.from.toISOString(), agendaRange.to.toISOString()])

  useEffect(() => {
    void fetchAgenda()
  }, [fetchAgenda])

  const selectedKey = agendaDayKey(selectedDay)
  const dayEvents = useMemo(() => {
    const list = agendaEvents.filter(e => e.dayKey === selectedKey)
    return list.filter(BUCKET_FILTER[dayBucket])
  }, [agendaEvents, selectedKey, dayBucket])

  const dayCounts = useMemo(() => {
    const all = agendaEvents.filter(e => e.dayKey === selectedKey)
    return {
      all: all.length,
      pending: all.filter(BUCKET_FILTER.pending).length,
      done: all.filter(BUCKET_FILTER.done).length,
      attention: all.filter(BUCKET_FILTER.attention).length,
    }
  }, [agendaEvents, selectedKey])

  const selectedDayLabel = selectedDay.toLocaleDateString('es-EC', {
    timeZone: DEFAULT_TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='text-xs text-muted-foreground'>
          Tu calendario de patrullajes · solo rondas asignadas a ti
        </p>
        <div className='flex items-center gap-1'>
          <Button
            type='button'
            size='sm'
            variant={viewMode === 'month' ? 'default' : 'outline'}
            className='h-8'
            onClick={() => setViewMode('month')}
          >
            Mes
          </Button>
          <Button
            type='button'
            size='sm'
            variant={viewMode === 'week' ? 'default' : 'outline'}
            className='h-8'
            onClick={() => setViewMode('week')}
          >
            Semana
          </Button>
          <Button
            type='button'
            size='sm'
            variant='ghost'
            className='h-8'
            onClick={() => void fetchAgenda()}
            disabled={agendaLoading}
          >
            {agendaLoading ? <Loader2 className='h-4 w-4 animate-spin' /> : 'Actualizar'}
          </Button>
        </div>
      </div>

      <div className='grid grid-cols-1 xl:grid-cols-5 gap-4'>
        <div className='xl:col-span-3'>
          {viewMode === 'month' ? (
            <PatrolAgendaCalendar
              month={month}
              onMonthChange={setMonth}
              selectedDay={selectedDay}
              onSelectDay={day => {
                setSelectedDay(day)
                setMonth(day)
                setDayBucket('all')
              }}
              byDay={byDay}
              loading={agendaLoading}
            />
          ) : (
            <PatrolAgendaWeek
              weekAnchor={selectedDay}
              onWeekChange={anchor => {
                setSelectedDay(anchor)
                setMonth(anchor)
              }}
              selectedDay={selectedDay}
              onSelectDay={day => {
                setSelectedDay(day)
                setDayBucket('all')
              }}
              events={agendaEvents}
              loading={agendaLoading}
              onEventClick={event => router.push(`/patrol/${event.id}`)}
            />
          )}
        </div>

        <div className='xl:col-span-2'>
          <Card className='h-full'>
            <CardHeader className='pb-3'>
              <div className='flex items-start justify-between gap-2'>
                <div className='min-w-0'>
                  <CardTitle className='text-base flex items-center gap-2 capitalize'>
                    <CalendarDays className='h-4 w-4 text-primary shrink-0' />
                    <span className='truncate'>{selectedDayLabel}</span>
                  </CardTitle>
                  <CardDescription>Toca una ronda para abrirla</CardDescription>
                </div>
                <div className='flex items-center gap-0.5 shrink-0'>
                  <Button
                    type='button'
                    variant='outline'
                    size='icon'
                    className='h-7 w-7'
                    aria-label='Día anterior'
                    onClick={() => {
                      const prev = addDays(selectedDay, -1)
                      setSelectedDay(prev)
                      setMonth(prev)
                      setDayBucket('all')
                    }}
                  >
                    <ChevronLeft className='h-3.5 w-3.5' />
                  </Button>
                  <Button
                    type='button'
                    variant='outline'
                    size='icon'
                    className='h-7 w-7'
                    aria-label='Día siguiente'
                    onClick={() => {
                      const next = addDays(selectedDay, 1)
                      setSelectedDay(next)
                      setMonth(next)
                      setDayBucket('all')
                    }}
                  >
                    <ChevronRight className='h-3.5 w-3.5' />
                  </Button>
                </div>
              </div>
              <div className='flex flex-wrap gap-1.5 pt-1'>
                {(
                  [
                    ['all', `Todas (${dayCounts.all})`],
                    ['pending', `Pend. (${dayCounts.pending})`],
                    ['done', `Hechas (${dayCounts.done})`],
                    ['attention', `Atención (${dayCounts.attention})`],
                  ] as const
                ).map(([key, label]) => (
                  <Button
                    key={key}
                    type='button'
                    size='sm'
                    variant={dayBucket === key ? 'default' : 'outline'}
                    className='h-7 text-xs'
                    onClick={() => setDayBucket(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {agendaLoading ? (
                <div className='flex items-center justify-center py-10'>
                  <Loader2 className='h-5 w-5 animate-spin text-muted-foreground' />
                </div>
              ) : dayEvents.length === 0 ? (
                <div className='flex flex-col items-center justify-center py-10 text-center'>
                  <Shield className='h-10 w-10 text-muted-foreground/30 mb-3' />
                  <p className='text-sm text-muted-foreground'>
                    No tienes rondas este día con el filtro actual
                  </p>
                </div>
              ) : (
                <div className='space-y-2 max-h-[480px] overflow-y-auto pr-1'>
                  {dayEvents.map(event => (
                    <button
                      key={event.id}
                      type='button'
                      onClick={() => router.push(`/patrol/${event.id}`)}
                      className='w-full text-left p-3 rounded-lg border hover:bg-muted/40 transition-colors'
                    >
                      <div className='flex items-start justify-between gap-2 mb-1'>
                        <div className='min-w-0'>
                          <p className='font-medium text-sm truncate'>{event.route.name}</p>
                          <p className='text-xs text-muted-foreground truncate'>
                            {event.family.name}
                          </p>
                        </div>
                        <PatrolStatusBadge status={event.status} />
                      </div>
                      <div className='flex items-center justify-between text-xs text-muted-foreground'>
                        <span>
                          {formatAgendaTime(event.scheduledStart)} →{' '}
                          {formatAgendaTime(event.scheduledEnd)}
                        </span>
                        <span>{event.completionPercentage}%</span>
                      </div>
                      {(event.status === 'IN_PROGRESS' ||
                        event.status === 'COMPLETED' ||
                        event.status === 'INCOMPLETE') && (
                        <div className='mt-2'>
                          <Progress value={event.completionPercentage} className='h-1' />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
