import { ContractAlertService } from '../services/contract-alert.service'

export async function checkContractExpiration() {
  console.log('[CRON] Verificando vencimiento de contratos...')

  try {
    const expiration = await ContractAlertService.checkExpirations()
    const governance = await ContractAlertService.checkSubscriptionGovernance()

    const result = { ...expiration, subscriptionGovernance: governance }

    console.log('[CRON] Verificación completada:', result)

    return result
  } catch (error) {
    console.error('[CRON] Error verificando contratos:', error)
    throw error
  }
}
