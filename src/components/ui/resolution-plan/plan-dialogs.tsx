import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../alert-dialog'
import { PlanFormDialog } from './plan-form-dialog'
import type { ResolutionPlan, PlanFormData } from '@/hooks/use-resolution-plan'

interface PlanDialogsProps {
  showEditPlan: boolean
  setShowEditPlan: (show: boolean) => void
  showDeletePlan: boolean
  setShowDeletePlan: (show: boolean) => void
  taskToDelete: string | null
  setTaskToDelete: (id: string | null) => void
  planForm: PlanFormData
  setPlanForm: (form: PlanFormData | ((prev: PlanFormData) => PlanFormData)) => void
  plan: ResolutionPlan | null
  onUpdatePlan: () => void
  onDeletePlan: () => void
  onDeleteTask: (taskId: string) => void
}

export function PlanDialogs({
  showEditPlan,
  setShowEditPlan,
  showDeletePlan,
  setShowDeletePlan,
  taskToDelete,
  setTaskToDelete,
  planForm,
  setPlanForm,
  plan,
  onUpdatePlan,
  onDeletePlan,
  onDeleteTask,
}: PlanDialogsProps) {
  return (
    <>
      {/* Diálogo de edición del plan */}
      <AlertDialog open={showEditPlan} onOpenChange={setShowEditPlan}>
        <AlertDialogContent className='max-w-2xl'>
          <AlertDialogHeader>
            <AlertDialogTitle>Editar Plan de Resolución</AlertDialogTitle>
            <AlertDialogDescription>
              Actualiza la información del plan de resolución
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className='py-4'>
            <PlanFormDialog
              planForm={planForm}
              setPlanForm={setPlanForm}
              onSubmit={onUpdatePlan}
              onCancel={() => setShowEditPlan(false)}
              mode='edit'
            />
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de confirmación de eliminación del plan */}
      <AlertDialog open={showDeletePlan} onOpenChange={setShowDeletePlan}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar plan de resolución?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de eliminar el plan:{' '}
              <span className='font-semibold text-foreground'>&quot;{plan?.title}&quot;</span>
              <br />
              <br />
              Esta acción eliminará el plan y todas sus tareas permanentemente. No se puede
              deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDeletePlan}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              Eliminar Plan Completo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de confirmación de eliminación de tarea */}
      <AlertDialog open={!!taskToDelete} onOpenChange={open => !open && setTaskToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tarea?</AlertDialogTitle>
            <AlertDialogDescription>
              {taskToDelete && plan?.tasks.find(t => t.id === taskToDelete) && (
                <>
                  Estás a punto de eliminar la tarea:{' '}
                  <span className='font-semibold text-foreground'>
                    &quot;{plan.tasks.find(t => t.id === taskToDelete)?.title}&quot;
                  </span>
                  <br />
                  <br />
                  Esta acción no se puede deshacer. La tarea será eliminada permanentemente del plan
                  de resolución.
                </>
              )}
              {!taskToDelete ||
                (!plan?.tasks.find(t => t.id === taskToDelete) && (
                  <>
                    Esta acción no se puede deshacer. La tarea será eliminada permanentemente del
                    plan de resolución.
                  </>
                ))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => taskToDelete && onDeleteTask(taskToDelete)}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              Eliminar Tarea
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
