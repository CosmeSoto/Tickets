import type { EmailBranding } from './email-branding'

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

interface BrandedEmailOptions {
  branding: EmailBranding
  /** Texto oculto en clientes de correo (preview) */
  preheader: string
  /** Título visible bajo el logo */
  headline: string
  bodyHtml: string
}

/**
 * Layout HTML reutilizable para correos transaccionales del sistema.
 */
export function buildBrandedEmailHtml(options: BrandedEmailOptions): string {
  const { branding, preheader, headline, bodyHtml } = options
  const { systemName, logoUrl, primaryColor, privacyUrl } = branding

  const logoBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(systemName)}" width="160" style="display:block;margin:0 auto 12px;max-width:160px;height:auto;border:0;" />`
    : ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(headline)} — ${escapeHtml(systemName)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;border-collapse:collapse;background-color:#ffffff;border-radius:8px;border:1px solid #e4e4e7;">
          <tr>
            <td style="padding:28px 32px 20px;text-align:center;border-bottom:3px solid ${primaryColor};">
              ${logoBlock}
              <p style="margin:0 0 4px;color:#18181b;font-size:18px;font-weight:600;line-height:1.3;">${escapeHtml(systemName)}</p>
              <p style="margin:0;color:#71717a;font-size:14px;line-height:1.4;">${escapeHtml(headline)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;color:#3f3f46;font-size:15px;line-height:1.6;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;background-color:#fafafa;border-top:1px solid #e4e4e7;border-radius:0 0 8px 8px;">
              <p style="margin:0 0 8px;color:#71717a;font-size:11px;line-height:1.5;text-align:center;">
                Mensaje automático de ${escapeHtml(systemName)}. No responda a este correo.
              </p>
              <p style="margin:0;color:#a1a1aa;font-size:11px;line-height:1.5;text-align:center;">
                Tratamos sus datos conforme a la LOPDP Ecuador.
                <a href="${escapeHtml(branding.termsUrl)}" style="color:${primaryColor};text-decoration:underline;">Términos</a>
                ·
                <a href="${escapeHtml(privacyUrl)}" style="color:${primaryColor};text-decoration:underline;">Privacidad</a>
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

export function buildPrimaryButton(
  href: string,
  label: string,
  primaryColor: string
): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;border-collapse:collapse;">
  <tr>
    <td align="center" style="border-radius:6px;background-color:${primaryColor};">
      <a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:12px 28px;color:#18181b;font-size:15px;font-weight:600;text-decoration:none;border-radius:6px;">
        ${escapeHtml(label)}
      </a>
    </td>
  </tr>
</table>`
}

export function buildInfoTable(rows: Array<{ label: string; value: string }>): string {
  if (rows.length === 0) return ''
  const rowsHtml = rows
    .map(
      row => `<tr>
        <td style="color:#71717a;font-size:13px;padding:8px 0;border-bottom:1px solid #f4f4f5;">${escapeHtml(row.label)}</td>
        <td style="color:#18181b;font-size:13px;font-weight:600;padding:8px 0;text-align:right;border-bottom:1px solid #f4f4f5;">${escapeHtml(row.value)}</td>
      </tr>`
    )
    .join('')

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-collapse:collapse;background:#fafafa;border-radius:6px;">
  <tr><td style="padding:12px 16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rowsHtml}</table></td></tr>
</table>`
}

export function buildLegalFooterText(branding: EmailBranding): string {
  return `Mensaje automático de ${branding.systemName}. No responda a este correo. LOPDP Ecuador: ${branding.termsUrl} · ${branding.privacyUrl}`
}
