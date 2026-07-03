import { prisma } from '@/lib/prisma'

export interface BatchAlertSettings {
  enabled: boolean
  emailOnCritical: boolean
  emailOnWarning: boolean
  lowStockThresholdPct: number
}

const DEFAULTS: BatchAlertSettings = {
  enabled: true,
  emailOnCritical: true,
  emailOnWarning: false,
  lowStockThresholdPct: 15,
}

const KEYS = {
  enabled: 'inventory.batch_utilization_alert_enabled',
  emailOnCritical: 'inventory.batch_utilization_email_critical',
  emailOnWarning: 'inventory.batch_utilization_email_warning',
  lowStockThresholdPct: 'inventory.batch_low_stock_threshold_pct',
} as const

const cache = new Map<string, { settings: BatchAlertSettings; expiresAt: number }>()
const CACHE_MS = 60_000

async function loadGlobalSettings(): Promise<BatchAlertSettings> {
  const rows = await prisma.system_settings.findMany({
    where: { key: { in: Object.values(KEYS) } },
  })
  const map = new Map(rows.map(r => [r.key, r.value]))

  return {
    enabled: parseBool(map.get(KEYS.enabled), DEFAULTS.enabled),
    emailOnCritical: parseBool(map.get(KEYS.emailOnCritical), DEFAULTS.emailOnCritical),
    emailOnWarning: parseBool(map.get(KEYS.emailOnWarning), DEFAULTS.emailOnWarning),
    lowStockThresholdPct:
      parseInt(map.get(KEYS.lowStockThresholdPct) ?? '', 10) || DEFAULTS.lowStockThresholdPct,
  }
}

/**
 * Configuración de alertas de lotes.
 * Sin familyId → reglas globales.
 * Con familyId → fusiona overrides de inventory_family_config (null = heredar global).
 */
export async function getBatchAlertSettings(familyId?: string | null): Promise<BatchAlertSettings> {
  const cacheKey = familyId ?? '__global__'
  const hit = cache.get(cacheKey)
  if (hit && Date.now() < hit.expiresAt) return hit.settings

  const global = await loadGlobalSettings()
  if (!familyId) {
    cache.set(cacheKey, { settings: global, expiresAt: Date.now() + CACHE_MS })
    return global
  }

  const familyConfig = await prisma.inventory_family_config.findUnique({
    where: { familyId },
    select: {
      batchUtilizationAlertEnabled: true,
      batchUtilizationEmailCritical: true,
      batchUtilizationEmailWarning: true,
      batchLowStockThresholdPct: true,
    },
  })

  const settings: BatchAlertSettings = {
    enabled: familyConfig?.batchUtilizationAlertEnabled ?? global.enabled,
    emailOnCritical: familyConfig?.batchUtilizationEmailCritical ?? global.emailOnCritical,
    emailOnWarning: familyConfig?.batchUtilizationEmailWarning ?? global.emailOnWarning,
    lowStockThresholdPct: familyConfig?.batchLowStockThresholdPct ?? global.lowStockThresholdPct,
  }

  cache.set(cacheKey, { settings, expiresAt: Date.now() + CACHE_MS })
  return settings
}

export function invalidateBatchAlertSettingsCache(familyId?: string | null): void {
  if (familyId) {
    cache.delete(familyId)
  } else {
    cache.clear()
  }
}

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback
  return value === 'true'
}
