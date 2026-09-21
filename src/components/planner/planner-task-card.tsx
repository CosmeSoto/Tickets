'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { CalendarClock, ListTodo, MoreVertical, Pencil, Trash2, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { getPriorityColor, getPriorityLabel } from '@/components/ui/resolution-plan/plan-helpers'
import { ticketUrlForRole } from '@/lib/utils/ticket-role-url'
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
  onEdit?: (task: PlannerTask) => void
  onDelete?: (task: PlannerTask) => void
}

/** Tarjeta estilo Trello: acento de color por familia + badge de prioridad,
 * reusando la misma paleta ya usada en la ficha del ticket (plan-helpers.ts)
 * en vez de inventar colores nuevos. */
export function PlannerTaskCard({
  task,
  dragHandleProps,
  isDragging,
  onEdit,
  onDelete,
}: PlannerTaskCardProps) {
  const { data: session } = useSession()
  const dueLabel = formatDueDate(task.dueDate)
  const isOverdue = dueLabel?.includes('vencida')
  // Editar/eliminar solo existen para tareas independientes: canEdit/canDelete
  // en una tarea de ticket significa "puedo arrastrarla en el tablero
  // compartido" (ver GET /api/planner/tasks), no "puedo abrir un editor" —
  // esa edición sigue viviendo únicamente en la ficha del ticket.
  const showMenu =
    task.origin === 'personal' && (task.canEdit || task.canDelete) && (onEdit || onDelete)

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
        <div className='flex shrink-0 items-center gap-1'>
          <Badge className={`shrink-0 text-[10px] ${getPriorityColor(task.priority)}`}>
            {getPriorityLabel(task.priority)}
          </Badge>
          {showMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className='h-5 w-5 opacity-0 group-hover:opacity-100'
                  onClick={e => e.stopPropagation()}
                >
                  <MoreVertical className='h-3.5 w-3.5' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                {task.canEdit && onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(task)}>
                    <Pencil className='mr-2 h-3.5 w-3.5' />
                    Editar
                  </DropdownMenuItem>
                )}
                {task.canDelete && onDelete && (
                  <DropdownMenuItem
                    className='text-destructive focus:text-destructive'
                    onClick={() => onDelete(task)}
                  >
                    <Trash2 className='mr-2 h-3.5 w-3.5' />
                    Eliminar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {task.origin === 'ticket' && task.ticketId ? (
        <Link
          href={ticketUrlForRole(session?.user?.role, task.ticketId)}
          className='mt-1 block truncate text-xs text-muted-foreground hover:underline'
          onClick={e => e.stopPropagation()}
        >
          {task.ticketTitle}
        </Link>
      ) : (
        <span className='mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground'>
          <ListTodo className='h-3 w-3 shrink-0' />
          Tarea independiente
        </span>
      )}

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
