'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
}

interface BackupOperationsHistoryProps {
  refreshKey?: number
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatDuration(ms: number | null) {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms} ms`
  const sec = Math.round(ms / 1000)
  if (sec < 60) return `${sec} s`
  const min = Math.floor(sec / 60)
  const rem = sec % 60
  return rem > 0 ? `${min} min ${rem} s` : `${min} min`
}

function formatFileSize(bytes: number | null) {
  if (bytes == null || bytes === 0) return null
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

function engineLabel(engine: string | null) {
  if (engine === 'pgbackrest') return 'pgBackRest'
  if (engine === 'export') return 'Export .dump'
  if (engine === 'import') return 'Importado'
  return engine || '—'
}

function operationTitle(entry: BackupOperationEntry) {
  switch (entry.kind) {
    case 'created':
      return entry.engine === 'export' ? 'Export .dump creado' : 'Respaldo pgBackRest creado'
    case 'imported':
      return 'Backup importado'
    case 'deleted':
      return 'Backup eliminado'
    case 'uploaded':
      return 'Subido a nube'
    case 'restore':
      return entry.status === 'running' ? 'Restauración en curso' : 'Restauración completada'
    case 'restore_failed':
      return 'Restauración fallida'
    default:
      return 'Operación de backup'
  }
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
  if (
    entry.kind === 'deleted' ||
    entry.kind === 'created' ||
    entry.kind === 'imported' ||
    entry.kind === 'uploaded'
  ) {
    return (
      <Badge className='bg-emerald-600 hover:bg-emerald-600'>
        <CheckCircle className='h-3 w-3 mr-1' />
        Registrado
      </Badge>
    )
  }
  switch (entry.status) {
    case 'success':
      return (
        <Badge className='bg-emerald-600 hover:bg-emerald-600'>
          <CheckCircle className='h-3 w-3 mr-1' />
          Completada
        </Badge>
      )
    case 'failed':
      return (
        <Badge variant='destructive'>
          <XCircle className='h-3 w-3 mr-1' />
          Fallida
        </Badge>
      )
    default:
      return (
        <Badge variant='secondary'>
          <Loader2 className='h-3 w-3 mr-1 animate-spin' />
          En curso
        </Badge>
      )
  }
}

export function BackupOperationsHistory({ refreshKey = 0 }: BackupOperationsHistoryProps) {
  const [history, setHistory] = useState<BackupOperationEntry[]>([])
  const [activeJob, setActiveJob] = useState<{
    label?: string | null
    message?: string | null
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadHistory = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/admin/backups/operations-history', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo cargar el historial')
      }
      setHistory(Array.isArray(data.operations) ? data.operations : (data.history ?? []))
      setActiveJob(data.activeJob ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory, refreshKey])

  useEffect(() => {
    const hasRunning =
      history.some(h => h.kind === 'restore' && h.status === 'running') || activeJob != null
    if (!hasRunning) return
    const interval = setInterval(() => {
      void loadHistory()
    }, 8000)
    return () => clearInterval(interval)
  }, [history, activeJob, loadHistory])

  return (
    <Card>
      <CardHeader className='flex flex-row items-start justify-between gap-4 space-y-0'>
        <div>
          <CardTitle className='flex items-center gap-2 text-base'>
            <History className='h-4 w-4 text-primary' />
            Historial de operaciones
          </CardTitle>
          <CardDescription>
            Creación de exports (.dump), respaldos pgBackRest, importaciones, restauraciones y
            eliminaciones. Todas quedan registradas en Admin → Auditoría.
          </CardDescription>
        </div>
        <Button variant='outline' size='sm' onClick={() => void loadHistory()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
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
                  — etiqueta <span className='font-mono'>{activeJob.label}</span>
                </>
              ) : null}
              .
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
        ) : history.length === 0 ? (
          <div className='text-center py-8 text-muted-foreground text-sm'>
            <History className='h-8 w-8 mx-auto mb-2 opacity-50' />
            Aún no hay operaciones registradas
          </div>
        ) : (
          <div className='space-y-3 max-h-96 overflow-y-auto'>
            {history.map(entry => {
              const Icon = operationIcon(entry)
              const sizeLabel = formatFileSize(entry.size)
              return (
                <div
                  key={entry.id}
                  className='rounded-lg border border-border p-3 space-y-2 bg-muted/20'
                >
                  <div className='flex flex-wrap items-center justify-between gap-2'>
                    <div className='flex items-start gap-2 min-w-0'>
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
                      <span>Duración: {formatDuration(entry.durationMs)}</span>
                    )}
                    <span>Motor: {engineLabel(entry.engine)}</span>
                    {sizeLabel && <span>Tamaño: {sizeLabel}</span>}
                    {entry.mode && entry.kind === 'restore' && <span>Modo: {entry.mode}</span>}
                    {entry.userEmail && (
                      <span className='sm:col-span-2'>Por: {entry.userEmail}</span>
                    )}
                  </div>
                  {entry.message && entry.status !== 'success' && entry.kind !== 'created' && (
                    <p className='text-xs text-destructive'>{entry.message}</p>
                  )}
                  {entry.message &&
                    entry.kind === 'created' &&
                    entry.message.includes('auditoría') && (
                      <p className='text-xs text-muted-foreground italic'>{entry.message}</p>
                    )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** @deprecated use BackupOperationsHistory */
export const BackupRestoreHistory = BackupOperationsHistory
