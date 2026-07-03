import { BatchAlertService } from '@/lib/services/batch-alert.service'

/**
 * Job: check-batch-utilization
 * Revisa lotes con stock bajo o alta utilización y notifica a administradores.
 */
export async function checkBatchUtilization() {
  console.log('[CRON] Verificando alertas de utilización de lotes...')
  const result = await BatchAlertService.checkUtilizationAlerts()
  console.log(
    `[CRON] Lotes revisados: ${result.batchesChecked}, alertas in-app: ${result.alertsSent}, emails: ${result.emailsSent}`
  )
  return result
}
