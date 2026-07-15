import { DEFAULT_SYSTEM_NAME } from '@/lib/branding-constants'
import type { BatchUtilizationAlert } from '@/lib/inventory/batch-alerts'

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'
}

export function buildBatchAlertEmailHtml(params: {
  adminName: string
  batchCode: string
  brandModel: string
  alert: BatchUtilizationAlert
  metrics: {
    total: number
    available: number
    assigned: number
    utilizationRate: number
  }
  batchId: string
  systemName?: string
}): string {
  const {
    adminName,
    batchCode,
    brandModel,
    alert,
    metrics,
    batchId,
    systemName = DEFAULT_SYSTEM_NAME,
  } = params

  const batchUrl = `${appUrl()}/inventory/batches/${batchId}`
  const isCritical = alert.level === 'critical'

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.5; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${isCritical ? '#dc2626' : '#d97706'}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; }
    .info-box { background: white; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 16px 0; }
    .button { display: inline-block; background: #2563eb; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; padding: 16px; }
    .metric { display: inline-block; margin-right: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin:0;">${isCritical ? '⚠️ Utilización crítica de lote' : '⚡ Alerta de utilización de lote'}</h2>
    </div>
    <div class="content">
      <p>Hola <strong>${adminName}</strong>,</p>
      <p>${alert.message}</p>
      <div class="info-box">
        <p><strong>Lote:</strong> ${batchCode}</p>
        <p><strong>Equipo:</strong> ${brandModel}</p>
        <p>
          <span class="metric"><strong>Total:</strong> ${metrics.total}</span>
          <span class="metric"><strong>Disponibles:</strong> ${metrics.available}</span>
          <span class="metric"><strong>Asignados:</strong> ${metrics.assigned}</span>
          <span class="metric"><strong>Utilización:</strong> ${metrics.utilizationRate}%</span>
        </p>
      </div>
      <p style="text-align:center; margin: 24px 0;">
        <a class="button" href="${batchUrl}">Ver lote</a>
      </p>
    </div>
    <div class="footer">
      <p>${systemName} — mensaje automático</p>
    </div>
  </div>
</body>
</html>
`.trim()
}
