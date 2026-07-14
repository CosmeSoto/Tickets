import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import type { PgBackRestRestoreJob } from './backup-engine'

const RESTORE_ACTIONS = [
  'backup_restore_started',
  'backup_restored',
  'backup_restore_failed',
] as const

const BACKUP_OPERATION_ACTIONS = [
  ...RESTORE_ACTIONS,
  'backup_created',
  'backup_deleted',
  'backup_imported',
  'backup_uploaded_cloud',
] as const

export type BackupOperationKind =
  | 'created'
  | 'imported'
  | 'deleted'
  | 'uploaded'
  | 'restore'
  | 'restore_failed'

export type RestoreHistoryStatus = 'running' | 'success' | 'failed'

export type BackupOperationEntry = {
  id: string
  kind: BackupOperationKind
  backupId: string
  filename: string | null
  label: string | null
  engine: string | null
  mode: string | null
  status: RestoreHistoryStatus
  message: string | null
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
  userEmail: string | null
  async: boolean
  size: number | null
  backupType: string | null
}

/** @deprecated use BackupOperationEntry */
export type RestoreHistoryEntry = BackupOperationEntry

function detailsRecord(details: unknown): Record<string, unknown> {
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    return details as Record<string, unknown>
  }
  return {}
}

function parseRestoreHistoryFromAudits(
  audits: Array<{
    id: string
    action: string
    entityId: string
    userEmail: string | null
    details: unknown
    createdAt: Date
  }>
): BackupOperationEntry[] {
  const started = audits.filter(a => a.action === 'backup_restore_started')
  const outcomes = audits.filter(
    a => a.action === 'backup_restored' || a.action === 'backup_restore_failed'
  )

  const entries = started.map(start => {
    const details = detailsRecord(start.details)
    const outcome = outcomes.find(
      o =>
        o.entityId === start.entityId &&
        o.createdAt >= start.createdAt &&
        (details.label == null ||
          detailsRecord(o.details).label === details.label ||
          detailsRecord(o.details).backupId === start.entityId)
    )

    const outcomeDetails = outcome ? detailsRecord(outcome.details) : {}
    const finishedAt = outcome?.createdAt ?? null
    const durationMs = finishedAt != null ? finishedAt.getTime() - start.createdAt.getTime() : null

    let status: RestoreHistoryStatus = 'running'
    if (outcome?.action === 'backup_restored') status = 'success'
    if (outcome?.action === 'backup_restore_failed') status = 'failed'

    return {
      id: start.id,
      kind: status === 'failed' ? ('restore_failed' as const) : ('restore' as const),
      backupId: start.entityId,
      filename:
        typeof details.filename === 'string'
          ? details.filename
          : typeof outcomeDetails.filename === 'string'
            ? outcomeDetails.filename
            : null,
      label: typeof details.label === 'string' ? details.label : null,
      engine: typeof details.engine === 'string' ? details.engine : null,
      mode: typeof details.mode === 'string' ? details.mode : null,
      status,
      message:
        typeof outcomeDetails.message === 'string'
          ? outcomeDetails.message
          : typeof outcomeDetails.error === 'string'
            ? outcomeDetails.error
            : null,
      startedAt: start.createdAt.toISOString(),
      finishedAt: finishedAt?.toISOString() ?? null,
      durationMs,
      userEmail: start.userEmail,
      async: details.async === true,
      size: null,
      backupType: typeof details.type === 'string' ? details.type : null,
    }
  })

  const pairedOutcomeIds = new Set(
    outcomes
      .filter(o =>
        started.some(
          s =>
            s.entityId === o.entityId &&
            o.createdAt >= s.createdAt &&
            (detailsRecord(s.details).label == null ||
              detailsRecord(o.details).label === detailsRecord(s.details).label)
        )
      )
      .map(o => o.id)
  )

  const standalone = outcomes
    .filter(o => !pairedOutcomeIds.has(o.id))
    .map(o => {
      const d = detailsRecord(o.details)
      const createdAt = o.createdAt
      return {
        id: o.id,
        kind: (o.action === 'backup_restored'
          ? 'restore'
          : 'restore_failed') as BackupOperationKind,
        backupId: o.entityId,
        filename: typeof d.filename === 'string' ? d.filename : null,
        label: typeof d.label === 'string' ? d.label : null,
        engine: typeof d.engine === 'string' ? d.engine : null,
        mode: typeof d.mode === 'string' ? d.mode : null,
        status: (o.action === 'backup_restored' ? 'success' : 'failed') as RestoreHistoryStatus,
        message:
          typeof d.message === 'string' ? d.message : typeof d.error === 'string' ? d.error : null,
        startedAt: createdAt.toISOString(),
        finishedAt: createdAt.toISOString(),
        durationMs: 0,
        userEmail: o.userEmail,
        async: d.async === true,
        size: null,
        backupType: typeof d.type === 'string' ? d.type : null,
      }
    })

  return [...entries, ...standalone].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  )
}

