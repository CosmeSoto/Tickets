import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { getConfigLabelMap, getConfigModuleName } from './config-audit-labels'

export type ConfigChangeEntry = {
  label: string
  antes: string
  despues: string
}

export type ConfigDiffResult = {
  changes: Record<string, ConfigChangeEntry>
  summary: string
  totalChanges: number
}

export const CONFIG_AUDIT_IGNORE_FIELDS = new Set([
  'id',
  'familyId',
  'createdAt',
  'updatedAt',
  'metadata',
  'context',
  'family',
  'category',
  'users',
  '_count',
])

function humanizeField(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, c => c.toUpperCase())
    .trim()
}

function normalizeForCompare(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function formatConfigValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return 'No configurado'
  if (typeof value === 'boolean') return value ? 'Habilitado' : 'Deshabilitado'
  if (key === 'smtpPassword' && value) return '(configurada)'
  if (key === 'priority' && typeof value === 'string') {
    const map: Record<string, string> = {
      URGENT: 'Urgente',
      HIGH: 'Alta',
      MEDIUM: 'Media',
      LOW: 'Baja',
    }
    return map[value] ?? value
  }
  if (key === 'backupFrequency' && typeof value === 'string') {
    const map: Record<string, string> = {
      daily: 'Diario',
      weekly: 'Semanal',
      monthly: 'Mensual',
      hourly: 'Cada hora',
    }
    return map[value] ?? value
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return 'Ninguno'
    return value.map(v => String(v)).join(', ')
  }
  if (typeof value === 'object') {
    try {
      const parsed = value as Record<string, unknown>
      if ('visible' in parsed || 'required' in parsed) {
        return JSON.stringify(parsed)
      }
    } catch {
      /* ignore */
    }
    return JSON.stringify(value)
  }
  if (key.includes('Days') && typeof value === 'string' && value.includes(',')) {
    return value
      .split(',')
      .map(d => d.trim())
      .join(', ')
  }
  if (typeof value === 'number' && key.includes('Days')) return `${value} días`
  if (typeof value === 'number' && key.includes('Hours')) return `${value} h`
  if (typeof value === 'number' && key.includes('Pct')) return `${value}%`
  if (typeof value === 'number' && key.includes('Minutes')) return `${value} min`
  return String(value)
}

export function buildConfigDiff(
  oldValues: Record<string, unknown> | null | undefined,
  newValues: Record<string, unknown>,
  labels: Record<string, string>,
  options?: { keys?: string[]; ignoreFields?: string[] }
): ConfigDiffResult {
  const ignore = new Set([...CONFIG_AUDIT_IGNORE_FIELDS, ...(options?.ignoreFields ?? [])])
  const keys = options?.keys ?? [
    ...new Set([...Object.keys(oldValues ?? {}), ...Object.keys(newValues)]),
  ]

  const changes: Record<string, ConfigChangeEntry> = {}

  for (const key of keys) {
    if (ignore.has(key)) continue
    const oldRaw = oldValues?.[key]
    const newRaw = newValues[key]
    if (normalizeForCompare(oldRaw) === normalizeForCompare(newRaw)) continue

    changes[key] = {
      label: labels[key] ?? humanizeField(key),
      antes: formatConfigValue(key, oldRaw),
      despues: formatConfigValue(key, newRaw),
    }
  }

  const summary =
    Object.keys(changes).length > 0
      ? Object.values(changes)
          .map(c => `${c.label}: ${c.antes} → ${c.despues}`)
          .join(' · ')
      : 'Sin cambios detectados'

  return {
    changes,
    summary,
    totalChanges: Object.keys(changes).length,
  }
}

export function enrichDetailsWithConfigDiff(
  action: string,
  details: Record<string, unknown> | undefined,
  oldValues?: Record<string, unknown> | null,
  newValues?: Record<string, unknown> | null
): Record<string, unknown> {
  const base = { ...(details ?? {}) }
  if (!oldValues || !newValues) return base

  const diff = buildConfigDiff(oldValues, newValues, getConfigLabelMap(action))
  return {
    ...base,
    module: getConfigModuleName(action),
    changes: diff.changes,
    summary: diff.summary,
    totalChanges: diff.totalChanges,
    oldValues,
    newValues,
  }
}

export async function logConfigAudit(params: {
  action: string
  entityType: string
  entityId: string
  userId: string
  userEmail?: string | null
  details?: Record<string, unknown>
  oldValues?: Record<string, unknown> | null
  newValues?: Record<string, unknown> | null
}): Promise<void> {
  const details = enrichDetailsWithConfigDiff(
    params.action,
    params.details,
    params.oldValues,
    params.newValues
  )

  await prisma.audit_logs.create({
    data: {
      id: randomUUID(),
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      userId: params.userId,
      userEmail: params.userEmail ?? null,
      createdAt: new Date(),
      details: details as object,
    },
  })
}

/** Convierte un registro Prisma a objeto plano para diff */
export function toAuditSnapshot(record: Record<string, unknown> | null | undefined) {
  if (!record) return {}
  return JSON.parse(JSON.stringify(record)) as Record<string, unknown>
}
