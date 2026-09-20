'use client'

import { useMemo } from 'react'
import { format, isSameDay, isSameMonth, isToday } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getMonthGridDays, shiftMonthKeepingDay } from '@/lib/calendar/month-grid'
import type { PlannerTask, PlannerTaskStatus } from '@/hooks/use-planner-tasks'

const STATUS_DOT: Record<PlannerTaskStatus, string> = {
  pending: 'bg-slate-400',
  in_progress: 'bg-blue-500',
  completed: 'bg-emerald-500',
  blocked: 'bg-red-500',
}

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function dayKey(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

interface PlannerCalendarMonthProps {
  month: Date
  onMonthChange: (month: Date) => void
  selectedDay: Date
  onSelectDay: (day: Date) => void
  tasks: PlannerTask[]
}

/** Calendario mensual de tareas — misma grilla/interacción que el de rondas
 * (ver src/lib/calendar/month-grid.ts), con los 4 estados de resolution_tasks. */
export function PlannerCalendarMonth({
  month,
  onMonthChange,
  selectedDay,
  onSelectDay,
  tasks,
}: PlannerCalendarMonthProps) {
  const days = useMemo(() => getMonthGridDays(month, 1), [month])

  const byDay = useMemo(() => {
    const map = new Map<string, PlannerTask[]>()
    for (const task of tasks) {
      if (!task.dueDate) continue
      const key = dayKey(new Date(task.dueDate))
      const list = map.get(key) ?? []
      list.push(task)
      map.set(key, list)
    }
    return map
  }, [tasks])

  const shiftMonth = (delta: number) => {
    const next = shiftMonthKeepingDay(month, selectedDay, delta)
    onSelectDay(next)
    onMonthChange(next)
  }

  return (
    <div className='rounded-xl border bg-card'>
      <div className='flex items-center justify-between border-b px-4 py-3'>
        <div className='flex items-center gap-1'>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='h-7 w-7'
            onClick={() => shiftMonth(-1)}
            aria-label='Mes anterior'
          >
            <ChevronsLeft className='h-4 w-4' />
          </Button>
          <p className='min-w-[9rem] text-center text-sm font-semibold capitalize'>
            {format(month, 'MMMM yyyy', { locale: es })}
          </p>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='h-7 w-7'
            onClick={() => shiftMonth(1)}
            aria-label='Mes siguiente'
          >
            <ChevronsRight className='h-4 w-4' />
          </Button>
        </div>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() => {
            const today = new Date()
            onSelectDay(today)
            onMonthChange(today)
          }}
        >
          Hoy
        </Button>
      </div>

      <div className='grid grid-cols-7 border-b bg-muted/30'>
        {WEEKDAYS.map(d => (
          <div
            key={d}
            className='py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground'
          >
            {d}
          </div>
        ))}
      </div>

      <div className='grid grid-cols-7 auto-rows-fr'>
        {days.map(day => {
          const key = dayKey(day)
          const dayTasks = byDay.get(key) ?? []
          const inMonth = isSameMonth(day, month)
          const selected = isSameDay(day, selectedDay)
          const today = isToday(day)

          return (
            <button
              key={key}
              type='button'
              onClick={() => onSelectDay(day)}
              className={cn(
                'min-h-[76px] border-b border-r p-1.5 text-left transition-colors sm:min-h-[92px] sm:p-2',
                'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                !inMonth && 'bg-muted/20 text-muted-foreground',
                selected && 'bg-primary/5 ring-2 ring-inset ring-primary/40',
                today && !selected && 'bg-amber-50/60 dark:bg-amber-950/20'
              )}
            >
              <div className='mb-1 flex items-center justify-between gap-1'>
                <span
                  className={cn(
                    'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                    today && 'bg-primary text-primary-foreground',
                    selected && !today && 'bg-primary/15 text-primary'
                  )}
                >
                  {format(day, 'd')}
                </span>
                {dayTasks.length > 0 && (
                  <span className='text-[10px] tabular-nums text-muted-foreground'>
                    {dayTasks.length}
                  </span>
                )}
              </div>
              {dayTasks.length > 0 && (
                <div className='flex flex-wrap gap-0.5'>
                  {dayTasks.slice(0, 6).map(t => (
                    <span
                      key={t.id}
                      className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[t.status])}
                      title={`${t.title} — ${t.status}`}
                    />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div className='flex flex-wrap gap-3 border-t px-4 py-2.5 text-[11px] text-muted-foreground'>
        {(
          [
            ['pending', 'Pendiente'],
            ['in_progress', 'En progreso'],
            ['completed', 'Completada'],
            ['blocked', 'Bloqueada'],
          ] as [PlannerTaskStatus, string][]
        ).map(([status, label]) => (
          <span key={status} className='inline-flex items-center gap-1.5'>
            <span className={cn('h-2 w-2 rounded-full', STATUS_DOT[status])} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
