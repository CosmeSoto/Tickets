'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Database, 
  RotateCcw, 
  AlertTriangle, 
  Eye,
  Download,
  Shield,
  Activity
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface BackupInfo {
  id: string
  filename: string
  size: number
  createdAt: string
  type: 'manual' | 'automatic'
  status: 'completed' | 'failed' | 'in_progress'
}

interface RestorePreview {
  tables: Array<{
    name: string
    recordCount: number
    size: string
  }>
  totalRecords: number
  totalSize: string
  databaseVersion: string
  createdAt: string
}

interface BackupRestoreProps {
  backups: BackupInfo[]
  onRefresh: () => void
}

export function BackupRestore({ backups, onRefresh }: BackupRestoreProps) {
  const [selectedBackup, setSelectedBackup] = useState<BackupInfo | null>(null)
  const [restorePreview, setRestorePreview] = useState<RestorePreview | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [restoreProgress, setRestoreProgress] = useState(0)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const { toast } = useToast()

  const completedBackups = backups.filter(b => b.status === 'completed')

  // Limpiar estado si el backup seleccionado ya no existe
  useEffect(() => {
    if (selectedBackup && !completedBackups.find(b => b.id === selectedBackup.id)) {
      console.log('Backup seleccionado ya no existe, limpiando estado')
      setSelectedBackup(null)
      setRestorePreview(null)
      setShowConfirmation(false)
    }
  }, [completedBackups, selectedBackup])

  const loadRestorePreview = async (backup: BackupInfo) => {
    setPreviewLoading(true)
    setRestorePreview(null) // Limpiar estado anterior
    
    try {
      const response = await fetch(`/api/admin/backups/${backup.id}/preview`)
      if (response.ok) {
        const result = await response.json()
        
        // Validar y normalizar los datos recibidos con verificaciones más estrictas
        const preview: RestorePreview = {
          tables: Array.isArray(result.data?.tables) ? result.data.tables.map((table: any) => ({
            name: table?.name || 'Tabla sin nombre',
            recordCount: typeof table?.recordCount === 'number' ? table.recordCount : 0,
            size: table?.size || 'N/A'
          })) : [],
          totalRecords: typeof result.data?.totalRecords === 'number' ? result.data.totalRecords : 0,
          totalSize: result.data?.totalSize || 'N/A',
          databaseVersion: result.data?.databaseVersion || 'Desconocida',
          createdAt: result.data?.createdAt || backup.createdAt
        }
        
        setRestorePreview(preview)
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('Error response:', response.status, errorData)
        
        // Crear preview básico con información disponible
        const fallbackPreview: RestorePreview = {
          tables: [{
            name: 'backup_completo',
            recordCount: 1,
            size: formatFileSize(backup.size)
          }],
          totalRecords: 1,
          totalSize: formatFileSize(backup.size),
          databaseVersion: 'Información no disponible',
          createdAt: backup.createdAt
        }
        
        setRestorePreview(fallbackPreview)
        
        toast({
          title: 'Vista previa limitada',
          description: 'No se pudo obtener información detallada, mostrando información básica',
          variant: 'warning',
        })
      }
    } catch (error) {
      console.error('Error loading restore preview:', error)
      
      // Crear preview básico en caso de error
      const fallbackPreview: RestorePreview = {
        tables: [{
          name: 'backup_completo',
          recordCount: 1,
          size: formatFileSize(backup.size)
        }],
        totalRecords: 1,
        totalSize: formatFileSize(backup.size),
        databaseVersion: 'Error al obtener información',
        createdAt: backup.createdAt
      }
      
      setRestorePreview(fallbackPreview)
      
      toast({
        title: 'Error al cargar vista previa',
        description: 'Mostrando información básica del backup',
        variant: 'warning',
      })
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleBackupSelect = (backup: BackupInfo) => {
    setSelectedBackup(backup)
    setShowConfirmation(false)
    loadRestorePreview(backup)
  }

  const initiateRestore = () => {
    setShowConfirmation(true)
  }

  const confirmRestore = async () => {
    if (!selectedBackup) return

    setRestoring(true)
    setRestoreProgress(0)
    setShowConfirmation(false)

    try {
      // Simular progreso de restauración
      const progressInterval = setInterval(() => {
        setRestoreProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + Math.random() * 10
        })
      }, 500)

      const response = await fetch(`/api/admin/backups/${selectedBackup.id}/restore`, {
        method: 'POST',
      })

      clearInterval(progressInterval)
      setRestoreProgress(100)

      if (response.ok) {
        toast({
          title: 'Restauración Exitosa',
          description: 'La base de datos ha sido restaurada correctamente',
        })
        
        // Esperar un momento para mostrar el progreso completo
        setTimeout(() => {
          setRestoring(false)
          setRestoreProgress(0)
          setSelectedBackup(null)
          setRestorePreview(null)
          onRefresh()
        }, 2000)
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Error en la restauración')
      }
    } catch (error) {
      console.error('Error during restore:', error)
      toast({
        title: 'Error en la Restauración',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      })
      setRestoring(false)
      setRestoreProgress(0)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">Restauración de Backups</h2>
        <p className="text-muted-foreground">Restaura la base de datos desde un backup existente</p>
      </div>

      {/* Advertencia de Seguridad */}
      <Alert className="border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          <strong>¡Advertencia!</strong> La restauración de un backup reemplazará completamente 
          todos los datos actuales de la base de datos. Esta acción no se puede deshacer. 
          Se recomienda crear un backup actual antes de proceder.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lista de Backups Disponibles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Database className="h-5 w-5 text-blue-600" />
              <span>Backups Disponibles</span>
            </CardTitle>
            <CardDescription>
              Selecciona un backup para restaurar
            </CardDescription>
          </CardHeader>
          <CardContent>
            {completedBackups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Database className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm">No hay backups disponibles para restaurar</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {completedBackups.map(backup => (
                  <div
                    key={backup.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      selectedBackup?.id === backup.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-border hover:border-border hover:bg-muted'
                    }`}
                    onClick={() => handleBackupSelect(backup)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Database className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">{backup.filename}</span>
                      </div>
                      <Badge 
                        variant={backup.type === 'manual' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {backup.type === 'manual' ? 'Manual' : 'Automático'}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatFileSize(backup.size)}</span>
                      <span>{formatDate(backup.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vista Previa y Restauración */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Eye className="h-5 w-5 text-green-600" />
              <span>Vista Previa de Restauración</span>
            </CardTitle>
            <CardDescription>
              Información del backup seleccionado
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedBackup ? (
              <div className="text-center py-8 text-muted-foreground">
                <Eye className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm">Selecciona un backup para ver la vista previa</p>
              </div>
            ) : previewLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Cargando vista previa...</p>
              </div>
            ) : restorePreview && !previewLoading ? (
              <div className="space-y-6">
                {/* Información General */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="text-sm font-medium text-blue-800">Total de Registros</div>
                    <div className="text-lg font-bold text-blue-900">
                      {typeof restorePreview.totalRecords === 'number' 
                        ? restorePreview.totalRecords.toLocaleString() 
                        : '0'}
                    </div>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <div className="text-sm font-medium text-green-800">Tamaño Total</div>
                    <div className="text-lg font-bold text-green-900">
                      {restorePreview.totalSize || 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Información del Backup */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Versión de Base de Datos:</span>
                    <Badge variant="outline">{restorePreview.databaseVersion || 'Desconocida'}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Fecha de Creación:</span>
                    <span className="font-medium">
                      {restorePreview.createdAt ? formatDate(restorePreview.createdAt) : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Tablas */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-foreground">Tablas a Restaurar:</h4>
                  {Array.isArray(restorePreview.tables) && restorePreview.tables.length > 0 ? (
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {restorePreview.tables.map((table, index) => (
                        <div key={index} className="flex items-center justify-between text-xs p-2 bg-muted rounded">
                          <span className="font-medium">{table?.name || 'Tabla sin nombre'}</span>
                          <div className="flex items-center space-x-2 text-muted-foreground">
                            <span>
                              {typeof table?.recordCount === 'number' 
                                ? table.recordCount.toLocaleString() 
                                : '0'} registros
                            </span>
                            <span>•</span>
                            <span>{table?.size || 'N/A'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <p className="text-sm">No se pudo obtener información de las tablas</p>
                    </div>
                  )}
                </div>

                {/* Botones de Acción */}
                <div className="flex items-center space-x-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const link = document.createElement('a')
                      link.href = `/api/admin/backups/${selectedBackup.id}/download`
                      link.download = selectedBackup.filename
                      link.click()
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Descargar
                  </Button>
                  
                  <Button
                    onClick={initiateRestore}
                    disabled={restoring}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Restaurar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-red-400" />
                <p className="text-sm">Error al cargar la vista previa del backup</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de Confirmación */}
      {showConfirmation && selectedBackup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-red-700">
                <AlertTriangle className="h-5 w-5" />
                <span>Confirmar Restauración</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">
                  <strong>¡Esta acción no se puede deshacer!</strong>
                </p>
                <p className="text-sm text-red-700 mt-2">
                  Se restaurará el backup "{selectedBackup.filename}" y se perderán 
                  todos los datos actuales de la base de datos.
                </p>
              </div>
              
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                <span>Se recomienda crear un backup actual antes de continuar</span>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmation(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={confirmRestore}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Confirmar Restauración
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de Progreso de Restauración */}
      {restoring && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5 text-blue-600 animate-spin" />
                <span>Restaurando Base de Datos</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progreso de restauración</span>
                  <span>{Math.round(restoreProgress)}%</span>
                </div>
                <Progress value={restoreProgress} className="h-3" />
              </div>
              
              <div className="text-center text-sm text-muted-foreground">
                <p>Por favor, no cierres esta ventana...</p>
                <p className="text-xs mt-1">La restauración puede tomar varios minutos</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}