import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../card'
import { Button } from '../button'
import { Badge } from '../badge'
import { Progress } from '../progress'
import {
  Target,
  Calendar,
  MoreVertical,
  PlayCircle,
  CheckCircle,
  Edit2,
  Trash2,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../dropdown-menu'
import type { ResolutionPlan } from '@/hooks/use-resolution-plan'
import { formatDuration } from '@/lib/utils/time-utils'
import { getStatusLabel, getStatusColor } from './plan-helpers'

interface PlanSummaryProps {
  plan: ResolutionPlan
  canEdit: boolean
  progress: number
  openPlanMenu: boolean
  setOpenPlanMenu: (open: boolean) => void
  onActivate: () => void
  onComplete: () => void
  onEdit: () => void
  onDelete: () => void
}

export function PlanSummary({
  plan,
  canEdit,
  progress,
  openPlanMenu,
  setOpenPlanMenu,
  onActivate,
  onComplete,
  onEdit,
  onDelete,
}: PlanSummaryProps) {
  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div className='flex-1'>
            <CardTitle className='flex items-center space-x-2'>
              <Target className='h-5 w-5' />
              <span>{plan.title}</span>
            </CardTitle>
            <CardDescription>{plan.description}</CardDescription>
          </div>
          <div className='flex items-center gap-2'>
            <Badge className={getStatusColor(plan.status)}>{getStatusLabel(plan.status)}</Badge>
            {canEdit && (
              <DropdownMenu open={openPlanMenu} onOpenChange={setOpenPlanMenu}>
                <DropdownMenuTrigger asChild>
                  <Button variant='ghost' size='sm'>
                    <MoreVertical className='h-4 w-4' />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
                  {plan.status === 'draft' && (
                    <>
                      <DropdownMenuItem
                        onClick={() => {
                          setOpenPlanMenu(false)
                          onActivate()
                        }}
                      >
                        <PlayCircle className='h-4 w-4 mr-2' />
                        Activar Plan
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {plan.status === 'active' && (
                    <>
                      <DropdownMenuItem
                        onClick={() => {
                          setOpenPlanMenu(false)
                          onComplete()
                        }}
                      >
                        <CheckCircle className='h-4 w-4 mr-2' />
                        Marcar como Completado
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem
                    onClick={() => {
                      setOpenPlanMenu(false)
                      onEdit()
                    }}
                  >
                    <Edit2 className='h-4 w-4 mr-2' />
                    Editar Plan
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      setOpenPlanMenu(false)
                      onDelete()
                    }}
                    className='text-destructive focus:text-destructive'
                  >
                    <Trash2 className='h-4 w-4 mr-2' />
                    Eliminar Plan
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        {/* Progreso general */}
        <div>
          <div className='flex items-center justify-between mb-2'>
            <span className='text-sm font-medium text-foreground'>Progreso General</span>
            <span className='text-sm text-muted-foreground'>
              {plan.completedTasks}/{plan.totalTasks} tareas completadas
            </span>
          </div>
          <Progress value={progress} className='h-2' />
          <div className='text-center mt-1'>
            <span className='text-lg font-bold text-primary'>{progress}%</span>
          </div>
        </div>

        {/* Estadísticas */}
        <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
          <div className='text-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg'>
            <div className='text-2xl font-bold text-blue-900 dark:text-blue-200'>
              {plan.totalTasks}
            </div>
            <div className='text-sm text-blue-700 dark:text-blue-300'>Total Tareas</div>
          </div>

          <div className='text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg'>
            <div className='text-2xl font-bold text-green-900 dark:text-green-200'>
              {plan.completedTasks}
            </div>
            <div className='text-sm text-green-700 dark:text-green-300'>Completadas</div>
          </div>

          <div className='text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg'>
            <div className='text-2xl font-bold text-yellow-900 dark:text-yellow-200'>
              {formatDuration(plan.estimatedHours)}
            </div>
            <div className='text-sm text-yellow-700 dark:text-yellow-300'>Estimadas</div>
          </div>

          <div className='text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg'>
            <div className='text-2xl font-bold text-purple-900 dark:text-purple-200'>
              {formatDuration(plan.actualHours)}
            </div>
            <div className='text-sm text-purple-700 dark:text-purple-300'>Reales</div>
          </div>
        </div>

        {/* Fechas importantes */}
        {(plan.startDate || plan.targetDate) && (
          <div className='flex items-center space-x-4 text-sm text-muted-foreground'>
            {plan.startDate && (
              <div className='flex items-center space-x-1'>
                <Calendar className='h-4 w-4' />
                <span>Inicio: {new Date(plan.startDate).toLocaleDateString()}</span>
              </div>
            )}
            {plan.targetDate && (
              <div className='flex items-center space-x-1'>
                <Target className='h-4 w-4' />
                <span>Meta: {new Date(plan.targetDate).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
