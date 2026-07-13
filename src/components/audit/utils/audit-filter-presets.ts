/**
 * Presets rápidos y utilidades de filtros de auditoría (UI)
 */

import type { AuditFilters } from '@/components/audit/utils/audit-types'
import { AUDIT_QUICK_PRESETS, type AuditQuickPresetId } from '@/lib/services/config-audit-filters'

export const AUDIT_FILTERS_STORAGE_KEY = 'audit-filters-v1'

export const DEFAULT_AUDIT_FILTERS: AuditFilters = {
  search: '',
  entityType: 'all',
  action: '',
  userId: '',
  days: '30',
  familyId: '',
  configModule: 'all',
  actionPreset: '',
}

export function parseAuditFiltersFromSearchParams(params: URLSearchParams): Partial<AuditFilters> {
  const partial: Partial<AuditFilters> = {}
  const keys: (keyof AuditFilters)[] = [
    'search',
    'entityType',
    'action',
    'userId',
    'days',
    'familyId',
    'configModule',
    'actionPreset',
  ]

  for (const key of keys) {
    const value = params.get(key)
    if (value != null && value !== '') {
      partial[key] = value
    }
  }

  return partial
}

export function auditFiltersToUrlParams(filters: AuditFilters): URLSearchParams {
  const params = new URLSearchParams()
  const entries: Record<string, string> = {
    search: filters.search,
    entityType: filters.entityType,
    action: filters.action,
    userId: filters.userId,
    days: filters.days,
    familyId: filters.familyId,
    configModule: filters.configModule,
    actionPreset: filters.actionPreset ?? '',
  }

  for (const [key, value] of Object.entries(entries)) {
    if (!value || value === 'all' || value === '') continue
    params.set(key, value)
  }

  return params
}

export function loadStoredAuditFilters(): Partial<AuditFilters> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(AUDIT_FILTERS_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Partial<AuditFilters>
  } catch {
    return null
  }
}

export function saveAuditFilters(filters: AuditFilters): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(AUDIT_FILTERS_STORAGE_KEY, JSON.stringify(filters))
  } catch {
    /* quota / private mode */
  }
}

export function getPresetFilters(presetId: AuditQuickPresetId): AuditFilters {
  const preset = AUDIT_QUICK_PRESETS.find(p => p.id === presetId)
  if (!preset) return { ...DEFAULT_AUDIT_FILTERS }

  return {
    ...DEFAULT_AUDIT_FILTERS,
    configModule: preset.filters.configModule ?? 'all',
    entityType: preset.filters.entityType ?? 'all',
    action: preset.filters.action ?? '',
    actionPreset: preset.filters.actionPreset ?? '',
  }
}

export { AUDIT_QUICK_PRESETS, type AuditQuickPresetId }
