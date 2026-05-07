/**
 * Job: check-rental-expiration
 *
 * Revisa equipos arrendados próximos a vencer y envía notificaciones.
 * Se ejecuta diariamente desde el endpoint /api/cron/rentals.
 */

import { RentalAlertService } from '@/lib/services/rental-alert.service'

export async function checkRentalExpiration() {
  console.log('[CRON] Verificando vencimientos de arrendamientos...')
  const result = await RentalAlertService.checkExpirations()
  console.log(
    `[CRON] Alertas de equipos enviadas: ${result.alertsSent}, Contratos de arrendamiento por vencer: ${result.contractsExpiring.length}`
  )
  return result
}
