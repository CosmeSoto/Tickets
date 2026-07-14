import type { BackupOperationEntry } from './backup-restore-events'

export function operationTitle(entry: BackupOperationEntry): string {
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

export function engineLabel(engine: string | null): string {
  if (engine === 'pgbackrest') return 'pgBackRest'
  if (engine === 'export') return 'Export .dump'
  if (engine === 'import') return 'Importado'
  return engine || '—'
}

export function operationStatusLabel(entry: BackupOperationEntry): string {
  if (
    entry.kind === 'deleted' ||
    entry.kind === 'created' ||
    entry.kind === 'imported' ||
    entry.kind === 'uploaded'
  ) {
    return 'Registrado'
  }
  switch (entry.status) {
    case 'success':
      return 'Completada'
    case 'failed':
      return 'Fallida'
    default:
      return 'En curso'
  }
}

export function formatOperationDuration(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms} ms`
  const sec = Math.round(ms / 1000)
  if (sec < 60) return `${sec} s`
  const min = Math.floor(sec / 60)
  const rem = sec % 60
  return rem > 0 ? `${min} min ${rem} s` : `${min} min`
}

export function matchesOperationSearch(entry: BackupOperationEntry, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [
    operationTitle(entry),
    entry.filename,
    entry.label,
    entry.backupId,
    engineLabel(entry.engine),
    entry.userEmail,
    entry.message,
    operationStatusLabel(entry),
  ]
    .filter(Boolean)
    .some(v => String(v).toLowerCase().includes(q))
}
