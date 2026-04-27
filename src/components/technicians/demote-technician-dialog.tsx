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

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  technician: { id: string; name: string; email: string }
  onSuccess: () => void
}

interface ValidationResult {
  canDemote: boolean
  assignedTickets: number
  message: string
}

export function DemoteTechnicianDialog({ open, onOpenChange, technician, onSuccess }: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(true)
  const [validation, setValidation] = useState<ValidationResult | null>(null)

  useEffect(() => {
    if (open) {
      validateDemotion()
    } else {
      setValidation(null)
      setValidating(true)
    }
  }, [open, technician.id])

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
          message: result.error || 'Error al validar'
        })
      }
    } catch (err) {
      setValidation({ canDemote: false, assignedTickets: 0, message: extractCatchError(err, 'Error de conexión al validar') })
    } finally {
      setValidating(false)
    }
  }

  const handleDemote = async () => {
    if (!validation?.canDemote) return

    setLoading(true)
    try {
      const response = await fetch(`/api/users/${technician.id}/demote`, {
        method: 'POST'
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast({ title: 'Técnico despromovido', description: `${technician.name} ahora es cliente` })
        onSuccess()
        onOpenChange(false)
      } else {
        toast({ title: 'Error al despromover', description: extractApiError(result), variant: 'destructive' })
      }
    } catch (err) {
      toast({ title: 'Error de conexión', description: extractCatchError(err), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center space-x-2">
            <UserMinus className="h-5 w-5 text-orange-600" />
            <AlertDialogTitle>¿Despromover a Cliente?</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div>
              {validating ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  <span className="ml-2 text-muted-foreground">Validando...</span>
                </div>
              ) : validation === null ? (
                <span className="text-muted-foreground">Error al cargar validación</span>
              ) : validation.canDemote ? (
                <div className="space-y-3">
                  <p>
                    ¿Estás seguro de que deseas despromover a <strong>{technician.name}</strong> ({technician.email}) a cliente?
                  </p>
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <p className="text-sm text-orange-900 font-medium mb-2">El usuario perderá:</p>
                    <ul className="list-disc list-inside text-sm text-orange-800 space-y-1">
                      <li>Acceso al panel de técnico</li>
                      <li>Capacidad de gestionar tickets</li>
                      <li>Asignaciones de categorías</li>
                      <li>Permisos de técnico</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="flex items-start space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="font-medium text-red-900">No se puede despromover</h4>
                    <p className="text-sm text-red-700 mt-1">{validation.message}</p>
                    {validation.assignedTickets > 0 && (
                      <div className="mt-3 p-2 bg-red-100 rounded">
                        <p className="text-sm text-red-800">
                          <strong>Tickets asignados:</strong> {validation.assignedTickets}
                        </p>
                        <p className="text-xs text-red-700 mt-1">
                          Reasigna o cierra estos tickets antes de despromover
                        </p>
                      </div>
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
              className="bg-orange-600 hover:bg-orange-700"
            >
              {loading ? 'Despromoviendo...' : 'Despromover a Cliente'}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
