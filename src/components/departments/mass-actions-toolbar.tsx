'use client'

import { useState } from 'react'
import { 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Download, 
  RefreshCw,
  AlertTriangle,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

interface DepartmentMassActionsToolbarProps {
  selectedCount: number
  isProcessing: boolean
  processingAction: string | null
  onBulkDelete: () => Promise<void>
  onBulkActivate: () => Promise<void>
  onBulkDeactivate: () => Promise<void>
  onBulkExport: () => Promise<void>
  onClearSelection: () => void
}

export function DepartmentMassActionsToolbar({
  selectedCount,
  isProcessing,
  processingAction,
  onBulkDelete,
  onBulkActivate,
  onBulkDeactivate,
  onBulkExport,
  onClearSelection,
}: DepartmentMassActionsToolbarProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const handleBulkDelete = async () => {
    await onBulkDelete()
    setShowDeleteDialog(false)
  }

  if (selectedCount === 0) return null

  return (
    <>
      <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center space-x-3">
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            {selectedCount} departamento{selectedCount !== 1 ? 's' : ''} seleccionado{selectedCount !== 1 ? 's' : ''}
          </Badge>
          
          {isProcessing && (
            <div className="flex items-center space-x-2 text-blue-600">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="text-sm">
                {processingAction === 'bulkDelete' && 'Eliminando...'}
                {processingAction === 'bulkActivate' && 'Activando...'}
                {processingAction === 'bulkDeactivate' && 'Desactivando...'}
                {processingAction === 'bulkExport' && 'Exportando...'}
                {!processingAction && 'Procesando...'}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Acciones masivas */}
          <Button
            variant="outline"
            size="sm"
            onClick={onBulkActivate}
            disabled={isProcessing}
            className="text-green-600 hover:text-green-700 hover:bg-green-50"
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            Activar
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onBulkDeactivate}
            disabled={isProcessing}
            className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
          >
            <XCircle className="h-4 w-4 mr-1" />
            Desactivar
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onBulkExport}
            disabled={isProcessing}
            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          >
            <Download className="h-4 w-4 mr-1" />
            Exportar
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            disabled={isProcessing}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Eliminar
          </Button>

          {/* Limpiar selección */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            disabled={isProcessing}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Dialog de confirmación para eliminar */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span>Confirmar eliminación masiva</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar {selectedCount} departamento{selectedCount !== 1 ? 's' : ''}?
              
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium mb-1">Advertencia:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Solo se eliminarán departamentos sin técnicos ni categorías asignadas</li>
                      <li>Esta acción no se puede deshacer</li>
                      <li>Los departamentos con dependencias serán omitidos</li>
                    </ul>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isProcessing}
              className="bg-red-600 hover:bg-red-700"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar {selectedCount} departamento{selectedCount !== 1 ? 's' : ''}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}