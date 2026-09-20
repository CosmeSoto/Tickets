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

function DraggableCard({ task }: { task: PlannerTask }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className='cursor-grab active:cursor-grabbing'
    >
      <PlannerTaskCard task={task} isDragging={isDragging} />
    </div>
  )
}

function DroppableColumn({
  status,
  label,
  tasks,
}: {
  status: PlannerTaskStatus
  label: string
  tasks: PlannerTask[]
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
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
          <DraggableCard key={task.id} task={task} />
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
}

export function PlannerBoard({ tasks, onStatusChange }: PlannerBoardProps) {
  const [activeTask, setActiveTask] = useState<PlannerTask | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTask((event.active.data.current?.task as PlannerTask) ?? null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null)
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
          />
        ))}
      </div>
      <DragOverlay>{activeTask ? <PlannerTaskCard task={activeTask} /> : null}</DragOverlay>
    </DndContext>
  )
}
