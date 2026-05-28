'use client'

import { useState, useEffect, useRef } from 'react'
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
  Activity,
  Upload,
  X,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface BackupInfo {
  id: string
  filename: string
  size: number
  createdAt: string
  type: 'manual' | 'automatic'
  status: 'completed' | 'failed' | 'in_progress'
  /** null = backup completo */
  module?: string | null
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

type RestoreModuleId =
  | 'tickets'
  | 'news'
  | 'patrols'
  | 'families'
  | 'users'
  | 'audits'
  | 'configurations'

const RESTORE_MODULES: { id: RestoreModuleId; label: string }[] = [
  { id: 'tickets', label: 'Tickets' },
  { id: 'news', label: 'Noticias' },
  { id: 'patrols', label: 'Rondas' },
  { id: 'families', label: 'Familias' },
  { id: 'users', label: 'Usuarios' },
  { id: 'audits', label: 'Auditorías' },
  { id: 'configurations', label: 'Configuraciones' },
]

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
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  /** Módulos seleccionados para restaurar. Vacío = restauración completa */
  const [selectedModules, setSelectedModules] = useState<RestoreModuleId[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const completedBackups = backups.filter(b => b.status === 'completed')

  useEffect(() => {
    if (selectedBackup && !completedBackups.find(b => b.id === selectedBackup.id)) {
      setSelectedBackup(null)
      setRestorePreview(null)
      setShowConfirmation(false)
      setSelectedModules([])
    }
  }, [completedBackups, selectedBackup])

  const loadRestorePreview = async (backup: BackupInfo) => {
    setPreviewLoading(true)
    setRestorePreview(null)

    try {
      const response = await fetch(`/api/admin/backups/${backup.id}/preview`)
      if (response.ok) {
        const result = await response.json()
        const preview: RestorePreview = {
          tables: Array.isArray(result.data?.tables)
            ? result.data.tables.map((table: any) => ({
                name: table?.name || 'Tabla sin nombre',
                recordCount: typeof table?.recordCount === 'number' ? table.recordCount : 0,
                size: table?.size || 'N/A',
              }))
            : [],
          totalRecords:
            typeof result.data?.totalRecords === 'number' ? result.data.totalRecords : 0,
          totalSize: result.data?.totalSize || 'N/A',
          databaseVersion: result.data?.databaseVersion || 'Desconocida',
          createdAt: result.data?.createdAt || backup.createdAt,
        }
        setRestorePreview(preview)
      } else {
        const fallbackPreview: RestorePreview = {
          tables: [{ name: 'backup_completo', recordCount: 1, size: formatFileSize(backup.size) }],
          totalRecords: 1,
          totalSize: formatFileSize(backup.size),
          databaseVersion: 'Información no disponible',
          createdAt: backup.createdAt,
        }
        setRestorePreview(fallbackPreview)
        toast({
          title: 'Vista previa limitada',
          description: 'No se pudo obtener información detallada, mostrando información básica',
          variant: 'warning',
        })
      }
    } catch {
      const fallbackPreview: RestorePreview = {
        tables: [{ name: 'backup_completo', recordCount: 1, size: formatFileSize(backup.size) }],
        totalRecords: 1,
        totalSize: formatFileSize(backup.size),
        databaseVersion: 'Error al obtener información',
        createdAt: backup.createdAt,
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
    setSelectedModules([])
    loadRestorePreview(backup)
  }

  const initiateRestore = () => setShowConfirmation(true)

  const confirmRestore = async () => {
    if (!selectedBackup) return
    setRestoring(true)
    setRestoreProgress(0)
    setShowConfirmation(false)

    try {
      const progressInterval = setInterval(() => {
        setRestoreProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + Math.random() * 10
        })
      }, 500)

      const body: Record<string, unknown> = {}
      if (selectedModules.length > 0) {
        body.modules = selectedModules
      }

      const response = await fetch(`/api/admin/backups/${selectedBackup.id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      clearInterval(progressInterval)
      setRestoreProgress(100)

      if (response.ok) {
        const scopeLabel =
          selectedModules.length === 0 ? 'completa' : `de ${selectedModules.length} módulo(s)`
        toast({
          title: 'Restauración Exitosa',
          description: `Restauración ${scopeLabel} completada correctamente`,
        })
        setTimeout(() => {
          setRestoring(false)
          setRestoreProgress(0)
          setSelectedBackup(null)
          setRestorePreview(null)
          setSelectedModules([])
          onRefresh()
        }, 2000)
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Error en la restauración')
      }
    } catch (error) {
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

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  const getSelectedModulesLabel = () => {
    if (selectedModules.length === 0) return 'toda la base de datos'
    const labels = selectedModules.map(id => RESTORE_MODULES.find(m => m.id === id)?.label || id)
    return labels.join(', ')
  }

  const toggleModule = (moduleId: RestoreModuleId) => {
    setSelectedModules(prev =>
      prev.includes(moduleId) ? prev.filter(m => m !== moduleId) : [...prev, moduleId]
    )
  }

  const selectAllModules = () => {
    setSelectedModules(RESTORE_MODULES.map(m => m.id))
  }

  const clearModules = () => {
    setSelectedModules([])
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setUploading(true)
    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      const response = await fetch('/api/admin/backups/import', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        toast({
          title: 'Backup Importado',
          description: 'El backup se ha importado correctamente',
        })
        setSelectedFile(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        onRefresh()
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Error al importar el backup')
      }
    } catch (error) {
      toast({
        title: 'Error al Importar',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  const clearSelectedFile = () => {
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  // Determinar si el backup seleccionado es parcial (solo un módulo) — no permite selección de scope
  const isPartialBackup = !!selectedBackup?.module

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div>
        <h2 className='text-2xl font-bold text-foreground'>Restauración de Backups</h2>
        <p className='text-muted-foreground'>Selecciona un backup y elige qué módulo restaurar</p>
      </div>

      {/* Sección de Importación */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center space-x-2 text-base'>
            <Upload className='h-4 w-4 text-primary' />
            <span>Importar Backup</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-4 transition-all ${
              isDragging
                ? 'border-primary bg-primary/10'
                : selectedFile
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type='file'
              accept='.sql,.sql.gz,.json,.json.gz,.enc'
              onChange={handleFileSelect}
              className='hidden'
            />
            <div className='flex flex-col sm:flex-row items-center justify-between gap-3'>
              <div className='flex items-center space-x-3'>
                <Upload
                  className={`h-5 w-5 ${isDragging ? 'text-primary animate-bounce' : 'text-muted-foreground'}`}
                />
                <div>
                  {selectedFile ? (
                    <div>
                      <p className='font-medium text-sm'>{selectedFile.name}</p>
                      <p className='text-xs text-muted-foreground'>
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className='font-medium text-sm'>
                        {isDragging
                          ? 'Suelta el archivo aquí'
                          : 'Arrastra y suelta un archivo aquí, o haz clic para seleccionar'}
                      </p>
                      <p className='text-xs text-muted-foreground mt-1'>
                        Formatos: .sql, .sql.gz, .json, .json.gz, .enc (cifrado)
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className='flex gap-2'>
                {selectedFile && (
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={e => {
                      e.stopPropagation()
                      clearSelectedFile()
                    }}
                  >
                    <X className='h-4 w-4 mr-1' />
                    Cancelar
                  </Button>
                )}
                {selectedFile && (
                  <Button
                    size='sm'
                    onClick={e => {
                      e.stopPropagation()
                      handleUpload()
                    }}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <>
                        <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2' />
                        Importando...
                      </>
                    ) : (
                      <>
                        <Upload className='h-4 w-4 mr-1' />
                        Importar
                      </>
                    )}
                  </Button>
                )}
                {!selectedFile && (
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={e => {
                      e.stopPropagation()
                      fileInputRef.current?.click()
                    }}
                  >
                    Seleccionar
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advertencia de Seguridad */}
      <Alert className='border-destructive/40 bg-destructive/10'>
        <AlertTriangle className='h-4 w-4 text-destructive' />
        <AlertDescription className='text-destructive'>
          <strong>¡Advertencia!</strong>{' '}
          {selectedModules.length === 0
            ? 'La restauración completa reemplazará todos los datos actuales de la base de datos. Esta acción no se puede deshacer.'
            : `La restauración selectiva reemplazará únicamente los datos de: ${getSelectedModulesLabel()}. Las demás tablas no se verán afectadas.`}{' '}
          Se recomienda crear un backup actual antes de proceder.
        </AlertDescription>
      </Alert>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {/* Lista de Backups Disponibles */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center space-x-2'>
              <Database className='h-5 w-5 text-primary' />
              <span>Backups Disponibles</span>
            </CardTitle>
            <CardDescription>Selecciona un backup para restaurar</CardDescription>
          </CardHeader>
          <CardContent>
            {completedBackups.length === 0 ? (
              <div className='text-center py-8 text-muted-foreground'>
                <Database className='h-8 w-8 mx-auto mb-2 text-muted-foreground' />
                <p className='text-sm'>No hay backups disponibles para restaurar</p>
              </div>
            ) : (
              <div className='space-y-3 max-h-96 overflow-y-auto'>
                {completedBackups.map(backup => (
                  <div
                    key={backup.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      selectedBackup?.id === backup.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-border hover:bg-muted'
                    }`}
                    onClick={() => handleBackupSelect(backup)}
                  >
                    <div className='flex items-center justify-between mb-2'>
                      <div className='flex items-center space-x-2'>
                        <Database className='h-4 w-4 text-muted-foreground' />
                        <span className='font-medium text-sm'>{backup.filename}</span>
                      </div>
                      <div className='flex items-center gap-1'>
                        {backup.module ? (
                          <Badge variant='secondary' className='text-xs'>
                            {backup.module}
                          </Badge>
                        ) : (
                          <Badge variant='outline' className='text-xs'>
                            Completo
                          </Badge>
                        )}
                        <Badge
                          variant={backup.type === 'manual' ? 'default' : 'secondary'}
                          className='text-xs'
                        >
                          {backup.type === 'manual' ? 'Manual' : 'Auto'}
                        </Badge>
                      </div>
                    </div>
                    <div className='flex items-center justify-between text-xs text-muted-foreground'>
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
            <CardTitle className='flex items-center space-x-2'>
              <Eye className='h-5 w-5 text-primary' />
              <span>Vista Previa de Restauración</span>
            </CardTitle>
            <CardDescription>Información del backup seleccionado</CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedBackup ? (
              <div className='text-center py-8 text-muted-foreground'>
                <Eye className='h-8 w-8 mx-auto mb-2 text-muted-foreground' />
                <p className='text-sm'>Selecciona un backup para ver la vista previa</p>
              </div>
            ) : previewLoading ? (
              <div className='text-center py-8'>
                <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2'></div>
                <p className='text-sm text-muted-foreground'>Cargando vista previa...</p>
              </div>
            ) : restorePreview ? (
              <div className='space-y-6'>
                {/* Información General */}
                <div className='grid grid-cols-2 gap-4'>
                  <div className='p-3 bg-muted/50 rounded-lg border border-border'>
                    <div className='text-sm font-medium text-foreground'>Total de Registros</div>
                    <div className='text-lg font-bold text-foreground'>
                      {typeof restorePreview.totalRecords === 'number'
                        ? restorePreview.totalRecords.toLocaleString()
                        : '0'}
                    </div>
                  </div>
                  <div className='p-3 bg-muted/50 rounded-lg border border-border'>
                    <div className='text-sm font-medium text-foreground'>Tamaño Total</div>
                    <div className='text-lg font-bold text-foreground'>
                      {restorePreview.totalSize || 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Selector de Módulos a Restaurar */}
                <div className='space-y-2'>
                  <label className='text-sm font-medium text-foreground'>
                    ¿Qué deseas restaurar?
                  </label>
                  {isPartialBackup ? (
                    <div className='p-3 bg-muted/50 rounded-lg border border-border'>
                      <p className='text-sm text-muted-foreground'>
                        Este backup contiene solo el módulo{' '}
                        <span className='font-medium text-foreground'>{selectedBackup.module}</span>
                        . Se restaurará únicamente ese módulo.
                      </p>
                    </div>
                  ) : (
                    <div className='space-y-2'>
                      <div className='flex items-center justify-between'>
                        <p className='text-xs text-muted-foreground'>
                          {selectedModules.length === 0
                            ? 'Sin selección = restauración completa'
                            : `${selectedModules.length} módulo(s) seleccionado(s)`}
                        </p>
                        <div className='flex gap-1'>
                          <Button
                            variant='ghost'
                            size='sm'
                            className='h-6 text-xs px-2'
                            onClick={selectAllModules}
                          >
                            Todos
                          </Button>
                          <Button
                            variant='ghost'
                            size='sm'
                            className='h-6 text-xs px-2'
                            onClick={clearModules}
                          >
                            Ninguno
                          </Button>
                        </div>
                      </div>
                      <div className='grid grid-cols-2 gap-2'>
                        {RESTORE_MODULES.map(mod => (
                          <label
                            key={mod.id}
                            className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors text-xs ${
                              selectedModules.includes(mod.id)
                                ? 'border-primary bg-primary/5 text-foreground'
                                : 'border-border hover:bg-muted text-muted-foreground'
                            }`}
                          >
                            <input
                              type='checkbox'
                              checked={selectedModules.includes(mod.id)}
                              onChange={() => toggleModule(mod.id)}
                              className='rounded border-border'
                            />
                            <span>{mod.label}</span>
                          </label>
                        ))}
                      </div>
                      {selectedModules.length === 0 && (
                        <p className='text-xs text-amber-600 dark:text-amber-400'>
                          ⚠ Sin módulos seleccionados se restaurará TODA la base de datos
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Tablas */}
                <div className='space-y-3'>
                  <h4 className='text-sm font-medium text-foreground'>Tablas en el backup:</h4>
                  {Array.isArray(restorePreview.tables) && restorePreview.tables.length > 0 ? (
                    <div className='space-y-2 max-h-32 overflow-y-auto'>
                      {restorePreview.tables.map((table, index) => (
                        <div
                          key={index}
                          className='flex items-center justify-between text-xs p-2 bg-muted rounded'
                        >
                          <span className='font-medium'>{table?.name || 'Tabla sin nombre'}</span>
                          <div className='flex items-center space-x-2 text-muted-foreground'>
                            <span>
                              {typeof table?.recordCount === 'number'
                                ? table.recordCount.toLocaleString()
                                : '0'}{' '}
                              registros
                            </span>
                            <span>•</span>
                            <span>{table?.size || 'N/A'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className='text-center py-4 text-muted-foreground'>
                      <p className='text-sm'>No se pudo obtener información de las tablas</p>
                    </div>
                  )}
                </div>

                {/* Botones de Acción */}
                <div className='flex items-center space-x-3 pt-4 border-t'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      const link = document.createElement('a')
                      link.href = `/api/admin/backups/${selectedBackup.id}/download`
                      link.download = selectedBackup.filename
                      link.click()
                    }}
                  >
                    <Download className='h-4 w-4 mr-2' />
                    Descargar
                  </Button>

                  <Button onClick={initiateRestore} disabled={restoring} variant='destructive'>
                    <RotateCcw className='h-4 w-4 mr-2' />
                    {isPartialBackup
                      ? `Restaurar ${selectedBackup.module}`
                      : selectedModules.length === 0
                        ? 'Restaurar Todo'
                        : `Restaurar ${selectedModules.length} módulo(s)`}
                  </Button>
                </div>
              </div>
            ) : (
              <div className='text-center py-8 text-muted-foreground'>
                <AlertTriangle className='h-8 w-8 mx-auto mb-2 text-destructive' />
                <p className='text-sm'>Error al cargar la vista previa del backup</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de Confirmación */}
      {showConfirmation && selectedBackup && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <Card className='w-full max-w-md mx-4'>
            <CardHeader>
              <CardTitle className='flex items-center space-x-2 text-destructive'>
                <AlertTriangle className='h-5 w-5' />
                <span>Confirmar Restauración</span>
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='p-4 bg-destructive/10 border border-destructive/30 rounded-lg'>
                <p className='text-sm text-destructive font-medium'>
                  ¡Esta acción no se puede deshacer!
                </p>
                <p className='text-sm text-muted-foreground mt-2'>
                  {selectedModules.length === 0 && !isPartialBackup
                    ? `Se restaurará el backup "${selectedBackup.filename}" y se reemplazarán TODOS los datos actuales de la base de datos.`
                    : `Se restaurarán los módulos: ${isPartialBackup ? selectedBackup.module : getSelectedModulesLabel()} del backup "${selectedBackup.filename}". Las demás tablas no se verán afectadas.`}
                </p>
              </div>

              <div className='flex items-center space-x-2 text-sm text-muted-foreground'>
                <Shield className='h-4 w-4' />
                <span>Se recomienda crear un backup actual antes de continuar</span>
              </div>

              <div className='flex justify-end space-x-3 pt-4'>
                <Button variant='outline' onClick={() => setShowConfirmation(false)}>
                  Cancelar
                </Button>
                <Button variant='destructive' onClick={confirmRestore}>
                  Confirmar Restauración
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de Progreso de Restauración */}
      {restoring && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <Card className='w-full max-w-md mx-4'>
            <CardHeader>
              <CardTitle className='flex items-center space-x-2'>
                <Activity className='h-5 w-5 text-primary animate-spin' />
                <span>Restaurando Base de Datos</span>
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='space-y-2'>
                <div className='flex justify-between text-sm'>
                  <span>Progreso de restauración</span>
                  <span>{Math.round(restoreProgress)}%</span>
                </div>
                <Progress value={restoreProgress} className='h-3' />
              </div>
              <div className='text-center text-sm text-muted-foreground'>
                <p>Por favor, no cierres esta ventana...</p>
                <p className='text-xs mt-1'>La restauración puede tomar varios minutos</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
