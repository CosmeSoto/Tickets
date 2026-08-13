/**
 * Template: Ticket creado (cliente)
 */

import {
  brandingFromTemplateData,
  PRIORITY_LABELS,
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

export default function ticketCreatedTemplate(data: Record<string, unknown>) {
  const branding = brandingFromTemplateData(data)
  const clientName = String(data.clientName || 'Usuario')
  const ticketNumber = ticketNumberFrom(data)
  const ticketTitle = ticketTitleFrom(data)
  const category = String(data.category || '—')
  const priority = String(data.priority || 'MEDIUM')
  const priorityLabel = PRIORITY_LABELS[priority] || priority
  const description = truncateForEmail(String(data.description || ''))
  const ticketUrl = resolveAbsoluteUrl(
    branding.baseUrl,
    String(data.ticketUrl || `/client/tickets/${data.ticketId || ''}`)
  )

  const bodyHtml = `
    <p style="margin:0 0 16px;">Hola <strong>${escapeHtml(clientName)}</strong>,</p>
    <p style="margin:0 0 8px;">Su ticket fue registrado en <strong>${escapeHtml(branding.systemName)}</strong>. Le avisaremos cuando haya novedades.</p>
    ${buildInfoTable([
      { label: 'Ticket', value: `#${ticketNumber}` },
      { label: 'Título', value: ticketTitle },
      { label: 'Categoría', value: category },
      { label: 'Prioridad', value: priorityLabel },
    ])}
    ${description ? `<p style="margin:0 0 8px;color:#71717a;font-size:13px;line-height:1.5;"><strong>Resumen:</strong> ${escapeHtml(description)}</p>` : ''}
    ${buildPrimaryButton(ticketUrl, 'Ver ticket', branding.primaryColor)}
  `

  const html = buildBrandedEmailHtml({
    branding,
    preheader: `Ticket #${ticketNumber} registrado en ${branding.systemName}.`,
    headline: 'Ticket registrado',
    bodyHtml,
  })

  const text = `${branding.systemName} — Ticket registrado

Hola ${clientName},

Su ticket #${ticketNumber} fue registrado.
Título: ${ticketTitle}
Categoría: ${category}
Prioridad: ${priorityLabel}
${description ? `Resumen: ${description}\n` : ''}
Ver ticket: ${ticketUrl}

${buildLegalFooterText(branding)}`

  return { html, text }
}