function mapSimpleAuditToOperation(audit: {
  id: string
  action: string
  entityId: string
  userEmail: string | null
  details: unknown
  createdAt: Date
}): BackupOperationEntry | null {
  const d = detailsRecord(audit.details)
  const at = audit.createdAt.toISOString()
  const size = typeof d.size === 'number' ? d.size : null
  const backupType = typeof d.type === 'string' ? d.type : null

  switch (audit.action) {
    case 'backup_created':
      return {
        id: audit.id,
        kind: 'created',
        backupId: audit.entityId,
        filename: typeof d.filename === 'string' ? d.filename : null,
        label: typeof d.label === 'string' ? d.label : null,
        engine: typeof d.engine === 'string' ? d.engine : null,
        mode: typeof d.backupKind === 'string' ? d.backupKind : null,
        status: 'success',
        message: null,
        startedAt: at,
        finishedAt: at,
        durationMs: 0,
        userEmail: audit.userEmail,
        async: false,
        size,
        backupType,
      }
    case 'backup_imported':
      return {
        id: audit.id,
        kind: 'imported',
        backupId: audit.entityId,
        filename: typeof d.filename === 'string' ? d.filename : null,
        label: null,
        engine: 'import',
        mode: typeof d.detectedModule === 'string' ? d.detectedModule : null,
        status: 'success',
        message: null,
        startedAt: at,
        finishedAt: at,
        durationMs: 0,
        userEmail: audit.userEmail,
        async: false,
        size,
        backupType: 'manual',
      }
    case 'backup_deleted':
      return {
        id: audit.id,
        kind: 'deleted',
        backupId: audit.entityId,
        filename: typeof d.filename === 'string' ? d.filename : null,
        label: null,
        engine: typeof d.engine === 'string' ? d.engine : null,
        mode: null,
        status: 'success',
        message: null,
        startedAt: at,
        finishedAt: at,
        durationMs: 0,
        userEmail: audit.userEmail,
        async: false,
        size: null,
        backupType: null,
      }
    case 'backup_uploaded_cloud':
      return {
        id: audit.id,
        kind: 'uploaded',
        backupId: audit.entityId,
        filename: typeof d.fileName === 'string' ? d.fileName : null,
        label: null,
        engine: 'export',
        mode: typeof d.provider === 'string' ? d.provider : null,
        status: 'success',
        message: typeof d.webViewLink === 'string' ? d.webViewLink : null,
        startedAt: at,
        finishedAt: at,
        durationMs: 0,
        userEmail: audit.userEmail,
        async: false,
        size,
        backupType: null,
      }
    default:
      return null
  }
}

async function enrichOperationEntries(
  entries: BackupOperationEntry[]
): Promise<BackupOperationEntry[]> {
  const backupIds = [
    ...new Set(
      entries
        .map(e => e.backupId)
        .filter(id => id && id !== 'backup' && id !== 'pgbackrest' && id !== 'unknown')
    ),
  ]
  if (backupIds.length === 0) return entries

  const backups = await prisma.backups.findMany({
    where: { id: { in: backupIds } },
    select: { id: true, filename: true, label: true, size: true, type: true, engine: true },
  })
  const byId = new Map(backups.map(b => [b.id, b]))
  for (const entry of entries) {
    const backup = byId.get(entry.backupId)
    if (!backup) continue
    entry.filename = entry.filename ?? backup.filename
    entry.label = entry.label ?? backup.label
    entry.engine = entry.engine ?? backup.engine
    entry.size = entry.size ?? backup.size
    entry.backupType = entry.backupType ?? backup.type
  }
  return entries
}

export async function getBackupOperationsHistory(options?: {
  limit?: number
  offset?: number
}): Promise<{ entries: BackupOperationEntry[]; hasMore: boolean }> {
  const limit = Math.min(Math.max(options?.limit ?? 25, 1), 100)
  const offset = Math.max(options?.offset ?? 0, 0)
  const needCount = offset + limit + 1

  const audits = await prisma.audit_logs.findMany({
    where: { action: { in: [...BACKUP_OPERATION_ACTIONS] } },
    orderBy: { createdAt: 'desc' },
    take: needCount * 5,
    select: {
      id: true,
      action: true,
      entityId: true,
      userEmail: true,
      details: true,
      createdAt: true,
    },
  })

  const restoreEntries = parseRestoreHistoryFromAudits(
    audits.filter(a => (RESTORE_ACTIONS as readonly string[]).includes(a.action))
  )
  const otherEntries = audits
    .filter(a => !(RESTORE_ACTIONS as readonly string[]).includes(a.action))
    .map(mapSimpleAuditToOperation)
    .filter((e): e is BackupOperationEntry => e != null)

  const auditedBackupIds = new Set(
    [...restoreEntries, ...otherEntries].map(e => e.backupId).filter(Boolean)
  )

  const recentBackups = await prisma.backups.findMany({
    where: {
      status: 'completed',
      engine: { in: ['export', 'import', 'pgbackrest'] },
    },
    orderBy: { createdAt: 'desc' },
    take: needCount,
    select: {
      id: true,
      filename: true,
      label: true,
      size: true,
      type: true,
      engine: true,
      createdAt: true,
    },
  })

  const legacyEntries: BackupOperationEntry[] = recentBackups
    .filter(b => !auditedBackupIds.has(b.id))
    .map(b => ({
      id: `backup-${b.id}`,
      kind: b.engine === 'import' ? ('imported' as const) : ('created' as const),
      backupId: b.id,
      filename: b.filename,
      label: b.label,
      engine: b.engine,
      mode: b.engine === 'export' ? 'export' : null,
      status: 'success' as const,
      message: 'Registro histórico (sin auditoría al momento de creación)',
      startedAt: b.createdAt.toISOString(),
      finishedAt: b.createdAt.toISOString(),
      durationMs: 0,
      userEmail: null,
      async: false,
      size: b.size,
      backupType: b.type,
    }))

  const merged = [...restoreEntries, ...otherEntries, ...legacyEntries].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  )

  const slice = merged.slice(offset, offset + limit)
  const hasMore = merged.length > offset + limit

  return {
    entries: await enrichOperationEntries(slice),
    hasMore,
  }
}

