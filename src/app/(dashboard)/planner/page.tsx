'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Settings, LayoutGrid, CalendarDays, Plus } from 'lucide-react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { Button } from '@/components/ui/button'
import { useUserModules } from '@/hooks/use-user-modules'
import { usePlannerTasks, type PlannerTask } from '@/hooks/use-planner-tasks'
import { PlannerBoard } from '@/components/planner/planner-board'
import { PlannerCalendarMonth } from '@/components/planner/planner-calendar-month'
import { PlannerCalendarWeek } from '@/components/planner/planner-calendar-week'
import { PersonalTaskDialog } from '@/components/planner/personal-task-dialog'
import { ticketUrlForRole } from '@/lib/utils/ticket-role-url'

type ViewMode = 'board' | 'month' | 'week' | 'day'

export default function PlannerPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const { planner: plannerEnabled, canManagePlanner } = useUserModules()
  const {
    tasks,
    loading,
    error,
    reload,
    updateStatus,
    createPersonalTask,
    updatePersonalTask,
    deletePersonalTask,
  } = usePlannerTasks()

  const [view, setView] = useState<ViewMode>('board')
  const [anchorDate, setAnchorDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(new Date())

  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<PlannerTask | null>(null)
  const [createDefaults, setCreateDefaults] = useState<{ date: Date | null; hour: number | null }>({
    date: null,
    hour: null,
  })

  const openCreateDialog = (date?: Date, hour?: number) => {
    setEditingTask(null)
    setCreateDefaults({ date: date ?? null, hour: hour ?? null })
    setTaskDialogOpen(true)
  }

  const openEditDialog = (task: PlannerTask) => {
    setEditingTask(task)
    setCreateDefaults({ date: null, hour: null })
    setTaskDialogOpen(true)
  }

  const handleTaskClick = (task: PlannerTask) => {
    if (task.origin === 'personal') {
      openEditDialog(task)
    } else if (task.ticketId) {
      router.push(ticketUrlForRole(session?.user?.role, task.ticketId))
    }
  }

  return (
    <ModuleLayout
      title='Tareas'
      subtitle='Tablero y calendario de tareas — de tickets y tareas independientes del día a día.'
      loading={loading && tasks.length === 0}
      error={error}
      onRetry={reload}
      headerActions={
        <div className='flex flex-wrap items-center gap-2'>
          <div className='flex shrink-0 rounded-md border p-0.5'>
            <Button
              type='button'
              size='sm'
              variant={view === 'board' ? 'default' : 'ghost'}
              className='h-7 gap-1.5 px-2.5 text-xs'
              onClick={() => setView('board')}
            >
              <LayoutGrid className='h-3.5 w-3.5' />
              Tablero
            </Button>
            <Button
              type='button'
              size='sm'
              variant={view === 'month' ? 'default' : 'ghost'}
              className='h-7 px-2.5 text-xs'
              onClick={() => setView('month')}
            >
              Mes
            </Button>
            <Button
              type='button'
              size='sm'
              variant={view === 'week' ? 'default' : 'ghost'}
              className='h-7 px-2.5 text-xs'
              onClick={() => setView('week')}
            >
              Semana
            </Button>
            <Button
              type='button'
              size='sm'
              variant={view === 'day' ? 'default' : 'ghost'}
              className='h-7 gap-1.5 px-2.5 text-xs'
              onClick={() => setView('day')}
            >
              <CalendarDays className='h-3.5 w-3.5' />
              Día
            </Button>
          </div>
          {plannerEnabled && (
            <Button size='sm' className='h-7 text-xs' onClick={() => openCreateDialog()}>
              <Plus className='mr-1.5 h-3.5 w-3.5' />
              Nueva tarea
            </Button>
          )}
          {canManagePlanner && (
            <Button
              variant='outline'
              size='sm'
              className='h-7 text-xs'
              onClick={() => router.push('/admin/planner/settings')}
            >
              <Settings className='mr-1.5 h-3.5 w-3.5' />
              Configuración
            </Button>
          )}
        </div>
      }
    >
      {view === 'board' && (
        <PlannerBoard
          tasks={tasks}
          onStatusChange={(t, s) => void updateStatus(t, s)}
          onEditTask={openEditDialog}
          onDeleteTask={t => void deletePersonalTask(t.id)}
        />
      )}

      {view === 'month' && (
        <PlannerCalendarMonth
          month={anchorDate}
          onMonthChange={setAnchorDate}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          tasks={tasks}
          onCreateTask={plannerEnabled ? day => openCreateDialog(day) : undefined}
        />
      )}

      {view === 'week' && (
        <PlannerCalendarWeek
          weekAnchor={anchorDate}
          onWeekChange={setAnchorDate}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          tasks={tasks}
          onTaskClick={handleTaskClick}
          onCreateTask={plannerEnabled ? (day, hour) => openCreateDialog(day, hour) : undefined}
        />
      )}

      {view === 'day' && (
        <PlannerCalendarWeek
          singleDay
          weekAnchor={anchorDate}
          onWeekChange={setAnchorDate}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          tasks={tasks}
          onTaskClick={handleTaskClick}
          onCreateTask={plannerEnabled ? (day, hour) => openCreateDialog(day, hour) : undefined}
        />
      )}

      <PersonalTaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        task={editingTask}
        initialDate={createDefaults.date}
        initialHour={createDefaults.hour}
        onCreate={createPersonalTask}
        onUpdate={updatePersonalTask}
        onDelete={deletePersonalTask}
      />
    </ModuleLayout>
  )
}
