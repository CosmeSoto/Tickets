'use client'

/**
 * ModuleBlockersDialog
 *
 * Diálogo reutilizable que muestra el detalle de por qué no se puede
 * desactivar un módulo o cambiar el rol de un usuario.
 *
 * Se usa en:
 * - EditUserModal (cambio de módulos o rol desde el formulario de edición)
 * - DemoteTechnicianDialog (despromover técnico)
 * - TechnicianFormDialog (promover cliente)
 */

import { AlertTriangle, XCircle, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { ModuleBlocker } from '@/lib/services/user-module-guard.service'

interface ModuleBlockersDialogProps {
  open: boolean
  onClose: () => void
  userName: string
  /** ID del usuario bloqueado — usado para generar el enlace directo a sus programaciones */
  userId?: string
  blockers: ModuleBlocker[]
  /** 'module' = desactivación de módulo · 'role' = cambio de rol */
  context: 'module' | 'role'
}

export function ModuleBlockersDialog({
  open,
  onClose,
  userName,
  userId,
  blockers,
  context,
}: ModuleBlockersDialogProps) {
  const router = useRouter()
  const totalCount = blockers.reduce((sum, b) => sum + b.count, 0)
  const moduleNames = [...new Set(blockers.map(b => b.module))].join(', ')

  const title =
    context === 'role' ? 'No se puede cambiar el rol' : 'No se pueden desactivar los módulos'

  const summary =
    context === 'role'
      ? `No es posible cambiar el rol de ${userName}`
      : `No es posible desactivar módulos de ${userName}`

  const description =
    context === 'role'
      ? 'Tiene trabajo activo en los módulos habilitados. Debes resolver o reasignar todos los elementos pendientes antes de cambiar el rol.'
      : 'Tiene trabajo activo en los módulos que intentas desactivar. Debes resolver o reasignar todos los elementos pendientes antes de proceder.'

  // ¿Alguno de los bloqueadores es de Rondas?
  const hasPatrolBlocker = blockers.some(
    b => b.module.toLowerCase().includes('ronda') || b.module.toLowerCase().includes('patrull')
  )

  const goToSchedules = () => {
    onClose()
    const url = userId
      ? `/admin/patrols/schedules?agentId=${userId}&includeInactive=false`
      : '/admin/patrols/schedules'
    router.push(url)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2 text-destructive'>
            <XCircle className='h-5 w-5 shrink-0' />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className='space-y-4 py-1'>
          {/* Resumen */}
          <div className='rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 space-y-1'>
            <p className='text-sm font-semibold text-destructive'>{summary}</p>
            <p className='text-xs text-muted-foreground'>{description}</p>
            <p className='text-xs text-muted-foreground pt-0.5'>
              <span className='font-medium text-destructive'>{totalCount}</span> elemento
              {totalCount !== 1 ? 's' : ''} pendiente{totalCount !== 1 ? 's' : ''} en:{' '}
              <span className='font-medium'>{moduleNames}</span>
            </p>
          </div>

          {/* Lista de bloqueadores */}
          <div className='space-y-2 max-h-[40vh] overflow-y-auto pr-1'>
            {blockers.map((blocker, i) => (
              <div key={i} className='rounded-lg border border-border bg-background p-3 space-y-2'>
                {/* Módulo · conteo · razón */}
                <div className='flex items-start gap-2'>
                  <AlertTriangle className='h-4 w-4 text-destructive mt-0.5 shrink-0' />
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2 flex-wrap'>
                      <p className='text-sm font-semibold text-foreground'>{blocker.module}</p>
                      <span className='inline-flex items-center rounded-full bg-destructive/10 text-destructive px-2 py-0 text-[10px] font-semibold'>
                        {blocker.count} pendiente{blocker.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <p className='text-xs text-destructive mt-0.5'>{blocker.reason}</p>
                  </div>
                </div>

                {/* Instrucciones numeradas */}
                <ol className='space-y-1 pl-6 list-none'>
                  {blocker.instructions.map((step, j) => (
                    <li key={j} className='flex items-start gap-1.5 text-xs text-muted-foreground'>
                      <span className='mt-0.5 shrink-0 font-medium text-muted-foreground/70'>
                        {j + 1}.
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>

          {/* Acceso rápido a programaciones si hay bloqueadores de rondas */}
          {hasPatrolBlocker && (
            <div className='rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2.5'>
              <p className='text-xs text-amber-800 dark:text-amber-300 font-medium mb-2'>
                💡 Acceso rápido — Desactiva las programaciones de este agente directamente:
              </p>
              <Button
                size='sm'
                variant='outline'
                className='border-amber-400 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 gap-1.5 h-8 text-xs'
                onClick={goToSchedules}
              >
                <ExternalLink className='h-3.5 w-3.5' />
                Ir a Programación de Rondas (filtrado por este agente)
              </Button>
            </div>
          )}

          <p className='text-xs text-muted-foreground border-t pt-3'>
            Una vez resueltos todos los puntos, guarda los cambios nuevamente.
          </p>
        </div>

        <div className='flex justify-end pt-1'>
          <Button onClick={onClose}>Entendido</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
