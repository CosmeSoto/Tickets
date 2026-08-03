'use client'
import { DEFAULT_TIMEZONE } from '@/lib/constants'

import { useMemo } from 'react'
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type AgendaEvent = {
  id: string
  status: string
  scheduledStart: string
  scheduledEnd: string
  dayKey: string
  completionPercentage: number
  agent: { id: string; name: string }
  route: { id: string; name: string }
  family: { id: string; name: string; color: string | null }
}

type DaySummary = {
  total: number
  byStatus: Partial<Record<string, number>>
}

const STATUS_DOT: Record<string, string> = {
  PENDING: 'bg-slate-400',
  IN_PROGRESS: 'bg-blue-500',
  COMPLETED: 'bg-emerald-500',
  MISSED: 'bg-red-500',
  INCOMPLETE: 'bg-orange-500',
}

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function toDayKey(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: DEFAULT_TIMEZONE })
}

interface PatrolAgendaCalendarProps {
  month: Date
  onMonthChange: (month: Date) => void
  selectedDay: Date
  onSelectDay: (day: Date) => void
  byDay: Record<string, DaySummary>
  loading?: boolean
}

/** Al cambiar de día, mantiene el mes visible sincronizado. */
function goToDay(day: Date, onSelectDay: (d: Date) => void, onMonthChange: (m: Date) => void) {
  onSelectDay(day)
  onMonthChange(day)
}

export function PatrolAgendaCalendar({
  month,
  onMonthChange,
  selectedDay,
  onSelectDay,
  byDay,
  loading,
}: PatrolAgendaCalendarProps) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [month])

  const shiftMonth = (delta: number) => {
    const nextMonth = delta < 0 ? subMonths(month, 1) : addMonths(month, 1)
    // Conservar el día del mes (p. ej. 3 → 3), o el último día si no existe
    const targetDay = Math.min(selectedDay.getDate(), endOfMonth(nextMonth).getDate())
    const next = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), targetDay)
    goToDay(next, onSelectDay, onMonthChange)
  }

  return (
    <div className={cn('rounded-xl border bg-card', loading && 'opacity-70')}>
      <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-b'>
        <div className='min-w-0'>
          <div className='flex items-center gap-1'>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='h-7 w-7 shrink-0'
              title='Mes anterior'
              aria-label='Mes anterior'
              onClick={() => shiftMonth(-1)}
            >
              <ChevronsLeft className='h-4 w-4' />
            </Button>
            <p className='text-sm font-semibold capitalize min-w-[9rem] text-center'>
              {format(month, 'MMMM yyyy', { locale: es })}
            </p>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='h-7 w-7 shrink-0'
              title='Mes siguiente'
              aria-label='Mes siguiente'
              onClick={() => shiftMonth(1)}
            >
              <ChevronsRight className='h-4 w-4' />
            </Button>
          </div>
          <p className='text-xs text-muted-foreground sm:pl-8'>
            Doble flecha: mes · Una flecha: día
          </p>
        </div>

        <div className='flex items-center gap-1 self-end sm:self-auto'>
          <Button
            type='button'
            variant='outline'
            size='icon'
            className='h-8 w-8'
            title='Día anterior'
            aria-label='Día anterior'
            onClick={() => goToDay(addDays(selectedDay, -1), onSelectDay, onMonthChange)}
          >
            <ChevronLeft className='h-4 w-4' />
          </Button>
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='h-8 min-w-[3.25rem]'
            title='Ir a hoy'
            aria-label='Ir a hoy'
            onClick={() => {
              const today = new Date()
              goToDay(today, onSelectDay, onMonthChange)
            }}
          >
            Hoy
          </Button>
          <Button
            type='button'
            variant='outline'
            size='icon'
            className='h-8 w-8'
            title='Día siguiente'
            aria-label='Día siguiente'
            onClick={() => goToDay(addDays(selectedDay, 1), onSelectDay, onMonthChange)}
          >
            <ChevronRight className='h-4 w-4' />
          </Button>
        </div>
      </div>

      <div className='grid grid-cols-7 border-b bg-muted/30'>
        {WEEKDAYS.map(d => (
          <div
            key={d}
            className='py-2 text-center text-[11px] font-medium text-muted-foreground uppercase tracking-wide'
          >
            {d}
          </div>
        ))}
      </div>

      <div className='grid grid-cols-7 auto-rows-fr'>
        {days.map(day => {
          const key = toDayKey(day)
          const summary = byDay[key]
          const inMonth = isSameMonth(day, month)
          const selected = isSameDay(day, selectedDay)
          const today = isToday(day)
          const statuses = summary
            ? Object.keys(summary.byStatus).filter(s => (summary.byStatus[s] ?? 0) > 0)
            : []

          return (
            <button
              key={key + day.toISOString()}
              type='button'
              onClick={() => onSelectDay(day)}
              className={cn(
                'min-h-[72px] sm:min-h-[88px] p-1.5 sm:p-2 text-left border-b border-r transition-colors',
                'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                !inMonth && 'bg-muted/20 text-muted-foreground',
                selected && 'bg-primary/5 ring-2 ring-inset ring-primary/40',
                today && !selected && 'bg-amber-50/60 dark:bg-amber-950/20'
              )}
            >
              <div className='flex items-center justify-between gap-1 mb-1'>
                <span
                  className={cn(
                    'text-xs font-medium inline-flex h-6 w-6 items-center justify-center rounded-full',
                    today && 'bg-primary text-primary-foreground',
                    selected && !today && 'bg-primary/15 text-primary'
                  )}
                >
                  {format(day, 'd')}
                </span>
                {summary && summary.total > 0 && (
                  <span className='text-[10px] tabular-nums text-muted-foreground'>
                    {summary.total}
                  </span>
                )}
              </div>
              {statuses.length > 0 && (
                <div className='flex flex-wrap gap-0.5 mt-auto'>
                  {statuses.slice(0, 4).map(s => (
                    <span
                      key={s}
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        STATUS_DOT[s] ?? 'bg-muted-foreground'
                      )}
                      title={`${s}: ${summary?.byStatus[s] ?? 0}`}
                    />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div className='flex flex-wrap gap-3 px-4 py-2.5 border-t text-[11px] text-muted-foreground'>
        {[
          ['PENDING', 'Pendiente'],
          ['IN_PROGRESS', 'En curso'],
          ['COMPLETED', 'Completada'],
          ['INCOMPLETE', 'Incompleta'],
          ['MISSED', 'Omitida'],
        ].map(([code, label]) => (
          <span key={code} className='inline-flex items-center gap-1.5'>
            <span className={cn('h-2 w-2 rounded-full', STATUS_DOT[code])} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

export function agendaDayKey(d: Date): string {
  return toDayKey(d)
}

export function formatAgendaTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-EC', {
    timeZone: DEFAULT_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  })
}
