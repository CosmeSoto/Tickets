export const ALLOWED_SMTP_HOSTS = [
  'smtp.gmail.com',
  'smtp-mail.outlook.com',
  'smtp.office365.com',
] as const

export const MICROSOFT_SMTP_HOSTS = ['smtp-mail.outlook.com', 'smtp.office365.com'] as const

export function isAllowedSmtpHost(host: string): boolean {
  return ALLOWED_SMTP_HOSTS.includes(host.trim() as (typeof ALLOWED_SMTP_HOSTS)[number])
}

export function isMicrosoftSmtpHost(host: string): boolean {
  return MICROSOFT_SMTP_HOSTS.includes(host.trim() as (typeof MICROSOFT_SMTP_HOSTS)[number])
}

/** Puerto 465 → SSL directo; 587 → STARTTLS (secure=false). */
export function resolveSmtpSecure(port: number, secure: boolean): boolean {
  if (port === 465) return true
  if (port === 587) return false
  return secure
}

/** Valida configuración mínima cuando el envío de email está activo. */
export function validateEnabledEmailSettings(input: {
  smtpHost?: string
  smtpUser?: string
  smtpPassword?: string
  hasStoredPassword?: boolean
}): string | null {
  const host = input.smtpHost?.trim() ?? ''
  const user = input.smtpUser?.trim() ?? ''

  if (!host) return 'Servidor SMTP requerido cuando el email está habilitado'
  if (!user) return 'Usuario SMTP requerido cuando el email está habilitado'
  if (!input.smtpPassword?.trim() && !input.hasStoredPassword) {
    return 'Contraseña SMTP requerida cuando el email está habilitado'
  }
  if (!isAllowedSmtpHost(host)) {
    return `Servidor SMTP no admitido. Usa: ${ALLOWED_SMTP_HOSTS.join(', ')}`
  }
  return null
}
