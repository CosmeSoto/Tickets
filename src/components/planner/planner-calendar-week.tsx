'use client'

import { useMemo } from 'react'
import {
  addDays,
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
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getStatusColor } from '@/components/ui/resolution-plan/plan-helpers'
import type { PlannerTask } from '@/hooks/use-planner-tasks'

function dayKey(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

function parseHour(hhmm: string | null): number | null {
  if (!hhmm) return null
  const [h] = hhmm.split(':')
  const n = parseInt(h, 10)
  return Number.isFinite(n) ? n : null
}

interface PlannerCalendarWeekProps {
  weekAnchor: Date
  onWeekChange: (anchor: Date) => void
  selectedDay: Date
  onSelectDay: (day: Date) => void
  tasks: PlannerTask[]
  onTaskClick?: (task: PlannerTask) => void
  /** Clic en una hora vacía de la grilla — crea una tarea independiente con
   *  esa fecha/hora pre-llenada. Sin esto, las celdas vacías no reaccionan. */
  onCreateTask?: (day: Date, hour: number) => void
  /** Un solo día visible (vista "Día") en vez de los 7 de la semana. */
  singleDay?: boolean
}

/** Semana/día de tareas — mismo timeline por hora que la agenda de rondas
 * (ver patrol-agenda-week.tsx), adaptado a startTime/endTime "HH:mm" locales
 * (las tareas no llevan zona horaria propia como los eventos de rondas).
 * Las tareas sin horario (solo fecha límite) se muestran como chips arriba. */
export function PlannerCalendarWeek({
  weekAnchor,
  onWeekChange,
  selectedDay,
  onSelectDay,
  tasks,
  onTaskClick,
  onCreateTask,
  singleDay,
}: PlannerCalendarWeekProps) {
  const weekStart = useMemo(() => startOfWeek(weekAnchor, { weekStartsOn: 1 }), [weekAnchor])
  const weekEnd = useMemo(() => endOfWeek(weekAnchor, { weekStartsOn: 1 }), [weekAnchor])
  const days = useMemo(
    () => (singleDay ? [selectedDay] : eachDayOfInterval({ start: weekStart, end: weekEnd })),
    [singleDay, selectedDay, weekStart, weekEnd]
  )

  const tasksWithDate = useMemo(() => tasks.filter(t => t.dueDate), [tasks])

  const byDay = useMemo(() => {
    const timed = new Map<string, PlannerTask[]>()
    const allDay = new Map<string, PlannerTask[]>()
    for (const t of tasksWithDate) {
      const key = dayKey(new Date(t.dueDate!))
      if (t.startTime) {
        const list = timed.get(key) ?? []
        list.push(t)
        timed.set(key, list)
      } else {
        const list = allDay.get(key) ?? []
        list.push(t)
        allDay.set(key, list)
      }
    }
    return { timed, allDay }
  }, [tasksWithDate])

  const { hourStart, hourEnd } = useMemo(() => {
    let minH = 7
    let maxH = 18
    for (const t of tasksWithDate) {
      const h0 = parseHour(t.startTime)
      if (h0 === null) continue
      const h1 = parseHour(t.endTime) ?? h0 + 1
      minH = Math.min(minH, h0)
      maxH = Math.max(maxH, h1)
    }
    minH = Math.max(0, minH - 1)
    maxH = Math.min(23, Math.max(minH + 8, maxH + 1))
    return { hourStart: minH, hourEnd: maxH }
  }, [tasksWithDate])

  const hours = useMemo(() => {
    const list: number[] = []
    for (let h = hourStart; h <= hourEnd; h++) list.push(h)
    return list
  }, [hourStart, hourEnd])

  const goDay = (day: Date) => {
    onSelectDay(day)
    onWeekChange(day)
  }

  const gridCols = singleDay ? 'grid-cols-[48px_1fr]' : 'grid-cols-[48px_repeat(7,1fr)]'

  return (
    <div className='overflow-hidden rounded-xl border bg-card'>
      <div className='flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between'>
        <div className='min-w-0'>
          <div className='flex items-center gap-1'>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='h-7 w-7 shrink-0'
              aria-label={singleDay ? 'Día anterior' : 'Semana anterior'}
              onClick={() => goDay(singleDay ? addDays(selectedDay, -1) : subWeeks(selectedDay, 1))}
            >
              <ChevronsLeft className='h-4 w-4' />
            </Button>
            <p className='min-w-[11rem] text-center text-sm font-semibold capitalize'>
              {singleDay
                ? format(selectedDay, "EEEE d 'de' MMMM", { locale: es })
                : `${format(weekStart, 'd MMM', { locale: es })} – ${format(weekEnd, 'd MMM yyyy', { locale: es })}`}
            </p>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='h-7 w-7 shrink-0'
              aria-label={singleDay ? 'Día siguiente' : 'Semana siguiente'}
              onClick={() => goDay(singleDay ? addDays(selectedDay, 1) : addWeeks(selectedDay, 1))}
            >
              <ChevronsRight className='h-4 w-4' />
            </Button>
          </div>
        </div>
        <div className='flex items-center gap-1 self-end sm:self-auto'>
          {!singleDay && (
            <>
              <Button
                type='button'
                variant='outline'
                size='icon'
                className='h-8 w-8'
                aria-label='Día anterior'
                onClick={() => goDay(addDays(selectedDay, -1))}
              >
                <ChevronLeft className='h-4 w-4' />
              </Button>
              <Button
                type='button'
                variant='outline'
                size='icon'
                className='h-8 w-8'
                aria-label='Día siguiente'
                onClick={() => goDay(addDays(selectedDay, 1))}
              >
                <ChevronRight className='h-4 w-4' />
              </Button>
            </>
          )}
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='h-8'
            onClick={() => goDay(new Date())}
          >
            Hoy
          </Button>
        </div>
      </div>

      <div className='overflow-x-auto'>
        <div className={singleDay ? 'min-w-[320px]' : 'min-w-[720px]'}>
          {/* Cabecera días */}
          <div className={cn('grid border-b bg-muted/30', gridCols)}>
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
                    'border-l py-2 text-center transition-colors',
                    selected && 'bg-primary/10',
                    today && !selected && 'bg-amber-50/70 dark:bg-amber-950/20'
                  )}
                >
                  <p className='text-[11px] uppercase text-muted-foreground'>
                    {format(day, 'EEE', { locale: es })}
                  </p>
                  <p
                    className={cn(
                      'mx-auto inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold',
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

          {/* Tareas sin horario — solo fecha límite */}
          <div className={cn('grid border-b', gridCols)}>
            <div className='border-r' />
            {days.map(day => {
              const key = dayKey(day)
              const chips = byDay.allDay.get(key) ?? []
              return (
                <div key={key} className='space-y-1 border-l p-1 min-h-[32px]'>
                  {chips.map(t => (
                    <button
                      key={t.id}
                      type='button'
                      onClick={() => onTaskClick?.(t)}
                      title={t.title}
                      className={cn(
                        'block w-full truncate rounded border px-1.5 py-0.5 text-left text-[10px] font-medium',
                        getStatusColor(t.status)
                      )}
                    >
                      {t.title}
                    </button>
                  ))}
                </div>
              )
            })}
          </div>

          {/* Timeline por hora */}
          <div className={cn('grid', gridCols)}>
            <div className='border-r'>
              {hours.map(h => (
                <div
                  key={h}
                  className='h-14 border-b pr-1 pt-0.5 text-right text-[10px] text-muted-foreground'
                >
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>
            {days.map(day => {
              const key = dayKey(day)
              const dayTasks = byDay.timed.get(key) ?? []
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
                      role={onCreateTask ? 'button' : undefined}
                      tabIndex={onCreateTask ? 0 : undefined}
                      onClick={onCreateTask ? () => onCreateTask(day, h) : undefined}
                      onKeyDown={
                        onCreateTask
                          ? e => {
                              if (e.key === 'Enter' || e.key === ' ') onCreateTask(day, h)
                            }
                          : undefined
                      }
                      className={cn(
                        'absolute left-0 right-0 border-b border-border/60',
                        onCreateTask && 'cursor-pointer hover:bg-primary/5'
                      )}
                      style={{ top: (h - hourStart) * 56, height: 56 }}
                    />
                  ))}
                  {dayTasks.map(task => {
                    const startH = parseHour(task.startTime) ?? hourStart
                    const endH = Math.max(startH + 0.75, parseHour(task.endTime) ?? startH + 1)
                    const top = Math.max(0, (startH - hourStart) * 56)
                    const height = Math.max(40, (endH - startH) * 56 - 4)
                    return (
                      <button
                        key={task.id}
                        type='button'
                        onClick={() => {
                          onSelectDay(day)
                          onTaskClick?.(task)
                        }}
                        className={cn(
                          'absolute left-0.5 right-0.5 z-[1] overflow-hidden rounded border px-1 py-0.5 text-left hover:ring-2 hover:ring-primary/40',
                          getStatusColor(task.status)
                        )}
                        style={{ top: top + 2, height }}
                        title={task.title}
                      >
                        <p className='truncate text-[10px] font-semibold leading-tight'>
                          {task.startTime} {task.title}
                        </p>
                        <p className='truncate text-[10px] opacity-80'>
                          {task.assignee?.name ?? 'Sin asignar'}
                        </p>
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
