import type { AuditLogFilter } from '@/lib/services/audit-service-complete'
import {
  getActionsForConfigModule,
  type AuditConfigModule,
} from '@/lib/services/config-audit-filters'

/** Patrones OR para presets de acciones sensibles */
export const AUDIT_ACTION_PRESET_OR: Record<
  string,
  Array<{ action: { contains: string; mode: 'insensitive' } }>
> = {
  critical: [
    { action: { contains: 'deleted', mode: 'insensitive' } },
    { action: { contains: 'login_failed', mode: 'insensitive' } },
    { action: { contains: 'role_changed', mode: 'insensitive' } },
    { action: { contains: 'restore_failed', mode: 'insensitive' } },
    { action: { contains: 'super_admin', mode: 'insensitive' } },
  ],
  security: [
    { action: { contains: 'login', mode: 'insensitive' } },
    { action: { contains: 'logout', mode: 'insensitive' } },
    { action: { contains: 'password', mode: 'insensitive' } },
  ],
}

export async function buildAuditLogWhere(
  filter: AuditLogFilter = {}
): Promise<Record<string, unknown>> {
  const {
    userId,
    entityType,
    entityId,
    action,
    startDate,
    endDate,
    search,
    familyId,
    configModule,
    actionPreset,
  } = filter

  const where: Record<string, unknown> = {}
  const andClauses: Record<string, unknown>[] = []

  if (userId) where.userId = userId
  if (entityType && entityType !== 'all') where.entityType = entityType
  if (entityId) where.entityId = entityId

  if (actionPreset && AUDIT_ACTION_PRESET_OR[actionPreset]) {
    andClauses.push({ OR: AUDIT_ACTION_PRESET_OR[actionPreset] })
  } else if (configModule && configModule !== 'all') {
    const moduleActions = getActionsForConfigModule(configModule as AuditConfigModule)
    if (moduleActions?.length) {
      where.action = { in: moduleActions }
    }
  } else if (action) {
    where.action = { contains: action, mode: 'insensitive' }
  }

  if (search) {
    andClauses.push({
      OR: [
        { action: { contains: search, mode: 'insensitive' } },
        { entityType: { contains: search, mode: 'insensitive' } },
        { entityId: { contains: search, mode: 'insensitive' } },
        { users: { name: { contains: search, mode: 'insensitive' } } },
        { users: { email: { contains: search, mode: 'insensitive' } } },
      ],
    })
  }

  if (startDate || endDate) {
    const createdAt: Record<string, Date> = {}
    if (startDate) createdAt.gte = startDate
    if (endDate) createdAt.lte = endDate
    where.createdAt = createdAt
  }

  if (familyId) {
    andClauses.push({
      OR: [{ details: { path: ['familyId'], equals: familyId } }, { entityId: familyId }],
    })
  }

  if (andClauses.length > 0) {
    where.AND = [...((where.AND as Record<string, unknown>[]) ?? []), ...andClauses]
  }

  return where
}

export function auditFiltersToQueryString(
  filters: Record<string, string | undefined>,
  extra?: Record<string, string>
): string {
  const params = new URLSearchParams()
  const entries: Record<string, string | undefined> = { ...filters, ...extra }

  for (const [key, value] of Object.entries(entries)) {
    if (!value || value === 'all' || value === '') continue
    params.set(key, value)
  }

  const qs = params.toString()
  return qs ? `?${qs}` : ''
}
