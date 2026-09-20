'use client'

import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useDraggable } from '@dnd-kit/core'
import { PlannerTaskCard } from './planner-task-card'
import { getStatusColor } from '@/components/ui/resolution-plan/plan-helpers'
import type { PlannerTask, PlannerTaskStatus } from '@/hooks/use-planner-tasks'

// Mismos 4 estados y misma paleta que ya usa la ficha del ticket
// (getStatusColor, plan-helpers.ts) — nada de colores nuevos.
const COLUMNS: { status: PlannerTaskStatus; label: string }[] = [
  { status: 'pending', label: 'Pendiente' },
  { status: 'in_progress', label: 'En progreso' },
  { status: 'completed', label: 'Completada' },
  { status: 'blocked', label: 'Bloqueada' },
]

function DraggableCard({ task, canManage }: { task: PlannerTask; canManage: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { task },
    // Sin permiso de gestión, la tarjeta se ve pero no se puede arrastrar —
    // ver "Crear y gestionar tareas" en module-access-card.tsx: sin ese
    // permiso el usuario solo puede consultar el tablero, igual que
    // Procesos/Accesos con su propio canManage.
    disabled: !canManage,
  })
  return (
    <div
      ref={setNodeRef}
      {...(canManage ? attributes : {})}
      {...(canManage ? listeners : {})}
      className={canManage ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}
    >
      <PlannerTaskCard task={task} isDragging={isDragging} />
    </div>
  )
}

function DroppableColumn({
  status,
  label,
  tasks,
  canManage,
}: {
  status: PlannerTaskStatus
  label: string
  tasks: PlannerTask[]
  canManage: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: !canManage })
  return (
    <div className='flex min-w-[260px] flex-1 flex-col rounded-lg border bg-muted/20'>
      <div
        className={`flex items-center justify-between rounded-t-lg px-3 py-2 text-sm font-medium ${getStatusColor(status)}`}
      >
        <span>{label}</span>
        <span className='rounded-full bg-background/60 px-2 py-0.5 text-xs'>{tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 overflow-y-auto p-2 transition-colors ${
          isOver ? 'bg-primary/5' : ''
        }`}
        style={{ minHeight: 200, maxHeight: 'calc(100vh - 320px)' }}
      >
        {tasks.map(task => (
          <DraggableCard key={task.id} task={task} canManage={canManage} />
        ))}
        {tasks.length === 0 && (
          <p className='py-6 text-center text-xs text-muted-foreground'>Sin tareas</p>
        )}
      </div>
    </div>
  )
}

interface PlannerBoardProps {
  tasks: PlannerTask[]
  onStatusChange: (task: PlannerTask, status: PlannerTaskStatus) => void
  /** Sin esto, el tablero es de solo lectura (ver toggle "Crear y gestionar
   *  tareas" del módulo Planner) — puede consultar pero no arrastrar tarjetas. */
  canManage: boolean
}

export function PlannerBoard({ tasks, onStatusChange, canManage }: PlannerBoardProps) {
  const [activeTask, setActiveTask] = useState<PlannerTask | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const handleDragStart = (event: DragStartEvent) => {
    if (!canManage) return
    setActiveTask((event.active.data.current?.task as PlannerTask) ?? null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null)
    if (!canManage) return
    const { active, over } = event
    if (!over) return
    const task = active.data.current?.task as PlannerTask | undefined
    const newStatus = over.id as PlannerTaskStatus
    if (!task || task.status === newStatus) return
    onStatusChange(task, newStatus)
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTask(null)}
    >
      <div className='flex gap-3 overflow-x-auto pb-2'>
        {COLUMNS.map(col => (
          <DroppableColumn
            key={col.status}
            status={col.status}
            label={col.label}
            tasks={tasks.filter(t => t.status === col.status)}
            canManage={canManage}
          />
        ))}
      </div>
      <DragOverlay>{activeTask ? <PlannerTaskCard task={activeTask} /> : null}</DragOverlay>
    </DndContext>
  )
}
