/**
 * Template de Email: Restablecimiento de contraseña
 */

import type { EmailBranding } from '../email-branding'
import { buildBrandedEmailHtml, buildPrimaryButton, escapeHtml } from '../email-layout'
import { DEFAULT_SYSTEM_NAME } from '@/lib/branding-constants'

interface PasswordResetData {
  userName: string
  resetUrl: string
  expiryTime: string
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

export default function passwordResetTemplate(data: PasswordResetData) {
  const systemName = data.systemName || DEFAULT_SYSTEM_NAME
  const primaryColor = data.primaryColor || '#EAB308'
  const privacyUrl = data.privacyUrl || '/help/privacy'
  const safeName = escapeHtml(data.userName)

  const branding: EmailBranding = {
    systemName,
    heroTitle: data.heroTitle || '',
    companyName: data.companyName || systemName,
    logoUrl: data.logoUrl ?? null,
    primaryColor,
    baseUrl: data.baseUrl || '',
    privacyUrl: data.privacyUrl || '/help/privacy',
    termsUrl: data.termsUrl || '/help/terms',
    loginUrl: data.loginUrl || '/login',
  }

  const bodyHtml = `
    <p style="margin:0 0 16px;">Hola <strong>${safeName}</strong>,</p>
    <p style="margin:0 0 8px;">
      Recibimos una solicitud para restablecer la contraseña de su cuenta en
      <strong>${escapeHtml(systemName)}</strong>.
    </p>
    <p style="margin:0 0 8px;">
      El enlace es válido durante <strong>${escapeHtml(data.expiryTime)}</strong>.
    </p>
    ${buildPrimaryButton(data.resetUrl, 'Restablecer contraseña', primaryColor)}
    <p style="margin:16px 0 0;color:#71717a;font-size:13px;line-height:1.5;">
      Si no realizó esta solicitud, ignore este mensaje. Su contraseña no cambiará.
    </p>
  `

  const html = buildBrandedEmailHtml({
    branding,
    preheader: `Enlace para restablecer su contraseña en ${systemName} (válido ${data.expiryTime}).`,
    headline: 'Restablecer contraseña',
    bodyHtml,
  })

  const text = `${systemName} — Restablecer contraseña

Hola ${data.userName},

Solicitud para restablecer la contraseña de su cuenta. Enlace válido ${data.expiryTime}:

${data.resetUrl}

Si no realizó esta solicitud, ignore este mensaje.

Mensaje automático. Tratamiento de datos conforme a la LOPDP Ecuador: ${privacyUrl}
`

  return { html, text }
}