export async function getRestoreHistory(limit = 20): Promise<RestoreHistoryEntry[]> {
  const { entries } = await getBackupOperationsHistory({ limit })
  return entries.filter(
    e => e.kind === 'restore' || e.kind === 'restore_failed' || e.status === 'running'
  )
}

export async function syncPgBackRestRestoreAudit(
  job: PgBackRestRestoreJob,
  actor?: { userId?: string | null; userEmail?: string | null }
): Promise<'success' | 'failed' | 'pending' | 'already_recorded'> {
  if (job.status !== 'success' && job.status !== 'failed') {
    return 'pending'
  }

  const started = await prisma.audit_logs.findFirst({
    where: {
      action: 'backup_restore_started',
      ...(job.label
        ? {
            details: {
              path: ['label'],
              equals: job.label,
            },
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
  })

  const backupId = started?.entityId ?? job.label ?? 'unknown'
  const startedAt = started?.createdAt

  const existing = await prisma.audit_logs.findFirst({
    where: {
      action: { in: ['backup_restored', 'backup_restore_failed'] },
      entityId: backupId,
      ...(startedAt ? { createdAt: { gte: startedAt } } : {}),
      ...(job.label
        ? {
            details: {
              path: ['label'],
              equals: job.label,
            },
          }
        : {}),
    },
  })

  if (existing) return 'already_recorded'

  const backup =
    backupId !== 'unknown' ? await prisma.backups.findUnique({ where: { id: backupId } }) : null
  const action = job.status === 'success' ? 'backup_restored' : 'backup_restore_failed'

  await prisma.audit_logs.create({
    data: {
      id: randomUUID(),
      action,
      entityType: 'System',
      entityId: backupId,
      userId: actor?.userId ?? null,
      userEmail: actor?.userEmail ?? started?.userEmail ?? null,
      createdAt: job.finishedAt ? new Date(job.finishedAt) : new Date(),
      details: {
        engine: 'pgbackrest',
        label: job.label ?? backup?.label ?? null,
        filename: backup?.filename ?? null,
        backupId,
        async: true,
        ...(job.status === 'failed'
          ? { error: job.message, message: job.message }
          : { message: job.message ?? 'Restauración pgBackRest completada' }),
        finishedAt: job.finishedAt,
        startedAt: job.startedAt ?? startedAt?.toISOString() ?? null,
      },
    },
  })

  return job.status
}

export function mergeWorkerJobIntoHistory(
  entries: BackupOperationEntry[],
  job: PgBackRestRestoreJob
): BackupOperationEntry[] {
  if (job.status === 'idle') return entries

  const label = job.label
  const runningIdx = entries.findIndex(
    e => e.kind === 'restore' && e.status === 'running' && (label == null || e.label === label)
  )

  if (job.status === 'running') {
    if (runningIdx >= 0) return entries
    return [
      {
        id: `worker-${job.startedAt ?? Date.now()}`,
        kind: 'restore',
        backupId: label ?? 'pgbackrest',
        filename: label ? `${label}.pgbackrest` : null,
        label,
        engine: 'pgbackrest',
        mode: 'full',
        status: 'running',
        message: job.message,
        startedAt: job.startedAt ?? new Date().toISOString(),
        finishedAt: null,
        durationMs: null,
        userEmail: null,
        async: true,
        size: null,
        backupType: null,
      },
      ...entries,
    ]
  }

  if (runningIdx >= 0) {
    const updated = [...entries]
    updated[runningIdx] = {
      ...updated[runningIdx],
      status: job.status === 'success' ? 'success' : 'failed',
      message: job.message,
      finishedAt: job.finishedAt,
      durationMs:
        job.startedAt && job.finishedAt
          ? new Date(job.finishedAt).getTime() - new Date(job.startedAt).getTime()
          : updated[runningIdx].durationMs,
    }
    return updated
  }

  return entries
}
