'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
  CheckCircle,
  Clock,
  Database,
  Download,
  History,
  Loader2,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react'
import { BackupSectionToolbar } from '@/components/backups/backup-section-toolbar'
import { useExport } from '@/hooks/common/use-export'
import { useToast } from '@/hooks/use-toast'
import {
  engineLabel,
  formatOperationDuration,
  matchesOperationSearch,
  operationStatusLabel,
  operationTitle,
} from '@/lib/services/backup/backup-operation-ui'

export type BackupOperationEntry = {
  id: string
  kind: 'created' | 'imported' | 'deleted' | 'uploaded' | 'restore' | 'restore_failed'
  backupId: string
  filename: string | null
  label: string | null
  engine: string | null
  mode: string | null
  status: 'running' | 'success' | 'failed'
  message: string | null
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
  userEmail: string | null
  async: boolean
  size: number | null
  backupType: string | null
  auditLogIds: string[]
  deletable: boolean
}

interface BackupOperationsHistoryProps {
  refreshKey?: number
}

const PAGE_SIZE = 15

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatFileSize(bytes: number | null) {
  if (bytes == null || bytes === 0) return null
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

function operationIcon(entry: BackupOperationEntry) {
  switch (entry.kind) {
    case 'created':
      return entry.engine === 'export' ? Download : Database
    case 'imported':
      return Upload
    case 'deleted':
      return Trash2
    case 'uploaded':
      return Upload
    default:
      return RotateCcw
  }
}

function statusBadge(entry: BackupOperationEntry) {
  const label = operationStatusLabel(entry)
  if (label === 'Registrado' || label === 'Completada') {
    return (
      <Badge className='bg-emerald-600 hover:bg-emerald-600'>
        <CheckCircle className='h-3 w-3 mr-1' />
        {label}
      </Badge>
    )
  }
  if (label === 'Fallida') {
    return (
      <Badge variant='destructive'>
        <XCircle className='h-3 w-3 mr-1' />
        {label}
      </Badge>
    )
  }
  return (
    <Badge variant='secondary'>
      <Loader2 className='h-3 w-3 mr-1 animate-spin' />
      {label}
    </Badge>
  )
}

export function BackupOperationsHistory({ refreshKey = 0 }: BackupOperationsHistoryProps) {
  const { data: session } = useSession()
  const isSuperAdmin =
    (session?.user as { isSuperAdmin?: boolean } | undefined)?.isSuperAdmin === true
  const { toast } = useToast()

  const [history, setHistory] = useState<BackupOperationEntry[]>([])
  const [activeJob, setActiveJob] = useState<{
    label?: string | null
    message?: string | null
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const loadHistory = useCallback(async (append = false, pageIndex = 0) => {
    try {
      setError(null)
      if (append) setLoadingMore(true)
      else setLoading(true)

      const offset = pageIndex * PAGE_SIZE
      const res = await fetch(
        `/api/admin/backups/operations-history?limit=${PAGE_SIZE}&offset=${offset}`,
        { cache: 'no-store' }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar el historial')

      const batch: BackupOperationEntry[] = Array.isArray(data.operations)
        ? data.operations
        : (data.history ?? [])

      setHistory(prev => (append ? [...prev, ...batch] : batch))
      setHasMore(Boolean(data.hasMore))
      setActiveJob(data.activeJob ?? null)
      setPage(pageIndex)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    void loadHistory(false, 0)
  }, [loadHistory, refreshKey])

  useEffect(() => {
    const hasRunning =
      history.some(h => h.kind === 'restore' && h.status === 'running') || activeJob != null
    if (!hasRunning) return
    const interval = setInterval(() => {
      void loadHistory(false, 0)
    }, 8000)
    return () => clearInterval(interval)
  }, [history, activeJob, loadHistory])

  const filteredHistory = useMemo(
    () => history.filter(entry => matchesOperationSearch(entry, search)),
    [history, search]
  )

  const toggleSelected = useCallback((id: string, checked: boolean) => {
    setSelectedIds(prev => (checked ? [...new Set([...prev, id])] : prev.filter(i => i !== id)))
  }, [])

  const handleDeleteSelected = useCallback(async () => {
    const auditLogIds = history
      .filter(entry => selectedIds.includes(entry.id))
      .flatMap(entry => entry.auditLogIds)

    if (auditLogIds.length === 0) {
      setConfirmDeleteOpen(false)
      return
    }

    try {
      setDeleting(true)
      const res = await fetch('/api/admin/audit/logs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: auditLogIds }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo eliminar')

      toast({
        title: 'Historial actualizado',
        description: `${selectedIds.length} operación(es) eliminada(s) del historial.`,
      })
      setSelectedIds([])
      setConfirmDeleteOpen(false)
      void loadHistory(false, 0)
    } catch (err) {
      toast({
        title: 'Error al eliminar',
        description: err instanceof Error ? err.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }, [history, selectedIds, toast, loadHistory])

  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'operaciones-backup',
    title: 'Historial de operaciones de backup',
    subtitle: `Exportado el ${new Date().toLocaleDateString('es-EC')}`,
    columns: [
      { key: 'operacion', label: 'Operación' },
      { key: 'archivo', label: 'Archivo / Etiqueta' },
      { key: 'motor', label: 'Motor' },
      { key: 'estado', label: 'Estado' },
      { key: 'fecha', label: 'Fecha' },
      { key: 'duracion', label: 'Duración' },
      { key: 'usuario', label: 'Usuario' },
    ],
    getData: () =>
      filteredHistory.map(entry => ({
        operacion: operationTitle(entry),
        archivo: entry.filename || entry.label || entry.backupId,
        motor: engineLabel(entry.engine),
        estado: operationStatusLabel(entry),
        fecha: formatDate(entry.startedAt),
        duracion: formatOperationDuration(entry.durationMs),
        usuario: entry.userEmail || '—',
      })),
  })

  return (
    <Card>
      <CardHeader className='space-y-3'>
        <div className='flex flex-row items-start justify-between gap-4'>
          <div>
            <CardTitle className='flex items-center gap-2 text-base'>
              <History className='h-4 w-4 text-primary' />
              Historial de operaciones
            </CardTitle>
            <CardDescription>
              Creaciones, restauraciones e importaciones. Detalle completo en Admin → Auditoría.
            </CardDescription>
          </div>
          <div className='flex items-center gap-2 flex-shrink-0'>
            {isSuperAdmin && selectedIds.length > 0 && (
              <Button
                variant='destructive'
                size='sm'
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={deleting}
              >
                <Trash2 className='h-4 w-4 mr-1' />
                Eliminar seleccionados ({selectedIds.length})
              </Button>
            )}
            <Button
              variant='outline'
              size='sm'
              onClick={() => void loadHistory(false, 0)}
              disabled={loading}
              title='Recargar historial'
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Recargar
            </Button>
          </div>
        </div>
        <BackupSectionToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder='Buscar operación, archivo, usuario…'
          onExportCSV={exportCSV}
          onExportExcel={exportExcel}
          onExportPDF={exportPDF}
          exporting={exporting}
          exportDisabled={filteredHistory.length === 0}
        />
      </CardHeader>
      <CardContent className='space-y-4'>
        {activeJob && (
          <Alert className='border-primary/40 bg-primary/5'>
            <Loader2 className='h-4 w-4 animate-spin text-primary' />
            <AlertDescription>
              Restauración pgBackRest en curso
              {activeJob.label ? (
                <>
                  {' '}
                  — <span className='font-mono'>{activeJob.label}</span>
                </>
              ) : null}
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant='destructive'>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading && history.length === 0 ? (
          <div className='flex items-center justify-center py-8 text-muted-foreground text-sm'>
            <Loader2 className='h-4 w-4 mr-2 animate-spin' />
            Cargando historial…
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className='text-center py-8 text-muted-foreground text-sm'>
            <History className='h-8 w-8 mx-auto mb-2 opacity-50' />
            {search ? 'Sin resultados para la búsqueda' : 'Aún no hay operaciones registradas'}
          </div>
        ) : (
          <>
            <div className='space-y-2'>
              {filteredHistory.map(entry => {
                const Icon = operationIcon(entry)
                const sizeLabel = formatFileSize(entry.size)
                return (
                  <div
                    key={entry.id}
                    className='rounded-lg border border-border p-3 space-y-2 bg-muted/20'
                  >
                    <div className='flex flex-wrap items-center justify-between gap-2'>
                      <div className='flex items-start gap-2 min-w-0'>
                        {isSuperAdmin &&
                          (entry.deletable ? (
                            <Checkbox
                              className='mt-1'
                              checked={selectedIds.includes(entry.id)}
                              onCheckedChange={checked =>
                                toggleSelected(entry.id, checked === true)
                              }
                              aria-label='Seleccionar operación'
                            />
                          ) : (
                            <div
                              className='mt-1 h-4 w-4 shrink-0'
                              title='Vinculado a un backup existente: elimínalo desde la lista de backups'
                            />
                          ))}
                        <Icon className='h-4 w-4 text-primary mt-0.5 shrink-0' />
                        <div className='min-w-0'>
                          <p className='font-medium text-sm'>{operationTitle(entry)}</p>
                          <p className='text-xs text-muted-foreground truncate'>
                            {entry.filename || entry.label || entry.backupId}
                          </p>
                        </div>
                      </div>
                      {statusBadge(entry)}
                    </div>
                    <div className='grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground'>
                      <span className='flex items-center gap-1'>
                        <Clock className='h-3 w-3' />
                        {formatDate(entry.startedAt)}
                      </span>
                      {entry.finishedAt && entry.kind === 'restore' && (
                        <span>Duración: {formatOperationDuration(entry.durationMs)}</span>
                      )}
                      <span>Motor: {engineLabel(entry.engine)}</span>
                      {sizeLabel && <span>Tamaño: {sizeLabel}</span>}
                      {entry.userEmail && (
                        <span className='sm:col-span-2'>Por: {entry.userEmail}</span>
                      )}
                    </div>
                    {entry.message && entry.status !== 'success' && entry.kind !== 'created' && (
                      <p className='text-xs text-destructive'>{entry.message}</p>
                    )}
                  </div>
                )
              })}
            </div>

            {!search && hasMore && (
              <div className='flex justify-center pt-2'>
                <Button
                  variant='outline'
                  size='sm'
                  disabled={loadingMore}
                  onClick={() => void loadHistory(true, page + 1)}
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                      Cargando…
                    </>
                  ) : (
                    'Cargar más'
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Eliminar {selectedIds.length} operación(es) del historial?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán permanentemente los registros de auditoría asociados a las operaciones
              seleccionadas. Esta acción no se puede deshacer y no afecta a los archivos de backup.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={e => {
                e.preventDefault()
                void handleDeleteSelected()
              }}
              disabled={deleting}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {deleting ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
