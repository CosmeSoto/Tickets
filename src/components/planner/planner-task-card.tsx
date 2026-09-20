'use client'

import Link from 'next/link'
import { CalendarClock, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getPriorityColor, getPriorityLabel } from '@/components/ui/resolution-plan/plan-helpers'
import type { PlannerTask } from '@/hooks/use-planner-tasks'

function formatDueDate(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dueDay = new Date(date)
  dueDay.setHours(0, 0, 0, 0)
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000)

  const formatted = date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
  if (diffDays < 0) return `${formatted} (vencida)`
  if (diffDays === 0) return `Hoy`
  if (diffDays === 1) return `Mañana`
  return formatted
}

interface PlannerTaskCardProps {
  task: PlannerTask
  dragHandleProps?: Record<string, unknown>
  isDragging?: boolean
}

/** Tarjeta estilo Trello: acento de color por familia + badge de prioridad,
 * reusando la misma paleta ya usada en la ficha del ticket (plan-helpers.ts)
 * en vez de inventar colores nuevos. */
export function PlannerTaskCard({ task, dragHandleProps, isDragging }: PlannerTaskCardProps) {
  const dueLabel = formatDueDate(task.dueDate)
  const isOverdue = dueLabel?.includes('vencida')

  return (
    <div
      {...dragHandleProps}
      className={`group rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md ${
        isDragging ? 'opacity-50' : ''
      }`}
      style={task.family?.color ? { borderLeft: `3px solid ${task.family.color}` } : undefined}
    >
      <div className='flex items-start justify-between gap-2'>
        <p className='text-sm font-medium leading-snug'>{task.title}</p>
        <Badge className={`shrink-0 text-[10px] ${getPriorityColor(task.priority)}`}>
          {getPriorityLabel(task.priority)}
        </Badge>
      </div>

      <Link
        href={`/tickets/${task.ticketId}`}
        className='mt-1 block truncate text-xs text-muted-foreground hover:underline'
        onClick={e => e.stopPropagation()}
      >
        {task.ticketTitle}
      </Link>

      <div className='mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground'>
        <span className='flex items-center gap-1 truncate'>
          <User className='h-3 w-3 shrink-0' />
          {task.assignee?.name ?? 'Sin asignar'}
        </span>
        {dueLabel && (
          <span
            className={`flex shrink-0 items-center gap-1 ${isOverdue ? 'font-medium text-destructive' : ''}`}
          >
            <CalendarClock className='h-3 w-3' />
            {dueLabel}
          </span>
        )}
      </div>

      {task.family && (
        <div className='mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground'>
          <span
            className='h-1.5 w-1.5 rounded-full'
            style={{ backgroundColor: task.family.color ?? '#6B7280' }}
          />
          {task.family.name}
        </div>
      )}
    </div>
  )
}
