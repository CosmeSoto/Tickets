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

import { useState } from 'react'
import { AlertTriangle, XCircle, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import type { ModuleBlocker } from '@/lib/services/user-module-guard.service'

interface ModuleBlockersDialogProps {
  open: boolean
  onClose: () => void
  userName: string
  /** ID del usuario bloqueado */
  userId?: string
  blockers: ModuleBlocker[]
  /** 'module' = desactivación de módulo · 'role' = cambio de rol */
  context: 'module' | 'role'
  /** Callback que se llama tras limpiar exitosamente las rondas, para reintentar el guardado */
  onPatrolsCleared?: () => void
}

export function ModuleBlockersDialog({
  open,
  onClose,
  userName,
  userId,
  blockers,
  context,
  onPatrolsCleared,
}: ModuleBlockersDialogProps) {
  const { toast } = useToast()
  const [clearing, setClearing] = useState(false)
  const [cleared, setCleared] = useState(false)

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

  // Módulos que se pueden resolver automáticamente
  const RESOLVABLE_MODULES = [
    'ronda',
    'patrull',
    'tickets',
    'categor',
    'asignacion',
    'solicitud',
    'activo',
  ]

  const resolvableBlockers = blockers.filter(b =>
    RESOLVABLE_MODULES.some(keyword => b.module.toLowerCase().includes(keyword))
  )
  const hasResolvableBlockers = resolvableBlockers.length > 0 && !!userId
  const allBlockersResolvable = resolvableBlockers.length === blockers.length

  // No ofrecer resolución automática para Inventario (requiere acta) ni Tickets de cliente (requiere revisión)
  const NON_RESOLVABLE_KEYWORDS = ['inventario']
  const nonResolvableBlockers = blockers.filter(
    b =>
      NON_RESOLVABLE_KEYWORDS.some(keyword => b.module.toLowerCase().includes(keyword)) ||
      b.reason.toLowerCase().includes('solicitante')
  )

  const handleClearBlockers = async () => {
    if (!userId) return
    setClearing(true)
    try {
      const moduleNames = resolvableBlockers.map(b => b.module)
      const res = await fetch(`/api/users/${userId}/clear-blockers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modules: moduleNames }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al resolver los pendientes')

      setCleared(true)
      toast({
        title: 'Pendientes resueltos',
        description: data.message,
        variant: 'success',
      })

      // Si TODOS los bloqueadores eran resolubles, cerrar y reintentar guardado
      if (allBlockersResolvable && onPatrolsCleared) {
        setTimeout(() => {
          onClose()
          setCleared(false)
          onPatrolsCleared()
        }, 1200)
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al resolver los pendientes',
        variant: 'destructive',
      })
    } finally {
      setClearing(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={v => {
        if (!v && !clearing) {
          onClose()
          setCleared(false)
        }
      }}
    >
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
          <div className='space-y-2 max-h-[35vh] overflow-y-auto pr-1'>
            {blockers.map((blocker, i) => (
              <div key={i} className='rounded-lg border border-border bg-background p-3 space-y-2'>
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

          {/* ── Solución rápida para bloqueadores resolubles ── */}
          {hasResolvableBlockers && (
            <div className='rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-3 space-y-2'>
              <p className='text-xs font-semibold text-amber-800 dark:text-amber-300'>
                ⚡ Solución rápida
              </p>
              <p className='text-xs text-amber-700 dark:text-amber-400'>
                Resuelve automáticamente los pendientes de <strong>{userName}</strong>: desactiva
                programaciones de rondas, cancela rondas pendientes, desasigna tickets, y elimina
                asignaciones de categorías. Esta acción es reversible.
                {nonResolvableBlockers.length > 0 && (
                  <>
                    {' '}
                    Los elementos de{' '}
                    <strong>{nonResolvableBlockers.map(b => b.module).join(', ')}</strong> requieren
                    resolución manual.
                  </>
                )}
              </p>

              {cleared ? (
                <div className='flex items-center gap-2 text-green-700 dark:text-green-400 text-sm font-medium'>
                  <CheckCircle2 className='h-4 w-4' />
                  {allBlockersResolvable
                    ? 'Listo. Guardando el cambio de rol...'
                    : 'Pendientes resueltos. Resuelve los demás elementos y guarda nuevamente.'}
                </div>
              ) : (
                <Button
                  size='sm'
                  className='bg-amber-600 hover:bg-amber-700 text-white gap-2 h-9 text-xs'
                  onClick={handleClearBlockers}
                  disabled={clearing}
                >
                  {clearing ? (
                    <Loader2 className='h-3.5 w-3.5 animate-spin' />
                  ) : (
                    <CheckCircle2 className='h-3.5 w-3.5' />
                  )}
                  {clearing ? 'Resolviendo...' : 'Resolver pendientes automáticamente'}
                </Button>
              )}
            </div>
          )}

          <p className='text-xs text-muted-foreground border-t pt-3'>
            {cleared && allBlockersResolvable
              ? '✅ El cambio de rol se procesará automáticamente.'
              : 'Una vez resueltos todos los puntos, guarda los cambios nuevamente.'}
          </p>
        </div>

        <div className='flex justify-end pt-1'>
          <Button
            onClick={() => {
              if (!clearing) {
                onClose()
                setCleared(false)
              }
            }}
            disabled={clearing}
          >
            {cleared && !allBlockersResolvable ? 'Cerrar' : 'Entendido'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
