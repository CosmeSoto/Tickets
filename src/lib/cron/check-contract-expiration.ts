/**
 * Job: check-contract-expiration
 *
 * Revisa contratos próximos a vencer y envía notificaciones.
 * Se ejecuta diariamente desde el endpoint /api/cron/contracts.
 */

import { ContractService } from '@/lib/services/contract-service'

export async function checkContractExpiration() {
  console.log('[CRON] Verificando vencimientos de contratos...')
  const result = await ContractService.checkExpirations()
  console.log(`[CRON] Alertas enviadas: ${result.alertsSent}, Marcados como vencidos: ${result.markedExpired}`)
  return result
}
