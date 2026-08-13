/**
 * Template: Ticket asignado (técnico)
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

export default function ticketAssignedTemplate(data: Record<string, unknown>) {
  const branding = brandingFromTemplateData(data)
  const technicianName = String(data.technicianName || 'Técnico')
  const clientName = String(data.clientName || '—')
  const ticketNumber = ticketNumberFrom(data)
  const ticketTitle = ticketTitleFrom(data)
  const category = String(data.category || '—')
  const priority = String(data.priority || 'MEDIUM')
  const priorityLabel = PRIORITY_LABELS[priority] || priority
  const description = truncateForEmail(String(data.description || ''))
  const ticketUrl = resolveAbsoluteUrl(
    branding.baseUrl,
    String(data.ticketUrl || `/technician/tickets/${data.ticketId || ''}`)
  )

  const bodyHtml = `
    <p style="margin:0 0 16px;">Hola <strong>${escapeHtml(technicianName)}</strong>,</p>
    <p style="margin:0 0 8px;">Se le asignó un ticket en <strong>${escapeHtml(branding.systemName)}</strong>.</p>
    ${buildInfoTable([
      { label: 'Ticket', value: `#${ticketNumber}` },
      { label: 'Título', value: ticketTitle },
      { label: 'Cliente', value: clientName },
      { label: 'Categoría', value: category },
      { label: 'Prioridad', value: priorityLabel },
    ])}
    ${description ? `<p style="margin:0 0 8px;color:#71717a;font-size:13px;line-height:1.5;"><strong>Resumen:</strong> ${escapeHtml(description)}</p>` : ''}
    ${buildPrimaryButton(ticketUrl, 'Abrir ticket', branding.primaryColor)}
  `

  const html = buildBrandedEmailHtml({
    branding,
    preheader: `Ticket #${ticketNumber} asignado — ${ticketTitle}`,
    headline: 'Ticket asignado',
    bodyHtml,
  })

  const text = `${branding.systemName} — Ticket asignado

Hola ${technicianName},

Ticket #${ticketNumber} asignado.
Título: ${ticketTitle}
Cliente: ${clientName}
Prioridad: ${priorityLabel}
${description ? `Resumen: ${description}\n` : ''}
Abrir ticket: ${ticketUrl}

${buildLegalFooterText(branding)}`

  return { html, text }
}
