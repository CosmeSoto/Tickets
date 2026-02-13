/**
 * Diálogo de confirmación para eliminar técnicos
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
import { AlertTriangle, Trash2, Users, Tag } from 'lucide-react'
import type { Technician } from '@/types/technicians'
import { canDeleteTechnician } from '../TechnicianManagement.module'

interface Props {
  open: boolean
  technician: Technician | null
  onConfirm: () => Promise<void>
  onCancel: () => void
}

export function DeleteConfirmationDialog({
  open,
  technician,
  onConfirm,
  onCancel
}: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  if (!technician) return null

  const deleteValidation = canDeleteTechnician(technician)

  const handleConfirm = async () => {
    if (!deleteValidation.canDelete) {
      toast({
        title: 'No se puede eliminar',
        description: deleteValidation.reason,
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
        description: 'No se pudo eliminar el técnico',
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
            <Trash2 className="h-5 w-5 text-red-600" />
            <span>¿Eliminar técnico?</span>
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                ¿Estás seguro de que quieres eliminar permanentemente al técnico{' '}
                <span className="font-semibold">{technician.name}</span>?
              </p>

              {/* Información del técnico */}
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Información del técnico:</span>
                  <Badge variant={technician.isActive ? 'default' : 'secondary'}>
                    {technician.isActive ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-blue-600" />
                    <span>Tickets asignados: {deleteValidation.assignedTickets}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Tag className="h-4 w-4 text-purple-600" />
                    <span>Asignaciones: {deleteValidation.activeAssignments}</span>
                  </div>
                </div>

                {technician.department && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Departamento: </span>
                    <Badge variant="outline" style={{ borderColor: technician.department.color }}>
                      {technician.department.name}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Validación de eliminación */}
              {!deleteValidation.canDelete && (
                <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                        No se puede eliminar este técnico
                      </p>
                      <p className="text-sm text-red-700 dark:text-red-300">
                        {deleteValidation.reason}
                      </p>
                      <div className="mt-3 text-xs text-red-600 dark:text-red-400">
                        <p className="font-medium mb-1">Acciones requeridas:</p>
                        <ul className="list-disc list-inside space-y-1">
                          {deleteValidation.assignedTickets > 0 && (
                            <li>Resolver o reasignar todos los tickets pendientes</li>
                          )}
                          {deleteValidation.activeAssignments > 0 && (
                            <li>Eliminar todas las asignaciones de categorías</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {deleteValidation.canDelete && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-950/50 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                        Advertencia: Esta acción es irreversible
                      </p>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        Se eliminará permanentemente toda la información del técnico, 
                        incluyendo su historial y configuraciones.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading || !deleteValidation.canDelete}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {loading ? 'Eliminando...' : 'Eliminar Técnico'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}