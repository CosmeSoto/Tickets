'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Settings, LayoutGrid, CalendarDays } from 'lucide-react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { Button } from '@/components/ui/button'
import { useUserModules } from '@/hooks/use-user-modules'
import { usePlannerTasks } from '@/hooks/use-planner-tasks'
import { PlannerBoard } from '@/components/planner/planner-board'
import { PlannerCalendarMonth } from '@/components/planner/planner-calendar-month'
import { PlannerCalendarWeek } from '@/components/planner/planner-calendar-week'

type ViewMode = 'board' | 'month' | 'week' | 'day'

export default function PlannerPage() {
  const router = useRouter()
  const { canManagePlanner } = useUserModules()
  const { tasks, loading, error, reload, updateStatus } = usePlannerTasks()

  const [view, setView] = useState<ViewMode>('board')
  const [anchorDate, setAnchorDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(new Date())

  const goToTicket = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (task) router.push(`/tickets/${task.ticketId}`)
  }

  return (
    <ModuleLayout
      title='Tareas'
      subtitle='Tablero y calendario de tareas de tickets — sincronizadas con Microsoft Planner.'
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
        <PlannerBoard tasks={tasks} onStatusChange={(t, s) => void updateStatus(t, s)} />
      )}

      {view === 'month' && (
        <PlannerCalendarMonth
          month={anchorDate}
          onMonthChange={setAnchorDate}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          tasks={tasks}
        />
      )}

      {view === 'week' && (
        <PlannerCalendarWeek
          weekAnchor={anchorDate}
          onWeekChange={setAnchorDate}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          tasks={tasks}
          onTaskClick={t => goToTicket(t.id)}
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
          onTaskClick={t => goToTicket(t.id)}
        />
      )}
    </ModuleLayout>
  )
}
