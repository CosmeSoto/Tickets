/**
 * Template: Ticket resuelto (cliente / calificador)
 */

import {
  brandingFromTemplateData,
  ticketNumberFrom,
  ticketTitleFrom,
  truncateForEmail,
  resolveAbsoluteUrl,
} from '../email-template-utils'
import {
  buildBrandedEmailHtml,
  buildInfoTable,
  buildLegalFooterText,
  buildPrimaryButton,
  escapeHtml,
} from '../email-layout'

export default function ticketResolvedTemplate(data: Record<string, unknown>) {
  const branding = brandingFromTemplateData(data)
  const clientName = String(data.clientName || 'Usuario')
  const technicianName = String(data.technicianName || 'el equipo de soporte')
  const ticketNumber = ticketNumberFrom(data)
  const ticketTitle = ticketTitleFrom(data)
  const resolution = truncateForEmail(String(data.resolution || 'Consulte el detalle en el sistema.'))
  const isPatrol = Boolean(data.isPatrolEscalation)
  const rolePrefix = String(data.rolePrefix || 'client')
  const ticketUrl = resolveAbsoluteUrl(
    branding.baseUrl,
    String(data.ticketUrl || `/${rolePrefix}/tickets/${data.ticketId || ''}`)
  )
  const ratingUrl = resolveAbsoluteUrl(
    branding.baseUrl,
    String(data.ratingUrl || `/${rolePrefix}/tickets/${data.ticketId || ''}?rate=1`)
  )

  const bodyHtml = `
    <p style="margin:0 0 16px;">Hola <strong>${escapeHtml(clientName)}</strong>,</p>
    <p style="margin:0 0 8px;">
      ${isPatrol ? 'El ticket escalado' : 'Su ticket'} <strong>#${escapeHtml(ticketNumber)}</strong>
      fue marcado como resuelto por ${escapeHtml(technicianName)}.
    </p>
    ${buildInfoTable([{ label: 'Ticket', value: ticketTitle }])}
    <p style="margin:0 0 8px;color:#71717a;font-size:13px;line-height:1.5;"><strong>Resolución:</strong> ${escapeHtml(resolution)}</p>
    ${buildPrimaryButton(ratingUrl, 'Calificar servicio', branding.primaryColor)}
    <p style="margin:8px 0 0;text-align:center;">
      <a href="${escapeHtml(ticketUrl)}" style="color:${branding.primaryColor};font-size:13px;text-decoration:underline;">Ver detalle del ticket</a>
    </p>
  `

  const html = buildBrandedEmailHtml({
    branding,
    preheader: `Ticket #${ticketNumber} resuelto en ${branding.systemName}.`,
    headline: 'Ticket resuelto',
    bodyHtml,
  })

  const text = `${branding.systemName} — Ticket resuelto

Hola ${clientName},

Ticket #${ticketNumber} resuelto por ${technicianName}.
${ticketTitle}

Resolución: ${resolution}

Calificar: ${ratingUrl}
Detalle: ${ticketUrl}

${buildLegalFooterText(branding)}`

  return { html, text }
}
