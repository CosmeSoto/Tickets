import { DEFAULT_SYSTEM_NAME } from '@/lib/branding-constants'

export interface WeeklyDigestData {
  systemName?: string
  userName: string
  roleLabel: string
  periodLabel: string
  dashboardUrl: string
  notificationsUrl: string
  stats: {
    label: string
    value: number | string
  }[]
  highlights: string[]
}

export default function weeklyDigestTemplate(data: WeeklyDigestData) {
  const systemName = data.systemName || DEFAULT_SYSTEM_NAME
  const statsRows = data.stats
    .map(
      s => `
      <tr>
        <td style="color:#6b7280;font-size:14px;padding:8px 0;border-bottom:1px solid #f3f4f6;">${s.label}</td>
        <td style="color:#111827;font-size:16px;font-weight:700;padding:8px 0;text-align:right;border-bottom:1px solid #f3f4f6;">${s.value}</td>
      </tr>`
    )
    .join('')

  const highlightsHtml =
    data.highlights.length > 0
      ? `<ul style="color:#374151;font-size:14px;line-height:1.6;padding-left:18px;margin:0;">
          ${data.highlights.map(h => `<li style="margin-bottom:6px;">${h}</li>`).join('')}
        </ul>`
      : `<p style="color:#6b7280;font-size:14px;margin:0;">Sin novedades destacadas esta semana.</p>`

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Resumen semanal</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background-color:#f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#0f766e;padding:28px 30px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:22px;">Resumen semanal</h1>
              <p style="color:#ccfbf1;margin:8px 0 0;font-size:13px;">${systemName} · ${data.periodLabel}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 30px;">
              <p style="color:#374151;font-size:16px;line-height:1.5;margin:0 0 12px;">
                Hola <strong>${data.userName}</strong>,
              </p>
              <p style="color:#4b5563;font-size:14px;line-height:1.5;margin:0 0 20px;">
                Este es tu resumen semanal como <strong>${data.roleLabel}</strong>.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:6px;margin:0 0 20px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      ${statsRows}
                    </table>
                  </td>
                </tr>
              </table>

              <h2 style="color:#111827;font-size:15px;margin:0 0 10px;">Destacados</h2>
              ${highlightsHtml}

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
                <tr>
                  <td align="center">
                    <a href="${data.dashboardUrl}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-size:14px;font-weight:600;margin:0 6px 8px;">
                      Ir al dashboard
                    </a>
                    <a href="${data.notificationsUrl}" style="display:inline-block;background:#f3f4f6;color:#111827;text-decoration:none;padding:12px 22px;border-radius:6px;font-size:14px;font-weight:600;margin:0 6px 8px;">
                      Ver notificaciones
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:16px 30px;text-align:center;">
              <p style="color:#9ca3af;font-size:12px;margin:0;">
                Puedes desactivar este resumen en Configuración → Notificaciones → Reporte semanal.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
