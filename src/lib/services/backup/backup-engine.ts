import { BackupEngine, BackupKind, BackupWorkerHealth, PgBackRestInfo } from './backup-types'

const WORKER_URL = process.env.BACKUP_WORKER_URL || ''
const WORKER_SECRET = process.env.BACKUP_WORKER_SECRET || ''
const STANZA = process.env.PGBACKREST_STANZA || 'main'

function workerConfigured(): boolean {
  return Boolean(WORKER_URL && WORKER_SECRET)
}

async function workerFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; timeoutMs?: number } = {}
): Promise<T> {
  if (!workerConfigured()) {
    throw new Error(
      'pgBackRest no configurado. Define BACKUP_WORKER_URL y BACKUP_WORKER_SECRET en Docker.'
    )
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 3_600_000)

  try {
    const res = await fetch(`${WORKER_URL}${path}`, {
      method: options.method || 'GET',
      headers: {
        Authorization: `Bearer ${WORKER_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data.error || `Backup worker error ${res.status}`)
    }
    return data as T
  } finally {
    clearTimeout(timeout)
  }
}

export async function getBackupWorkerHealth(): Promise<BackupWorkerHealth> {
  if (!workerConfigured()) {
    return {
      status: 'unavailable',
      pgbackrestOk: false,
      stanzaOk: false,
      stanza: STANZA,
      allowRestore: process.env.BACKUP_ALLOW_RESTORE === 'true',
    }
  }

  try {
    const res = await fetch(`${WORKER_URL}/health`, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) throw new Error(`Health ${res.status}`)
    const data = await res.json()
    return {
      status: data.status === 'healthy' ? 'healthy' : 'degraded',
      pgbackrestOk: Boolean(data.pgbackrestOk),
      stanzaOk: Boolean(data.stanzaOk),
      stanza: data.stanza || STANZA,
      allowRestore: Boolean(data.allowRestore),
    }
  } catch {
    return {
      status: 'unavailable',
      pgbackrestOk: false,
      stanzaOk: false,
      stanza: STANZA,
      allowRestore: process.env.BACKUP_ALLOW_RESTORE === 'true',
    }
  }
}

export async function isPgBackRestAvailable(): Promise<boolean> {
  const health = await getBackupWorkerHealth()
  return health.status === 'healthy' && health.stanzaOk
}

export async function fetchPgBackRestInfo(): Promise<PgBackRestInfo[]> {
  const data = await workerFetch<{ info: PgBackRestInfo[] }>('/info')
  return data.info || []
}

export async function runPgBackRestBackup(
  kind: Exclude<BackupKind, 'export'>
): Promise<{ label: string | null; size: number; metadata: Record<string, unknown> }> {
  const result = await workerFetch<{
    backup: { label?: string; timestamp?: number; size?: number; type?: string } | null
    type: string
    durationMs: number
  }>('/backup', { method: 'POST', body: { type: kind } })

  const backup = result.backup
  const label = backup?.label || null
  const size = backup?.size || 0

  return {
    label,
    size,
    metadata: {
      pgbackrest: {
        stanza: STANZA,
        label,
        type: result.type,
        timestamp: backup?.timestamp,
        durationMs: result.durationMs,
      },
    },
  }
}

export async function verifyPgBackRestRepo(): Promise<void> {
  await workerFetch('/verify', { method: 'POST' })
}

export async function restorePgBackRest(options: {
  label?: string
  target?: string
}): Promise<void> {
  if (process.env.BACKUP_ALLOW_RESTORE !== 'true') {
    throw new Error(
      'Restauración pgBackRest deshabilitada. Establece BACKUP_ALLOW_RESTORE=true y detén la app en producción.'
    )
  }
  await workerFetch('/restore', { method: 'POST', body: options, timeoutMs: 3_600_000 })
}

export function buildPgBackRestFileRef(label: string): string {
  return `pgbackrest://${STANZA}/${label}`
}

export function parsePgBackRestFileRef(filepath: string): { stanza: string; label: string } | null {
  const match = filepath.match(/^pgbackrest:\/\/([^/]+)\/(.+)$/)
  if (!match) return null
  return { stanza: match[1], label: match[2] }
}

export function inferEngineFromRecord(record: {
  engine?: string | null
  filename?: string
  filepath?: string
}): BackupEngine {
  if (record.engine === 'pgbackrest' || record.engine === 'export' || record.engine === 'import') {
    return record.engine
  }
  if (record.filepath?.startsWith('pgbackrest://')) return 'pgbackrest'
  if (record.filename?.endsWith('.dump') || record.filename?.endsWith('.json')) return 'export'
  return 'export'
}

export function formatBackupKindLabel(kind: BackupKind, engine: BackupEngine): string {
  if (engine === 'export' || engine === 'import') return 'Exportación'
  switch (kind) {
    case 'full':
      return 'Completo'
    case 'diff':
      return 'Diferencial'
    case 'incr':
      return 'Incremental'
    default:
      return kind
  }
}

export async function syncPgBackRestToDatabase(): Promise<number> {
  if (!(await isPgBackRestAvailable())) return 0

  const prisma = (await import('@/lib/prisma')).default
  const { randomUUID } = await import('crypto')
  const info = await fetchPgBackRestInfo()
  const stanzaInfo = info.find(s => s.name === STANZA || s.stanza === STANZA) || info[0]
  const sets = stanzaInfo?.backup || []
  let synced = 0

  for (const set of sets) {
    if (!set.label) continue
    const existing = await prisma.backups.findFirst({ where: { label: set.label } })
    if (existing) continue

    const kind = mapPgBackRestType(set.type)
    const size = set.info?.size || set.size || 0
    await prisma.backups.create({
      data: {
        id: randomUUID(),
        filename: `${set.label}.pgbackrest`,
        filepath: buildPgBackRestFileRef(set.label),
        size,
        type: 'automatic',
        status: 'completed',
        compressed: true,
        encrypted: false,
        engine: 'pgbackrest',
        backupKind: kind,
        label: set.label,
        metadata: JSON.stringify({
          version: '3.0',
          createdAt: set.timestamp
            ? new Date(set.timestamp * 1000).toISOString()
            : new Date().toISOString(),
          pgbackrest: { stanza: STANZA, label: set.label, type: set.type },
        }),
        createdAt: set.timestamp ? new Date(set.timestamp * 1000) : new Date(),
      },
    })
    synced++
  }

  return synced
}

function mapPgBackRestType(type?: string): BackupKind {
  if (type === 'full') return 'full'
  if (type === 'diff') return 'diff'
  if (type === 'incr') return 'incr'
  return 'full'
}
