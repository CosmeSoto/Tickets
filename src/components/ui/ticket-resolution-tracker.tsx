'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'
import { Button } from './button'
import { Alert, AlertDescription } from './alert'
import { Plus, Target, PlayCircle, Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'
import { useResolutionPlan } from '@/hooks/use-resolution-plan'
import { PlanSummary } from './resolution-plan/plan-summary'
import { TaskList } from './resolution-plan/task-list'
import { PlanFormDialog } from './resolution-plan/plan-form-dialog'
import { PlanDialogs } from './resolution-plan/plan-dialogs'
import { PastPlanCard } from './resolution-plan/past-plan-card'
import { FormDraftBanner } from '@/components/common/form-draft-banner'

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

  const isTicketClosed = ticketStatus === 'CLOSED'
  const isInProgress = ticketStatus === 'IN_PROGRESS'
  const openPlan =
    hook.plan && (hook.plan.status === 'draft' || hook.plan.status === 'active') ? hook.plan : null
  const pastPlans = hook.plans.filter(
    p => p.status === 'completed' || p.status === 'cancelled' || (openPlan && p.id !== openPlan.id)
  )
  const isPlanCompleted = openPlan?.status === 'completed'
  const isPlanCancelled = openPlan?.status === 'cancelled'

  const effectiveCanEdit =
    canEdit && !isTicketClosed && isInProgress && !isPlanCompleted && !isPlanCancelled
  const canCreatePlan = canEdit && !isTicketClosed && isInProgress && !openPlan

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

  return (
    <div className='space-y-6'>
      {canEdit && !isInProgress && !isTicketClosed && (
        <Alert>
          <PlayCircle className='h-4 w-4' />
          <AlertDescription>
            Pon el ticket <strong>En progreso</strong> para crear o editar un plan de resolución.
          </AlertDescription>
        </Alert>
      )}

      {/* Banner informativo cuando hay un plan en curso y no se puede crear otro */}
      {canEdit && isInProgress && openPlan && (
        <Alert className='border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800'>
          <Info className='h-4 w-4 text-amber-600 dark:text-amber-400' />
          <AlertDescription className='text-amber-800 dark:text-amber-300'>
            {openPlan.status === 'draft' ? (
              <>
                Hay un plan en <strong>borrador</strong>: &quot;{openPlan.title}&quot;. Actívalo y
                complétalo antes de crear un nuevo plan.
              </>
            ) : (
              <>
                Hay un plan <strong>activo</strong>: &quot;{openPlan.title}&quot;. Márcalo como
                completado para poder crear un nuevo plan.
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      {hook.showCreatePlan && canCreatePlan ? (
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center space-x-2'>
              <Target className='h-5 w-5' />
              <span>Plan de Resolución</span>
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            <FormDraftBanner
              visible={hook.planDraftRestored}
              onDismiss={hook.dismissPlanDraft}
              onDiscard={hook.discardPlanDraft}
            />
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
          </CardContent>
        </Card>
      ) : !openPlan ? (
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center space-x-2'>
              <Target className='h-5 w-5' />
              <span>Plan de Resolución</span>
            </CardTitle>
            <CardDescription>Crea un plan estructurado para resolver este ticket</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='text-center py-8'>
              <Target className='h-12 w-12 mx-auto mb-4 text-muted-foreground' />
              <h3 className='text-lg font-medium text-foreground mb-2'>No hay plan en curso</h3>
              <p className='text-muted-foreground mb-4'>
                {pastPlans.length > 0
                  ? 'El plan anterior ya está cerrado. Puedes crear uno nuevo.'
                  : 'Crea un plan para organizar las tareas necesarias para resolver este ticket'}
              </p>
              {canCreatePlan && (
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
          </CardContent>
        </Card>
      ) : (
        <>
          <PlanSummary
            plan={openPlan}
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
            plan={openPlan}
            canEdit={effectiveCanEdit}
            showAddTask={hook.showAddTask}
            setShowAddTask={hook.setShowAddTask}
            newTask={hook.newTask}
            setNewTask={hook.setNewTask}
            onAddTask={hook.addTask}
            onUpdateTask={hook.updateTask}
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
            plan={openPlan}
            onUpdatePlan={hook.updatePlan}
            onDeletePlan={hook.deletePlan}
            onDeleteTask={hook.deleteTask}
          />
        </>
      )}

      {pastPlans.length > 0 && (
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm'>Planes anteriores</CardTitle>
            <CardDescription>
              Reseña de planes completados o cerrados — toca uno para ver las tareas realizadas
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-2'>
            {pastPlans.map(p => (
              <PastPlanCard key={p.id} plan={p} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
