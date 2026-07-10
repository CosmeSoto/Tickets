import {
  fetchPgBackRestInfo,
  getBackupWorkerHealth,
  syncPgBackRestToDatabase,
} from './backup-engine'

/** Sincroniza pgBackRest → tabla backups antes de métricas/alertas. */
export async function ensureBackupCatalogSynced(): Promise<void> {
  await syncPgBackRestToDatabase().catch(err => {
    console.warn('[BACKUP HEALTH] sync pgBackRest:', err)
  })
}

export async function countPgBackRestBackups(): Promise<number> {
  try {
    const info = await fetchPgBackRestInfo()
    const stanza = info[0]
    return Array.isArray(stanza?.backup) ? stanza!.backup!.length : 0
  } catch {
    return 0
  }
}

export async function isPgBackRestInfrastructureOk(): Promise<boolean> {
  const health = await getBackupWorkerHealth()
  return health.status === 'healthy' && health.stanzaOk
}

/** Tasa de éxito: completados / (completados + fallidos), ignora in_progress. */
export function computeSuccessRate(completed: number, failed: number): number | null {
  const terminal = completed + failed
  if (terminal === 0) return null
  return Math.round((completed / terminal) * 10000) / 100
}
