/**
 * Lectura de configuraciones del sistema en runtime.
 * Usa getSetting con caché — invalidar al guardar en los endpoints PUT correspondientes.
 */

import { getSetting } from '@/lib/api-cache'

export async function getAutoAssignmentEnabled(): Promise<boolean> {
  const value = await getSetting('autoAssignmentEnabled', 600, 'true')
  return value === 'true'
}

export async function getMaxTicketsPerUser(): Promise<number> {
  const value = (await getSetting('maxTicketsPerUser', 600, '10')) ?? '10'
  const parsed = parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10
}

export async function getInventoryActExpirationDays(): Promise<number> {
  const value = (await getSetting('inventory.act_expiration_days', 600, '7')) ?? '7'
  const parsed = parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 7
}

export async function isInventoryAlertEnabled(
  key: string,
  defaultEnabled = true
): Promise<boolean> {
  const value = await getSetting(key, 600, defaultEnabled ? 'true' : 'false')
  return value !== 'false'
}

export function addActExpirationDays(from: Date, days: number): Date {
  const result = new Date(from)
  result.setDate(result.getDate() + days)
  return result
}
