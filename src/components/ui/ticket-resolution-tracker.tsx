'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'
import { Button } from './button'
import { Plus, Target } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'
import { useResolutionPlan } from '@/hooks/use-resolution-plan'
import { PlanSummary } from './resolution-plan/plan-summary'
import { TaskList } from './resolution-plan/task-list'
import { PlanFormDialog } from './resolution-plan/plan-form-dialog'
import { PlanDialogs } from './resolution-plan/plan-dialogs'

interface TicketResolutionTrackerProps {
  ticketId: string
  ticketStatus?: string
  canEdit?: boolean
  mode?: 'admin' | 'technician' | 'client'
  onPlanChange?: () => void
}

export function TicketResolutionTracker({
  ticketId,
  ticketStatus,
  canEdit = false,
  mode: _mode,
  onPlanChange,
}: TicketResolutionTrackerProps) {
  const hook = useResolutionPlan(ticketId, onPlanChange)

  // Calcular permisos efectivos según estado del ticket y del plan
  const isTicketClosed = ticketStatus === 'CLOSED'
  const isPlanCompleted = hook.plan?.status === 'completed'
  const isPlanCancelled = hook.plan?.status === 'cancelled'

  // No se puede hacer nada si el ticket está cerrado o el plan está completado/cancelado
  const effectiveCanEdit = canEdit && !isTicketClosed && !isPlanCompleted && !isPlanCancelled

  if (hook.loading) {
    return (
      <Card>
        <CardContent className='pt-6'>
          <div className='flex items-center justify-center py-8'>
            <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!hook.plan) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center space-x-2'>
            <Target className='h-5 w-5' />
            <span>Plan de Resolución</span>
          </CardTitle>
          <CardDescription>Crea un plan estructurado para resolver este ticket</CardDescription>
        </CardHeader>
        <CardContent>
          {!hook.showCreatePlan ? (
            <div className='text-center py-8'>
              <Target className='h-12 w-12 mx-auto mb-4 text-muted-foreground' />
              <h3 className='text-lg font-medium text-foreground mb-2'>
                No hay plan de resolución
              </h3>
              <p className='text-muted-foreground mb-4'>
                Crea un plan para organizar las tareas necesarias para resolver este ticket
              </p>
              {effectiveCanEdit && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={() => hook.setShowCreatePlan(true)}>
                        <Plus className='h-4 w-4 mr-2' />
                        Crear Plan de Resolución
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Crea un plan estructurado con tareas para resolver este ticket</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          ) : (
            <PlanFormDialog
              planForm={hook.planForm}
              setPlanForm={hook.setPlanForm}
              onSubmit={hook.createResolutionPlan}
              onCancel={() => {
                hook.setShowCreatePlan(false)
                hook.resetPlanForm()
              }}
              mode='create'
            />
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className='space-y-6'>
      <PlanSummary
        plan={hook.plan}
        canEdit={effectiveCanEdit}
        progress={hook.calculateProgress()}
        openPlanMenu={hook.openPlanMenu}
        setOpenPlanMenu={hook.setOpenPlanMenu}
        onActivate={hook.activatePlan}
        onComplete={hook.completePlan}
        onEdit={() => {
          hook.loadPlanToForm()
          hook.setShowEditPlan(true)
        }}
        onDelete={() => hook.setShowDeletePlan(true)}
      />

      <TaskList
        plan={hook.plan}
        canEdit={effectiveCanEdit}
        showAddTask={hook.showAddTask}
        setShowAddTask={hook.setShowAddTask}
        newTask={hook.newTask}
        setNewTask={hook.setNewTask}
        onAddTask={hook.addTask}
        onUpdateTaskStatus={hook.updateTaskStatus}
        onDeleteTask={hook.setTaskToDelete}
      />

      <PlanDialogs
        showEditPlan={hook.showEditPlan}
        setShowEditPlan={hook.setShowEditPlan}
        showDeletePlan={hook.showDeletePlan}
        setShowDeletePlan={hook.setShowDeletePlan}
        taskToDelete={hook.taskToDelete}
        setTaskToDelete={hook.setTaskToDelete}
        planForm={hook.planForm}
        setPlanForm={hook.setPlanForm}
        plan={hook.plan}
        onUpdatePlan={hook.updatePlan}
        onDeletePlan={hook.deletePlan}
        onDeleteTask={hook.deleteTask}
      />
    </div>
  )
}
