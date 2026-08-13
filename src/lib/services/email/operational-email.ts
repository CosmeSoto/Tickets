import { getEmailBranding } from './email-branding'
import {
  buildBrandedEmailHtml,
  buildInfoTable,
  buildLegalFooterText,
  buildPrimaryButton,
  escapeHtml,
} from './email-layout'

export interface OperationalEmailOptions {
  headline: string
  preheader: string
  greetingName?: string
  introHtml: string
  infoRows?: Array<{ label: string; value: string }>
  cta?: { href: string; label: string }
  footnote?: string
}

export async function buildOperationalEmail(
  options: OperationalEmailOptions
): Promise<{ html: string; text: string }> {
  const branding = await getEmailBranding()

  const greeting = options.greetingName
    ? `<p style="margin:0 0 16px;">Hola <strong>${escapeHtml(options.greetingName)}</strong>,</p>`
    : ''

  const infoBlock = options.infoRows?.length ? buildInfoTable(options.infoRows) : ''
  const ctaBlock = options.cta
    ? buildPrimaryButton(options.cta.href, options.cta.label, branding.primaryColor)
    : ''
  const footnote = options.footnote
    ? `<p style="margin:16px 0 0;color:#71717a;font-size:13px;line-height:1.5;">${escapeHtml(options.footnote)}</p>`
    : ''

  const bodyHtml = `${greeting}${options.introHtml}${infoBlock}${ctaBlock}${footnote}`

  const html = buildBrandedEmailHtml({
    branding,
    preheader: options.preheader,
    headline: options.headline,
    bodyHtml,
  })

  const infoText = (options.infoRows || [])
    .map(r => `- ${r.label}: ${r.value}`)
    .join('\n')

  const text = [
    `${branding.systemName} — ${options.headline}`,
    '',
    options.greetingName ? `Hola ${options.greetingName},` : '',
    options.introHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    infoText,
    options.cta ? `${options.cta.label}: ${options.cta.href}` : '',
    options.footnote || '',
    '',
    buildLegalFooterText(branding),
  ]
    .filter(Boolean)
    .join('\n')

  return { html, text }
}
