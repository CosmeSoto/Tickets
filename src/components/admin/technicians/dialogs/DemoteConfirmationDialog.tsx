/**
 * Diálogo de confirmación para convertir técnico a cliente
 * Autocontenido con validación de seguridad
 */

'use client'

import { useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
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
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, UserX, Users, Tag, CheckCircle, XCircle } from 'lucide-react'
import type { Technician, DemoteValidation } from '@/types/technicians'

interface Props {
  open: boolean
  technician: Technician | null
  validation: DemoteValidation | null
  onConfirm: () => Promise<void>
  onCancel: () => void
}

export function DemoteConfirmationDialog({
  open,
  technician,
  validation,
  onConfirm,
  onCancel
}: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  if (!technician || !validation) return null

  const handleConfirm = async () => {
    if (!validation.canDemote) {
      toast({
        title: 'No se puede convertir',
        description: validation.reason || 'El técnico tiene dependencias activas',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    try {
      await onConfirm()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo convertir el técnico a cliente',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onCancel}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center space-x-2">
            <UserX className="h-5 w-5 text-orange-600" />
            <span>¿Convertir técnico a cliente?</span>
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                ¿Estás seguro de que quieres convertir a{' '}
                <span className="font-semibold">{technician.name}</span>{' '}
                de técnico a cliente?
              </p>

              {/* Información del técnico */}
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Información del técnico:</span>
                  <Badge variant={technician.isActive ? 'default' : 'secondary'}>
                    {technician.isActive ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
                
                <div className="text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Email:</span>
                    <span className="font-mono text-xs">{technician.email}</span>
                  </div>
                  {technician.department && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Departamento:</span>
                      <Badge variant="outline" style={{ borderColor: technician.department.color }}>
                        {technician.department.name}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>

              {/* Validación de seguridad */}
              <div className="p-4 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-3">
                    Validación de seguridad:
                  </p>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {validation.assignedTickets === 0 ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className="text-sm">Tickets pendientes</span>
                      </div>
                      <Badge 
                        variant={validation.assignedTickets === 0 ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {validation.assignedTickets}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {validation.activeAssignments === 0 ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className="text-sm">Asignaciones activas</span>
                      </div>
                      <Badge 
                        variant={validation.activeAssignments === 0 ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {validation.activeAssignments}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Resultado de validación */}
              {!validation.canDemote ? (
                <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                        No se puede convertir a cliente
                      </p>
                      <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                        {validation.reason || 'El técnico tiene dependencias activas que deben resolverse primero.'}
                      </p>
                      <div className="text-xs text-red-600 dark:text-red-400">
                        <p className="font-medium mb-1">Acciones requeridas:</p>
                        <ul className="list-disc list-inside space-y-1">
                          {validation.assignedTickets > 0 && (
                            <li>Resolver o reasignar {validation.assignedTickets} ticket(s) pendiente(s)</li>
                          )}
                          {validation.activeAssignments > 0 && (
                            <li>Eliminar {validation.activeAssignments} asignación(es) de categoría activa(s)</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">
                        ✓ Listo para convertir
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        El técnico cumple con todos los requisitos para ser convertido a cliente.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Advertencia sobre la acción */}
              <div className="p-4 bg-yellow-50 dark:bg-yellow-950/50 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                      Advertencia: Esta acción es irreversible
                    </p>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      El usuario perderá todos los permisos de técnico y solo podrá crear y gestionar sus propios tickets.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading || !validation.canDemote}
            className="bg-orange-600 hover:bg-orange-700 focus:ring-orange-600"
          >
            {loading ? 'Convirtiendo...' : 'Convertir a Cliente'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}