'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { AlertTriangle, UserMinus, Loader2 } from 'lucide-react'
import { extractApiError, extractCatchError } from '@/lib/utils/api-error'
import { ModuleBlockersDialog } from '@/components/users/module-blockers-dialog'
import type { ModuleBlocker } from '@/lib/services/user-module-guard.service'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  technician: { id: string; name: string; email: string }
  onSuccess: () => void
}

interface ValidationResult {
  canDemote: boolean
  assignedTickets: number
  activeAssignments?: number
  blockers?: ModuleBlocker[]
  message: string
}

export function DemoteTechnicianDialog({ open, onOpenChange, technician, onSuccess }: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(true)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [blockers, setBlockers] = useState<ModuleBlocker[] | null>(null)

  useEffect(() => {
    if (open) {
      validateDemotion()
    } else {
      setValidation(null)
      setValidating(true)
      setBlockers(null)
    }
  }, [open, technician.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const validateDemotion = async () => {
    setValidating(true)
    try {
      const response = await fetch(`/api/users/${technician.id}/demote/validate`)
      const result = await response.json()

      if (response.ok) {
        setValidation(result)
      } else {
        setValidation({
          canDemote: false,
          assignedTickets: 0,
          message: result.error || 'Error al validar',
        })
      }
    } catch (err) {
      setValidation({
        canDemote: false,
        assignedTickets: 0,
        message: extractCatchError(err, 'Error de conexión al validar'),
      })
    } finally {
      setValidating(false)
    }
  }

  const handleDemote = async () => {
    if (!validation?.canDemote) return

    setLoading(true)
    try {
      const response = await fetch(`/api/users/${technician.id}/demote`, {
        method: 'POST',
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast({ title: 'Técnico despromovido', description: `${technician.name} ahora es cliente` })
        onSuccess()
        onOpenChange(false)
      } else if (response.status === 422 && result.blockers && Array.isArray(result.blockers)) {
        // El guard detectó trabajo activo — mostrar diálogo detallado
        const total = (result.blockers as ModuleBlocker[]).reduce(
          (s: number, b: ModuleBlocker) => s + b.count,
          0
        )
        const names = [
          ...new Set((result.blockers as ModuleBlocker[]).map((b: ModuleBlocker) => b.module)),
        ].join(', ')
        toast({
          title: 'No se puede despromover',
          description: `${technician.name} tiene ${total} elemento${total !== 1 ? 's' : ''} pendiente${total !== 1 ? 's' : ''} en: ${names}.`,
          variant: 'destructive',
          duration: 6000,
        })
        setBlockers(result.blockers as ModuleBlocker[])
      } else {
        toast({
          title: 'Error al despromover',
          description: extractApiError(result),
          variant: 'destructive',
        })
      }
    } catch (err) {
      toast({
        title: 'Error de conexión',
        description: extractCatchError(err),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className='flex items-center space-x-2'>
              <UserMinus className='h-5 w-5 text-orange-600' />
              <AlertDialogTitle>¿Despromover a Cliente?</AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div>
                {validating ? (
                  <div className='flex items-center justify-center py-6'>
                    <Loader2 className='h-6 w-6 animate-spin text-blue-600' />
                    <span className='ml-2 text-muted-foreground'>Validando...</span>
                  </div>
                ) : validation === null ? (
                  <span className='text-muted-foreground'>Error al cargar validación</span>
                ) : validation.canDemote ? (
                  <div className='space-y-3'>
                    <p>
                      ¿Estás seguro de que deseas despromover a <strong>{technician.name}</strong> (
                      {technician.email}) a cliente?
                    </p>
                    <div className='bg-orange-50 border border-orange-200 rounded-lg p-3'>
                      <p className='text-sm text-orange-900 font-medium mb-2'>
                        El usuario perderá:
                      </p>
                      <ul className='list-disc list-inside text-sm text-orange-800 space-y-1'>
                        <li>Acceso al panel de técnico</li>
                        <li>Capacidad de gestionar tickets</li>
                        <li>Asignaciones de categorías</li>
                        <li>Permisos de técnico</li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  // No puede despromover — mostrar resumen compacto con indicación de abrir detalle
                  <div className='flex items-start space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg'>
                    <AlertTriangle className='h-5 w-5 text-red-600 mt-0.5 flex-shrink-0' />
                    <div className='flex-1'>
                      <h4 className='font-medium text-red-900'>No se puede despromover</h4>
                      <p className='text-sm text-red-700 mt-1'>{validation.message}</p>
                      {validation.blockers && validation.blockers.length > 0 && (
                        <button
                          type='button'
                          className='mt-2 text-xs text-red-800 underline underline-offset-2 hover:text-red-900'
                          onClick={() => setBlockers(validation.blockers!)}
                        >
                          Ver detalle y pasos a seguir →
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>
              {validation?.canDemote ? 'Cancelar' : 'Cerrar'}
            </AlertDialogCancel>
            {validation?.canDemote && (
              <AlertDialogAction
                onClick={handleDemote}
                disabled={loading}
                className='bg-orange-600 hover:bg-orange-700'
              >
                {loading ? 'Despromoviendo...' : 'Despromover a Cliente'}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo detallado de bloqueadores (si el guard detecta trabajo activo en el POST) */}
      {blockers && (
        <ModuleBlockersDialog
          open={!!blockers}
          onClose={() => setBlockers(null)}
          userName={technician.name}
          blockers={blockers}
          context='role'
        />
      )}
    </>
  )
}
