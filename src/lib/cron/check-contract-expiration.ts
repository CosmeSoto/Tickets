import { ContractAlertService } from '../services/contract-alert.service'
import { isInventoryAlertEnabled } from '@/lib/settings/runtime-settings'

export async function checkContractExpiration() {
  console.log('[CRON] Verificando vencimiento de contratos...')

  try {
    // Mismo toggle de Reglas generales: "Alertas de vencimiento de licencias y contratos"
    const licenseEnabled = await isInventoryAlertEnabled('inventory.license_alert_enabled')
    if (!licenseEnabled) {
      console.log('[CRON] Alertas de contratos deshabilitadas (license_alert_enabled=false)')
      return {
        skipped: true,
        reason: 'inventory.license_alert_enabled=false',
      }
    }

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
