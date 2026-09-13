/**
 * Invitación de aceptación pública del aviso de privacidad — construcción del
 * enlace y envío del correo. Antes vivía duplicado (~25 líneas cada uno) en
 * `access-passes/route.ts` (alta) y `[id]/privacy-invitation/route.ts`
 * (reenvío), con el mismo TTL de 7 días repetido como literal en ambos.
 */
import { getEmailBranding } from '@/lib/services/email/email-branding'
import { queueNotificationEmail } from '@/lib/notifications/queue-notification-email'
import {
  accessPassEmailSubject,
  accessPrivacyInvitationAltText,
  accessTypeLabel,
  buildAccessPrivacyInvitationEmail,
} from '@/lib/services/email/templates/access-pass-issued'
import { formatAccessDateTime } from '@/lib/access/access-dates'

/** TTL del enlace de aceptación pública del aviso de privacidad. */
export const ACCESS_PRIVACY_ACCEPTANCE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function buildAccessAcceptanceUrl(baseUrl: string, passId: string, token: string): string {
  return `${baseUrl}/access/passes/${passId}/accept?token=${encodeURIComponent(token)}`
}

export type AccessPrivacyInvitationInput = {
  to: string
  recipientName: string
  familyName: string
  credentialCode: string
  validFrom: Date
  validUntil: Date
  organizationName: string | null
  accessType: string
  passId: string
  token: string
  /** El alta inicial usa "Acción requerida"; el reenvío desde la consola usa un recordatorio. */
  subjectOverride?: string
}

export async function sendAccessPrivacyInvitation(
  input: AccessPrivacyInvitationInput
): Promise<void> {
  const branding = await getEmailBranding()
  const acceptanceUrl = buildAccessAcceptanceUrl(branding.baseUrl, input.passId, input.token)
  const { html } = await buildAccessPrivacyInvitationEmail({
    recipientName: input.recipientName,
    familyName: input.familyName,
    validFromLabel: formatAccessDateTime(input.validFrom),
    validUntilLabel: formatAccessDateTime(input.validUntil),
    organizationName: input.organizationName,
    accessTypeLabel: accessTypeLabel(input.accessType),
    privacyUrl: branding.privacyUrl,
    credentialCode: input.credentialCode,
    acceptanceUrl,
  })
  await queueNotificationEmail({
    to: input.to,
    module: 'access',
    event: 'accessPassIssued',
    priority: 'important',
    subject:
      input.subjectOverride ?? `Acción requerida · ${accessPassEmailSubject(input.familyName)}`,
    html,
    text: accessPrivacyInvitationAltText({
      recipientName: input.recipientName,
      familyName: input.familyName,
      acceptanceUrl,
    }),
  })
}
