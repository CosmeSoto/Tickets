import { useState } from 'react'
import { Badge } from '../badge'
import { ChevronDown, ChevronUp, Calendar, Target, CheckCircle } from 'lucide-react'
import type { ResolutionPlan } from '@/hooks/use-resolution-plan'
import { getStatusIcon, getStatusBadge } from './plan-status-icons'
import {
  formatDate,
  formatDuration,
  getPriorityColor,
  getPriorityLabel,
  getStatusColor,
  getStatusLabel,
} from './plan-helpers'

interface PastPlanCardProps {
  plan: ResolutionPlan
}

/** Reseña expandible de un plan cerrado: resumen (tareas, horas, fechas) +
 *  el detalle de cada tarea realizada. Antes "Planes anteriores" solo
 *  mostraba título + conteo de tareas + badge de estado, sin forma de ver
 *  qué se hizo realmente. */
export function PastPlanCard({ plan }: PastPlanCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className='rounded-lg border overflow-hidden'>
      <button
        type='button'
        onClick={() => setExpanded(v => !v)}
        className='w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-left'
      >
        <div className='min-w-0'>
          <p className='font-medium truncate'>{plan.title}</p>
          <p className='text-xs text-muted-foreground'>
            {plan.completedTasks}/{plan.totalTasks} tareas
            {plan.actualHours ? ` · ${formatDuration(plan.actualHours)} reales` : ''}
            {plan.completedDate ? ` · Cerrado ${formatDate(plan.completedDate)}` : ''}
          </p>
        </div>
        <div className='flex items-center gap-2 shrink-0'>
          <Badge className={getStatusColor(plan.status)}>{getStatusLabel(plan.status)}</Badge>
          {expanded ? (
            <ChevronUp className='h-4 w-4 text-muted-foreground' />
          ) : (
            <ChevronDown className='h-4 w-4 text-muted-foreground' />
          )}
        </div>
      </button>

      {expanded && (
        <div className='border-t px-3 py-3 space-y-3 bg-muted/20'>
          {plan.description && <p className='text-sm text-muted-foreground'>{plan.description}</p>}

          {/* Resumen de horas/tareas */}
          <div className='grid grid-cols-2 sm:grid-cols-4 gap-2 text-center'>
            <div className='p-2 rounded-lg bg-background border'>
              <div className='text-base font-bold'>{plan.totalTasks}</div>
              <div className='text-[11px] text-muted-foreground'>Tareas</div>
            </div>
            <div className='p-2 rounded-lg bg-background border'>
              <div className='text-base font-bold text-green-600 dark:text-green-400'>
                {plan.completedTasks}
              </div>
              <div className='text-[11px] text-muted-foreground'>Completadas</div>
            </div>
            <div className='p-2 rounded-lg bg-background border'>
              <div className='text-base font-bold text-yellow-600 dark:text-yellow-400'>
                {formatDuration(plan.estimatedHours)}
              </div>
              <div className='text-[11px] text-muted-foreground'>Estimado</div>
            </div>
            <div className='p-2 rounded-lg bg-background border'>
              <div className='text-base font-bold text-purple-600 dark:text-purple-400'>
                {formatDuration(plan.actualHours)}
              </div>
              <div className='text-[11px] text-muted-foreground'>Real</div>
            </div>
          </div>

          {/* Fechas del plan */}
          {(plan.startDate || plan.targetDate || plan.completedDate) && (
            <div className='flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground'>
              {plan.startDate && (
                <span className='flex items-center gap-1'>
                  <Calendar className='h-3 w-3' /> Inicio: {formatDate(plan.startDate)}
                </span>
              )}
              {plan.targetDate && (
                <span className='flex items-center gap-1'>
                  <Target className='h-3 w-3' /> Meta: {formatDate(plan.targetDate)}
                </span>
              )}
              {plan.completedDate && (
                <span className='flex items-center gap-1 text-green-600 dark:text-green-400'>
                  <CheckCircle className='h-3 w-3' /> Cerrado: {formatDate(plan.completedDate)}
                </span>
              )}
            </div>
          )}

          {/* Tareas realizadas */}
          <div className='space-y-1.5'>
            <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
              Tareas realizadas
            </p>
            {plan.tasks.length === 0 ? (
              <p className='text-xs text-muted-foreground italic'>Sin tareas registradas</p>
            ) : (
              plan.tasks.map(task => (
                <div
                  key={task.id}
                  className='flex items-start gap-2 p-2 rounded-lg border bg-background text-sm'
                >
                  <span className='mt-0.5 shrink-0'>{getStatusIcon(task.status)}</span>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-start justify-between gap-2 flex-wrap'>
                      <span
                        className={
                          task.status === 'completed'
                            ? 'line-through text-muted-foreground'
                            : 'text-foreground'
                        }
                      >
                        {task.title}
                      </span>
                      <div className='flex items-center gap-1.5 shrink-0'>
                        <Badge className={getPriorityColor(task.priority)}>
                          {getPriorityLabel(task.priority)}
                        </Badge>
                        {getStatusBadge(task.status)}
                      </div>
                    </div>
                    {task.description && (
                      <p className='text-xs text-muted-foreground mt-0.5'>{task.description}</p>
                    )}
                    {task.notes && (
                      <p className='text-xs text-muted-foreground mt-0.5 italic'>
                        Notas: {task.notes}
                      </p>
                    )}
                    <div className='flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground mt-1'>
                      {task.completedAt && (
                        <span className='text-green-600 dark:text-green-400'>
                          Completada: {formatDate(task.completedAt)}
                        </span>
                      )}
                      {task.startTime && task.endTime && (
                        <span>
                          Horario: {task.startTime}–{task.endTime}
                        </span>
                      )}
                      {task.estimatedHours ? (
                        <span>Estimado: {formatDuration(task.estimatedHours)}</span>
                      ) : null}
                      {task.actualHours ? (
                        <span>Real: {formatDuration(task.actualHours)}</span>
                      ) : null}
                      {task.assignedTo && <span>Asignado a: {task.assignedTo.name}</span>}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
