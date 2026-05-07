import { ContractPaymentService } from '../services/contract-payment.service'

export async function checkPaymentAlerts() {
  console.log('[CRON] Verificando alertas de pagos...')

  try {
    const result = await ContractPaymentService.checkPaymentAlerts()

    console.log('[CRON] Verificación de pagos completada:', result)

    return result
  } catch (error) {
    console.error('[CRON] Error verificando pagos:', error)
    throw error
  }
}
