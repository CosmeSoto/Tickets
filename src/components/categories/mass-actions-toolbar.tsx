'use client'

import { useState } from 'react'
import { 
  Trash2, 
  Edit, 
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { CategoryData } from '@/hooks/use-categories'

interface MassActionsToolbarProps {
  selectedCount: number
  selectedItems: CategoryData[]
  isProcessing: boolean
  processingAction: string | null
  onBulkDelete: () => Promise<void>
  onBulkActivate: () => Promise<void>
  onBulkDeactivate: () => Promise<void>
  onBulkExport: () => Promise<void>
  onClearSelection: () => void
  getSelectionSummary: () => string
}

export function MassActionsToolbar({
  selectedCount,
  selectedItems,
  isProcessing,
  processingAction,
  onBulkDelete,
  onBulkActivate,
  onBulkDeactivate,
  onBulkExport,
  onClearSelection,
  getSelectionSummary,
}: MassActionsToolbarProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false)

  if (selectedCount === 0) return null

  const deletableItems = selectedItems.filter(item => item.canDelete)
  const activatableItems = selectedItems.filter(item => !item.isActive)
  const deactivatableItems = selectedItems.filter(item => item.isActive)

  const handleBulkDelete = async () => {
    setShowDeleteDialog(false)
    await onBulkDelete()
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'bulkDelete': return <Trash2 className="h-3 w-3" />
      case 'bulkActivate': return <CheckCircle className="h-3 w-3" />
      case 'bulkDeactivate': return <XCircle className="h-3 w-3" />
      case 'bulkExport': return <Download className="h-3 w-3" />
      default: return <RefreshCw className="h-3 w-3" />
    }
  }

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'bulkDelete': return 'Eliminando'
      case 'bulkActivate': return 'Activando'
      case 'bulkDeactivate': return 'Desactivando'
      case 'bulkExport': return 'Exportando'
      default: return 'Procesando'
    }
  }

  return (
    <>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              {selectedCount} seleccionado{selectedCount !== 1 ? 's' : ''}
            </Badge>
            <span className="text-sm text-blue-700">
              {getSelectionSummary()}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {/* Botón de eliminar */}
            {deletableItems.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isProcessing}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                {isProcessing && processingAction === 'bulkDelete' ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar ({deletableItems.length})
                  </>
                )}
              </Button>
            )}

            {/* Botón de activar */}
            {activatableItems.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkActivate}
                disabled={isProcessing}
                className="text-green-600 hover:text-green-700 hover:bg-green-50"
              >
                {isProcessing && processingAction === 'bulkActivate' ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Activando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Activar ({activatableItems.length})
                  </>
                )}
              </Button>
            )}

            {/* Botón de desactivar */}
            {deactivatableItems.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkDeactivate}
                disabled={isProcessing}
                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
              >
                {isProcessing && processingAction === 'bulkDeactivate' ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Desactivando...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Desactivar ({deactivatableItems.length})
                  </>
                )}
              </Button>
            )}

            {/* Botón de exportar */}
            <Button
              variant="outline"
              size="sm"
              onClick={onBulkExport}
              disabled={isProcessing}
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            >
              {isProcessing && processingAction === 'bulkExport' ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </>
              )}
            </Button>

            {/* Botón de limpiar selección */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              disabled={isProcessing}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4 mr-2" />
              Limpiar
            </Button>
          </div>
        </div>

        {/* Indicador de procesamiento */}
        {isProcessing && processingAction && (
          <div className="mt-3 flex items-center space-x-2 text-sm text-blue-600">
            {getActionIcon(processingAction)}
            <span>{getActionLabel(processingAction)} {selectedCount} elemento{selectedCount !== 1 ? 's' : ''}...</span>
          </div>
        )}
      </div>

      {/* Dialog de confirmación para eliminar */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span>¿Eliminar categorías seleccionadas?</span>
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Estás a punto de eliminar <strong>{deletableItems.length}</strong> categoría{deletableItems.length !== 1 ? 's' : ''}.
                </p>
                
                {selectedItems.length > deletableItems.length && (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-amber-800 text-sm">
                      <strong>Nota:</strong> {selectedItems.length - deletableItems.length} categoría{selectedItems.length - deletableItems.length !== 1 ? 's' : ''} no se puede{selectedItems.length - deletableItems.length === 1 ? '' : 'n'} eliminar porque tiene{selectedItems.length - deletableItems.length === 1 ? '' : 'n'} tickets o subcategorías asociadas.
                    </p>
                  </div>
                )}

                <div className="max-h-32 overflow-y-auto">
                  <p className="text-sm font-medium mb-2">Categorías a eliminar:</p>
                  <ul className="text-sm space-y-1">
                    {deletableItems.slice(0, 5).map(item => (
                      <li key={item.id} className="flex items-center space-x-2">
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: item.color }}
                        />
                        <span>{item.name} ({item.levelName})</span>
                      </li>
                    ))}
                    {deletableItems.length > 5 && (
                      <li className="text-muted-foreground">
                        ... y {deletableItems.length - 5} más
                      </li>
                    )}
                  </ul>
                </div>

                <p className="text-red-600 font-medium">
                  Esta acción no se puede deshacer.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isProcessing || deletableItems.length === 0}
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
                  Eliminar {deletableItems.length} categoría{deletableItems.length !== 1 ? 's' : ''}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}