/**
 * Template: Resumen semanal
 */

import { brandingFromTemplateData } from '../email-template-utils'
import {
  buildBrandedEmailHtml,
  buildInfoTable,
  buildLegalFooterText,
  buildPrimaryButton,
  escapeHtml,
} from '../email-layout'

export interface WeeklyDigestData {
  systemName?: string
  userName: string
  roleLabel: string
  periodLabel: string
  dashboardUrl: string
  notificationsUrl: string
  stats: { label: string; value: number | string }[]
  highlights: string[]
  logoUrl?: string | null
  primaryColor?: string
  baseUrl?: string
  privacyUrl?: string
  termsUrl?: string
}

export default function weeklyDigestTemplate(data: WeeklyDigestData) {
  const branding = brandingFromTemplateData(data as unknown as Record<string, unknown>)
  const statsRows = data.stats.map(s => ({
    label: s.label,
    value: String(s.value),
  }))

  const highlightsHtml =
    data.highlights.length > 0
      ? `<ul style="margin:0;padding-left:18px;color:#52525b;font-size:13px;line-height:1.6;">
          ${data.highlights.map(h => `<li style="margin-bottom:4px;">${escapeHtml(h)}</li>`).join('')}
        </ul>`
      : `<p style="margin:0;color:#71717a;font-size:13px;">Sin novedades destacadas esta semana.</p>`

  const bodyHtml = `
    <p style="margin:0 0 16px;">Hola <strong>${escapeHtml(data.userName)}</strong>,</p>
    <p style="margin:0 0 8px;">Resumen semanal como <strong>${escapeHtml(data.roleLabel)}</strong> · ${escapeHtml(data.periodLabel)}.</p>
    ${buildInfoTable(statsRows)}
    <p style="margin:16px 0 8px;font-size:14px;font-weight:600;color:#18181b;">Destacados</p>
    ${highlightsHtml}
    ${buildPrimaryButton(data.dashboardUrl, 'Ir al dashboard', branding.primaryColor)}
    <p style="margin:8px 0 0;text-align:center;">
      <a href="${escapeHtml(data.notificationsUrl)}" style="color:${branding.primaryColor};font-size:13px;text-decoration:underline;">Ver notificaciones</a>
    </p>
    <p style="margin:16px 0 0;color:#a1a1aa;font-size:11px;line-height:1.5;text-align:center;">
      Puede desactivar este resumen en Configuración → Notificaciones.
    </p>
  `

  const html = buildBrandedEmailHtml({
    branding,
    preheader: `Resumen semanal ${data.periodLabel} — ${branding.systemName}`,
    headline: 'Resumen semanal',
    bodyHtml,
  })

  const statsText = data.stats.map(s => `- ${s.label}: ${s.value}`).join('\n')
  const highlightsText =
    data.highlights.length > 0
      ? data.highlights.map(h => `- ${h}`).join('\n')
      : 'Sin novedades destacadas.'

  const text = `${branding.systemName} — Resumen semanal

Hola ${data.userName},

${data.periodLabel} · ${data.roleLabel}

${statsText}

Destacados:
${highlightsText}

Dashboard: ${data.dashboardUrl}
Notificaciones: ${data.notificationsUrl}

${buildLegalFooterText(branding)}`

  return { html, text }
}
