'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
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
import { BackupOperationsHistory } from '@/components/backups/backup-restore-history'
import { BackupSectionToolbar } from '@/components/backups/backup-section-toolbar'

const PENDING_PG_RESTORE_KEY = 'tickets-pgbackrest-restore-pending'
/** Máximo tiempo para reanudar polling tras recarga durante mantenimiento */
const PENDING_PG_RESTORE_MAX_MS = 25 * 60 * 1000

type PendingPgRestore = {
  backupId: string
  filename: string
  label?: string | null
  startedAt: string
}

interface BackupInfo {
  id: string
  filename: string
  size: number
  createdAt: string
  type: 'manual' | 'automatic'
  status: 'completed' | 'failed' | 'in_progress'
  engine?: 'pgbackrest' | 'export' | 'import'
  backupKind?: string
  label?: string | null
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
  | 'inventory'
  | 'credentials'
  | 'processes'
  | 'access'
  | 'forms'

type RestoreMode = 'replace' | 'merge'

const RESTORE_MODULES: { id: RestoreModuleId; label: string }[] = [
  { id: 'tickets', label: 'Tickets' },
  { id: 'news', label: 'Noticias' },
  { id: 'patrols', label: 'Rondas' },
  { id: 'families', label: 'Familias' },
  { id: 'users', label: 'Usuarios' },
  { id: 'audits', label: 'Auditorías' },
  { id: 'configurations', label: 'Configuraciones' },
  { id: 'inventory', label: 'Inventario' },
  {
    id: 'credentials',
    label: 'Credenciales (secretos cifrados)',
  },
  { id: 'processes', label: 'Procesos y Procedimientos' },
  { id: 'access', label: 'Accesos' },
  { id: 'forms', label: 'Documentos' },
]

interface BackupRestoreProps {
  backups: BackupInfo[]
  onRefresh: () => void
  onOpenBackupsTab?: () => void
}

export function BackupRestore({ backups, onRefresh, onOpenBackupsTab }: BackupRestoreProps) {
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
  /** Modo de restauración: replace (reemplazar) o merge (fusionar/agregar) */
  const [restoreMode, setRestoreMode] = useState<RestoreMode>('merge')
  const [allowPgBackRestRestore, setAllowPgBackRestRestore] = useState(false)
  const [maintenanceMessage, setMaintenanceMessage] = useState<string | null>(null)
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  /** Evita que el toast de éxito de pgBackRest se dispare dos veces en la misma sesión */
  const pgRestoreToastShownRef = useRef(false)
  const { toast } = useToast()
  const [restoreSearch, setRestoreSearch] = useState('')

  const completedBackups = useMemo(() => backups.filter(b => b.status === 'completed'), [backups])

  const filteredRestoreBackups = useMemo(() => {
    const q = restoreSearch.trim().toLowerCase()
    if (!q) return completedBackups
    return completedBackups.filter(
      b =>
        b.filename.toLowerCase().includes(q) ||
        (b.label ?? '').toLowerCase().includes(q) ||
        (b.engine ?? '').toLowerCase().includes(q) ||
        (b.module ?? '').toLowerCase().includes(q) ||
        (b.type === 'manual' ? 'manual' : 'automático').includes(q)
    )
  }, [completedBackups, restoreSearch])

  useEffect(() => {
    fetch('/api/admin/backups/config')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data && typeof data.allowRestore === 'boolean') {
          setAllowPgBackRestRestore(data.allowRestore)
        }
      })
      .catch(() => {})
  }, [])

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  const savePendingPgRestore = (pending: PendingPgRestore) => {
    try {
      sessionStorage.setItem(PENDING_PG_RESTORE_KEY, JSON.stringify(pending))
    } catch {
      // sessionStorage no disponible
    }
  }

  const clearPendingPgRestore = () => {
    try {
      sessionStorage.removeItem(PENDING_PG_RESTORE_KEY)
    } catch {
      // ignore
    }
  }

  const readPendingPgRestore = (): PendingPgRestore | null => {
    try {
      const raw = sessionStorage.getItem(PENDING_PG_RESTORE_KEY)
      if (!raw) return null
      return JSON.parse(raw) as PendingPgRestore
    } catch {
      return null
    }
  }

  const showPgRestoreSuccessToast = (label?: string | null) => {
    if (pgRestoreToastShownRef.current) return
    pgRestoreToastShownRef.current = true
    toast({
      title: 'Restauración pgBackRest completada',
      description: label
        ? `El cluster PostgreSQL fue restaurado desde ${label} y los servicios están activos.`
        : 'El cluster PostgreSQL fue restaurado y los servicios están activos de nuevo.',
      variant: 'success',
      duration: 12000,
    })
  }

  const finalizePgRestoreUi = () => {
    clearPendingPgRestore()
    pgRestoreToastShownRef.current = false
    setHistoryRefreshKey(k => k + 1)
    setTimeout(() => {
      setRestoring(false)
      setRestoreProgress(0)
      setMaintenanceMessage(null)
      setSelectedBackup(null)
      setRestorePreview(null)
      setSelectedModules([])
      setRestoreMode('merge')
      onRefresh()
    }, 1500)
  }

  useEffect(() => {
    if (selectedBackup && !completedBackups.find(b => b.id === selectedBackup.id)) {
      setSelectedBackup(null)
      setRestorePreview(null)
      setShowConfirmation(false)
      setSelectedModules([])
      setRestoreMode('merge')
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
    setRestoreMode('merge')
    loadRestorePreview(backup)
  }

  const initiateRestore = () => setShowConfirmation(true)

  const parseJsonResponse = async (response: Response) => {
    const text = await response.text()
    if (!text) return {}
    try {
      return JSON.parse(text) as Record<string, unknown>
    } catch {
      throw new Error(
        response.status >= 500
          ? 'El servidor dejó de responder durante la operación. Revisa los logs del backup-worker en el servidor.'
          : 'Respuesta inválida del servidor (se esperaba JSON)'
      )
    }
  }

  const checkPgBackRestRestoreOutcome = async () => {
    const res = await fetch('/api/admin/backups/restore-status', { cache: 'no-store' })
    const data = await parseJsonResponse(res)
    if (!res.ok) {
      throw new Error(String(data.error || 'No se pudo verificar el estado de la restauración'))
    }
    const job = data.job as
      | { status?: string; message?: string | null; label?: string | null }
      | undefined
    if (job?.status === 'failed') {
      throw new Error(job.message || 'La restauración pgBackRest falló')
    }
    if (job?.status === 'success') {
      return job
    }
    if (job?.status === 'running') {
      return null
    }
    if (job?.status === 'idle' || !job?.status) {
      clearPendingPgRestore()
      throw new Error('No hay restauración pgBackRest en curso en el servidor.')
    }
    return job
  }

  const pollPgBackRestRestoreOutcome = async (maxMs = 20 * 60 * 1000) => {
    const start = Date.now()
    while (Date.now() - start < maxMs) {
      try {
        const job = await checkPgBackRestRestoreOutcome()
        if (job?.status === 'success') {
          return job
        }
      } catch (error) {
        if (!isFetchNetworkError(error)) {
          throw error
        }
      }

      try {
        const sessionRes = await fetch('/api/auth/session', { cache: 'no-store' })
        if (sessionRes.ok) {
          setRestoreProgress(prev => Math.min(Math.max(prev, 55), 90))
        }
      } catch {
        // sitio aún fuera de línea
      }

      await sleep(5000)
    }
    throw new Error(
      'Tiempo de espera agotado. Revisa el historial de restauraciones o los logs: docker compose logs backup-worker'
    )
  }

  const dismissRestoreModal = () => {
    clearPendingPgRestore()
    setRestoring(false)
    setRestoreProgress(0)
    setMaintenanceMessage(null)
    setShowConfirmation(false)
  }

  const reconcileRestoreUiWithWorker = async (): Promise<
    'none' | 'running' | 'done' | 'failed'
  > => {
    try {
      const res = await fetch('/api/admin/backups/restore-status', { cache: 'no-store' })
      const data = await parseJsonResponse(res)
      if (!res.ok) {
        dismissRestoreModal()
        return 'none'
      }
      const job = data.job as { status?: string; message?: string | null; label?: string | null }
      const pending = readPendingPgRestore()

      if (job?.status === 'running') {
        return 'running'
      }

      if (job?.status === 'success') {
        if (pending) {
          showPgRestoreSuccessToast(job.label ?? pending.label)
          finalizePgRestoreUi()
        } else {
          dismissRestoreModal()
        }
        return 'done'
      }

      if (job?.status === 'failed') {
        clearPendingPgRestore()
        dismissRestoreModal()
        if (pending) {
          toast({
            title: 'Error en la Restauración',
            description: job.message || 'La restauración pgBackRest falló',
            variant: 'destructive',
            duration: 12000,
          })
        }
        return 'failed'
      }

      // idle — limpiar pending obsoleto del navegador (p. ej. tras recrear contenedores)
      if (pending) {
        clearPendingPgRestore()
      }
      dismissRestoreModal()
      return 'none'
    } catch {
      clearPendingPgRestore()
      dismissRestoreModal()
      return 'none'
    }
  }

  useEffect(() => {
    void (async () => {
      const pending = readPendingPgRestore()
      if (pending) {
        const pendingAge = Date.now() - new Date(pending.startedAt).getTime()
        if (pendingAge > PENDING_PG_RESTORE_MAX_MS) {
          dismissRestoreModal()
          return
        }
      }

      const state = await reconcileRestoreUiWithWorker()
      if (state !== 'running') return

      setRestoring(true)
      setRestoreProgress(60)
      setMaintenanceMessage(
        'Restauración pgBackRest detectada. Verificando resultado tras el reinicio de servicios…'
      )

      try {
        const finished = await pollPgBackRestRestoreOutcome()
        setRestoreProgress(100)
        showPgRestoreSuccessToast(finished?.label ?? pending?.label)
        finalizePgRestoreUi()
      } catch (error) {
        dismissRestoreModal()
        toast({
          title: 'Error en la Restauración',
          description: error instanceof Error ? error.message : 'Error desconocido',
          variant: 'destructive',
          duration: 12000,
        })
        setHistoryRefreshKey(k => k + 1)
      }
    })()
    // Solo al montar: recuperar restauraciones interrumpidas por recarga durante mantenimiento
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isFetchNetworkError = (error: unknown) =>
    error instanceof TypeError ||
    (error instanceof Error &&
      /failed to fetch|network error|load failed|networkrequestfailed|aborted/i.test(error.message))

  const waitForPgBackRestMaintenance = async (clearProgressInterval: () => void) => {
    clearProgressInterval()
    setRestoreProgress(35)
    setMaintenanceMessage(
      'Restauración pgBackRest en curso. El sitio quedará fuera de línea unos minutos…'
    )

    const job = await pollPgBackRestRestoreOutcome()
    setRestoreProgress(100)
    showPgRestoreSuccessToast(job?.label)
    finalizePgRestoreUi()
  }

  const confirmRestore = async () => {
    if (!selectedBackup) return
    setRestoring(true)
    setRestoreProgress(0)
    setShowConfirmation(false)

    const progressInterval = setInterval(() => {
      setRestoreProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval)
          return prev
        }
        return prev + Math.random() * 10
      })
    }, 500)
    const clearProgressInterval = () => clearInterval(progressInterval)

    const pgBackRestFullRestore =
      selectedBackup.engine === 'pgbackrest' && selectedModules.length === 0

    if (pgBackRestFullRestore) {
      savePendingPgRestore({
        backupId: selectedBackup.id,
        filename: selectedBackup.filename,
        label: selectedBackup.label,
        startedAt: new Date().toISOString(),
      })
    }

    try {
      const body: Record<string, unknown> = {}
      if (selectedModules.length > 0) {
        body.modules = selectedModules
      }
      body.mode = restoreMode

      const response = await fetch(`/api/admin/backups/${selectedBackup.id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await parseJsonResponse(response)

      if (response.status === 202 || data.async) {
        await waitForPgBackRestMaintenance(clearProgressInterval)
        return
      }

      clearProgressInterval()
      setRestoreProgress(100)

      if (response.ok) {
        const scopeLabel =
          selectedModules.length === 0 ? 'completa' : `de ${selectedModules.length} módulo(s)`
        const modeLabel = restoreMode === 'merge' ? ' (fusión)' : ''
        toast({
          title: 'Restauración Exitosa',
          description: `Restauración ${scopeLabel}${modeLabel} completada correctamente`,
          variant: 'success',
          duration: 8000,
        })
        setHistoryRefreshKey(k => k + 1)
        setTimeout(() => {
          setRestoring(false)
          setRestoreProgress(0)
          setSelectedBackup(null)
          setRestorePreview(null)
          setSelectedModules([])
          setRestoreMode('merge')
          onRefresh()
        }, 2000)
      } else {
        throw new Error(String(data.error || 'Error en la restauración'))
      }
    } catch (error) {
      if (pgBackRestFullRestore && isFetchNetworkError(error)) {
        try {
          await waitForPgBackRestMaintenance(clearProgressInterval)
          return
        } catch (maintenanceError) {
          clearProgressInterval()
          clearPendingPgRestore()
          toast({
            title: 'Error en la Restauración',
            description:
              maintenanceError instanceof Error
                ? maintenanceError.message
                : 'Error desconocido tras mantenimiento',
            variant: 'destructive',
          })
          setRestoring(false)
          setRestoreProgress(0)
          setMaintenanceMessage(null)
          setHistoryRefreshKey(k => k + 1)
          return
        }
      }

      clearProgressInterval()
      clearPendingPgRestore()
      toast({
        title: 'Error en la Restauración',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      })
      setRestoring(false)
      setRestoreProgress(0)
      setMaintenanceMessage(null)
      setHistoryRefreshKey(k => k + 1)
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
  const isPgBackRestBackup = selectedBackup?.engine === 'pgbackrest'
  const isPartialBackup = !!selectedBackup?.module && !isPgBackRestBackup
  const pgRestoreBlocked = isPgBackRestBackup && !allowPgBackRestRestore

  return (
    <div className='space-y-6'>
      <div className='flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3'>
        <div>
          <h2 className='text-xl font-semibold text-foreground'>Restauración</h2>
          <p className='text-sm text-muted-foreground mt-1'>
            Elige un punto de recuperación o importa un archivo .dump
          </p>
        </div>
        {onOpenBackupsTab && (
          <Button
            variant='ghost'
            size='sm'
            className='self-start sm:self-auto'
            onClick={onOpenBackupsTab}
          >
            Gestionar inventario →
          </Button>
        )}
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
              accept='.sql,.sql.gz,.json,.json.gz,.enc,.dump'
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
                        Formatos: .dump (recomendado), .sql, .json, .gz, .enc
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
          {isPgBackRestBackup
            ? allowPgBackRestRestore
              ? 'Restauración pgBackRest: revierte el cluster al instante exacto del respaldo seleccionado (no incluye cambios posteriores al backup, p. ej. eliminaciones). Para un punto intermedio entre dos backups usa PITR. Desactívala en Config cuando termines.'
              : 'Restauración pgBackRest deshabilitada. Actívala en Admin → Backups → Config → Permitir restauración pgBackRest.'
            : selectedModules.length === 0 && !selectedBackup?.module
              ? 'La restauración completa reemplazará todos los datos actuales de la base de datos. Esta acción no se puede deshacer.'
              : restoreMode === 'merge'
                ? `El modo fusión agregará los registros del backup sin eliminar los existentes en: ${getSelectedModulesLabel()}. Los duplicados (mismo ID) se ignorarán.`
                : `La restauración selectiva reemplazará únicamente los datos de: ${getSelectedModulesLabel()}. Las demás tablas no se verán afectadas.`}{' '}
          Se recomienda crear un backup actual antes de proceder.
        </AlertDescription>
      </Alert>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {/* Lista de Backups Disponibles */}
        <Card>
          <CardHeader className='space-y-3'>
            <div>
              <CardTitle className='flex items-center space-x-2 text-base'>
                <Database className='h-5 w-5 text-primary' />
                <span>Backups disponibles</span>
              </CardTitle>
              <CardDescription>Solo respaldos completados listos para restaurar</CardDescription>
            </div>
            <BackupSectionToolbar
              search={restoreSearch}
              onSearchChange={setRestoreSearch}
              searchPlaceholder='Buscar backup…'
            />
          </CardHeader>
          <CardContent>
            {filteredRestoreBackups.length === 0 ? (
              <div className='text-center py-8 text-muted-foreground'>
                <Database className='h-8 w-8 mx-auto mb-2 text-muted-foreground' />
                <p className='text-sm'>
                  {restoreSearch
                    ? 'Sin resultados para la búsqueda'
                    : 'No hay backups disponibles para restaurar'}
                </p>
              </div>
            ) : (
              <div className='space-y-2 max-h-[28rem] overflow-y-auto pr-1'>
                {filteredRestoreBackups.map(backup => (
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
                  ) : isPgBackRestBackup ? (
                    <div className='p-3 bg-muted/50 rounded-lg border border-border'>
                      <p className='text-sm text-muted-foreground'>
                        Respaldo de infraestructura pgBackRest
                        {selectedBackup.label ? (
                          <>
                            {' '}
                            — etiqueta{' '}
                            <span className='font-mono text-foreground'>
                              {selectedBackup.label}
                            </span>
                          </>
                        ) : null}
                        . Restauración completa del cluster (sin selección por módulo).
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

                {/* Selector de Modo de Restauración — solo exportaciones */}
                {!isPgBackRestBackup && (
                  <div className='space-y-2'>
                    <label className='text-sm font-medium text-foreground'>
                      Modo de restauración
                    </label>
                    <div className='grid grid-cols-1 gap-2'>
                      <label
                        className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors text-xs ${
                          restoreMode === 'merge'
                            ? 'border-primary bg-primary/5 text-foreground'
                            : 'border-border hover:bg-muted text-muted-foreground'
                        }`}
                      >
                        <input
                          type='radio'
                          name='restoreMode'
                          value='merge'
                          checked={restoreMode === 'merge'}
                          onChange={() => setRestoreMode('merge')}
                          className='mt-0.5'
                        />
                        <div>
                          <p className='font-medium text-foreground'>Fusionar</p>
                          <p className='text-muted-foreground mt-0.5'>
                            Agrega los registros del backup sin borrar los que ya existen. Úsalo
                            para combinar usuarios o datos de dos backups distintos.
                          </p>
                        </div>
                      </label>
                      <label
                        className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors text-xs ${
                          restoreMode === 'replace'
                            ? 'border-destructive/60 bg-destructive/5 text-foreground'
                            : 'border-border hover:bg-muted text-muted-foreground'
                        }`}
                      >
                        <input
                          type='radio'
                          name='restoreMode'
                          value='replace'
                          checked={restoreMode === 'replace'}
                          onChange={() => setRestoreMode('replace')}
                          className='mt-0.5'
                        />
                        <div>
                          <p className='font-medium text-foreground'>Reemplazar</p>
                          <p className='text-muted-foreground mt-0.5'>
                            Borra los datos actuales del módulo y los reemplaza con los del backup.
                            Úsalo para volver a un estado anterior exacto.
                          </p>
                        </div>
                      </label>
                    </div>
                    {restoreMode === 'merge' &&
                      selectedModules.length === 0 &&
                      !isPartialBackup && (
                        <p className='text-xs text-amber-600 dark:text-amber-400'>
                          ⚠ El modo fusión en restauración completa puede causar conflictos.
                          Selecciona módulos específicos para mejores resultados.
                        </p>
                      )}
                  </div>
                )}

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
                  {!isPgBackRestBackup && (
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
                  )}

                  {isPgBackRestBackup && (
                    <p className='text-xs text-muted-foreground flex-1'>
                      Los respaldos pgBackRest viven en el repositorio de infraestructura — crea una
                      Exportación (.dump) para descargar un archivo portable.
                    </p>
                  )}

                  <Button
                    onClick={initiateRestore}
                    disabled={restoring || pgRestoreBlocked}
                    variant='destructive'
                    title={
                      pgRestoreBlocked ? 'Activa la restauración pgBackRest en Config' : undefined
                    }
                  >
                    <RotateCcw className='h-4 w-4 mr-2' />
                    {isPartialBackup
                      ? `Restaurar ${selectedBackup.module}`
                      : selectedModules.length === 0
                        ? 'Restaurar Todo'
                        : restoreMode === 'merge'
                          ? `Fusionar ${selectedModules.length} módulo(s)`
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
                  {isPgBackRestBackup
                    ? `Se restaurará el cluster PostgreSQL completo desde "${selectedBackup.filename}". El sitio quedará fuera de servicio ~5–15 min mientras se detienen app, nginx y postgres.`
                    : selectedModules.length === 0 && !isPartialBackup
                      ? `Se restaurará el backup "${selectedBackup.filename}" y se reemplazarán TODOS los datos actuales de la base de datos.`
                      : restoreMode === 'merge'
                        ? `Se FUSIONARÁN los módulos: ${isPartialBackup ? selectedBackup.module : getSelectedModulesLabel()} del backup "${selectedBackup.filename}". Los registros existentes se conservan; solo se agregan los nuevos.`
                        : `Se REEMPLAZARÁN los módulos: ${isPartialBackup ? selectedBackup.module : getSelectedModulesLabel()} del backup "${selectedBackup.filename}". Las demás tablas no se verán afectadas.`}
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
                <span>
                  {isPgBackRestBackup
                    ? 'Restaurando cluster PostgreSQL (modo mantenimiento)'
                    : 'Restaurando Base de Datos'}
                </span>
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
                {maintenanceMessage ? (
                  <>
                    <p className='text-foreground font-medium'>{maintenanceMessage}</p>
                    <p className='text-xs mt-2'>
                      La página puede dejar de responder unos minutos. Este diálogo esperará a que
                      el sitio vuelva y verificará el resultado automáticamente.
                    </p>
                  </>
                ) : (
                  <>
                    <p>Por favor, no cierres esta ventana...</p>
                    <p className='text-xs mt-1'>La restauración puede tomar varios minutos</p>
                  </>
                )}
              </div>
              {maintenanceMessage && (
                <Button variant='outline' className='w-full' onClick={dismissRestoreModal}>
                  Salir de la espera
                </Button>
              )}
              {maintenanceMessage && (
                <p className='text-xs text-center text-muted-foreground'>
                  Cierra esta ventana si el sitio ya respondió o si quieres revisar el estado más
                  tarde en el historial de operaciones.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <BackupOperationsHistory refreshKey={historyRefreshKey} />
    </div>
  )
}
