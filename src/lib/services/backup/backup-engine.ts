import { BackupEngine, BackupKind, BackupWorkerHealth, PgBackRestInfo } from './backup-types'
import { getHiddenPgBackRestLabels, isPgBackRestRestoreAllowed } from './backup-settings'

const WORKER_URL = process.env.BACKUP_WORKER_URL || ''
const WORKER_SECRET = process.env.BACKUP_WORKER_SECRET || ''
const STANZA = process.env.PGBACKREST_STANZA || 'main'

/** pgBackRest 2.58 devuelve timestamp como epoch o como { start, stop }. */
export function parsePgBackRestTimestamp(value: unknown): Date | null {
  if (value == null) return null
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value * 1000
    const date = new Date(ms)
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (typeof value === 'object') {
    const obj = value as { start?: number; stop?: number }
    if (typeof obj.stop === 'number') return parsePgBackRestTimestamp(obj.stop)
    if (typeof obj.start === 'number') return parsePgBackRestTimestamp(obj.start)
  }
  return null
}

export function pgBackRestBackupSize(set: {
  size?: number
  info?: { size?: number; 'repository-size'?: number }
}): number {
  return set.info?.size ?? set.info?.['repository-size'] ?? set.size ?? 0
}

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
  const allowRestore = await isPgBackRestRestoreAllowed()

  if (!workerConfigured()) {
    return {
      status: 'unavailable',
      pgbackrestOk: false,
      stanzaOk: false,
      stanza: STANZA,
      allowRestore,
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
      allowRestore,
    }
  } catch {
    return {
      status: 'unavailable',
      pgbackrestOk: false,
      stanzaOk: false,
      stanza: STANZA,
      allowRestore,
    }
  }
}

export async function isPgBackRestAvailable(): Promise<boolean> {
  const health = await getBackupWorkerHealth()
  return health.status === 'healthy' && health.stanzaOk
}

export async function initPgBackRestWorker(): Promise<{
  success: boolean
  needsPostgresRestart?: boolean
}> {
  const data = await workerFetch<{
    success: boolean
    stanzaOk?: boolean
    needsPostgresRestart?: boolean
  }>('/init', {
    method: 'POST',
    timeoutMs: 3_600_000,
  })
  return {
    success: Boolean(data.success),
    needsPostgresRestart: Boolean(data.needsPostgresRestart),
  }
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
  const size = backup?.size ?? 0
  const backupDate = parsePgBackRestTimestamp(backup?.timestamp)

  return {
    label,
    size,
    metadata: {
      pgbackrest: {
        stanza: STANZA,
        label,
        type: result.type,
        timestamp: backupDate?.toISOString(),
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
  const allowed = await isPgBackRestRestoreAllowed()
  if (!allowed) {
    throw new Error(
      'Restauración pgBackRest deshabilitada. Actívala en Admin → Backups → Config → Restauración pgBackRest.'
    )
  }

  await workerFetch('/restore', {
    method: 'POST',
    body: { ...options, set: options.label, uiAuthorized: true },
    timeoutMs: 7_200_000,
  })
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
  const hiddenLabels = await getHiddenPgBackRestLabels()
  const info = await fetchPgBackRestInfo()
  const stanzaInfo = info.find(s => s.name === STANZA || s.stanza === STANZA) || info[0]
  const sets = stanzaInfo?.backup || []
  let synced = 0

  for (const set of sets) {
    if (!set.label || hiddenLabels.has(set.label)) continue
    const existing = await prisma.backups.findFirst({ where: { label: set.label } })
    if (existing) continue

    const kind = mapPgBackRestType(set.type)
    const size = pgBackRestBackupSize(set)
    const createdAt = parsePgBackRestTimestamp(set.timestamp) ?? new Date()
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
          createdAt: createdAt.toISOString(),
          pgbackrest: { stanza: STANZA, label: set.label, type: set.type },
        }),
        createdAt,
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
