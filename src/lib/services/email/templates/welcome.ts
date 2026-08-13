/**
 * Template: Bienvenida tras registro
 */

import { brandingFromTemplateData } from '../email-template-utils'
import {
  buildBrandedEmailHtml,
  buildLegalFooterText,
  buildPrimaryButton,
  escapeHtml,
} from '../email-layout'

interface WelcomeEmailData {
  userName: string
  systemName?: string
  heroTitle?: string
  companyName?: string
  logoUrl?: string | null
  primaryColor?: string
  baseUrl?: string
  privacyUrl?: string
  termsUrl?: string
  loginUrl?: string
}

export default function welcomeEmailTemplate(data: WelcomeEmailData) {
  const branding = brandingFromTemplateData(data as Record<string, unknown>)
  const userName = String(data.userName || 'Usuario')

  const bodyHtml = `
    <p style="margin:0 0 16px;">Hola <strong>${escapeHtml(userName)}</strong>,</p>
    <p style="margin:0 0 12px;">
      Su cuenta en <strong>${escapeHtml(branding.systemName)}</strong> fue creada correctamente.
    </p>
    <p style="margin:0 0 12px;color:#52525b;font-size:14px;line-height:1.6;">
      Al usar el sistema usted acepta nuestros
      <a href="${escapeHtml(branding.termsUrl)}" style="color:${branding.primaryColor};text-decoration:underline;">Términos y Condiciones</a>
      y la
      <a href="${escapeHtml(branding.privacyUrl)}" style="color:${branding.primaryColor};text-decoration:underline;">Política de Privacidad</a>,
      conforme a la LOPDP Ecuador.
    </p>
    <p style="margin:0 0 8px;color:#71717a;font-size:13px;line-height:1.5;">
      Tratamos solo los datos necesarios para prestar el servicio de soporte y operaciones.
    </p>
    ${buildPrimaryButton(branding.loginUrl, 'Iniciar sesión', branding.primaryColor)}
  `

  const html = buildBrandedEmailHtml({
    branding,
    preheader: `Bienvenido/a a ${branding.systemName}.`,
    headline: 'Bienvenido/a',
    bodyHtml,
  })

  const text = `${branding.systemName} — Bienvenido/a

Hola ${userName},

Su cuenta fue creada correctamente.

Al usar el sistema acepta nuestros Términos (${branding.termsUrl}) y Política de Privacidad (${branding.privacyUrl}), conforme a la LOPDP Ecuador.

Iniciar sesión: ${branding.loginUrl}

${buildLegalFooterText(branding)}`

  return { html, text }
}
