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
}): string {
  const { adminName, batchCode, brandModel, alert, metrics, batchId } = params
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
      <h2 style="margin:0;">${isCritical ? '⚠️ Alerta crítica de lote' : 'Alerta de lote'}</h2>
      <p style="margin:8px 0 0; opacity:0.9;">${alert.title}</p>
    </div>
    <div class="content">
      <p>Hola ${adminName},</p>
      <p>El lote <strong>${batchCode}</strong> (${brandModel}) requiere tu atención:</p>
      <div class="info-box">
        <p><strong>${alert.title}</strong></p>
        <p>${alert.message}</p>
        <p style="margin-top:12px;">
          <span class="metric"><strong>Total:</strong> ${metrics.total}</span>
          <span class="metric"><strong>Disponibles:</strong> ${metrics.available}</span>
          <span class="metric"><strong>Asignados:</strong> ${metrics.assigned}</span>
          <span class="metric"><strong>Utilización:</strong> ${metrics.utilizationRate.toFixed(0)}%</span>
        </p>
      </div>
      ${
        isCritical
          ? `<p><strong>Acciones sugeridas:</strong></p>
      <ul>
        <li>Revisar disponibilidad y planificar recompra si es necesario</li>
        <li>Usar <em>Crear lote similar</em> desde el detalle del lote</li>
        <li>Coordinar con el área responsable del inventario</li>
      </ul>`
          : ''
      }
      <p style="text-align:center; margin-top:24px;">
        <a href="${batchUrl}" class="button">Ver detalle del lote</a>
      </p>
    </div>
    <div class="footer">
      <p>Sistema de Gestión de Inventario — mensaje automático</p>
    </div>
  </div>
</body>
</html>`.trim()
}
