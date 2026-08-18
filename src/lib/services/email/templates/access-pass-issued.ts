import { buildOperationalEmail } from '@/lib/services/email/operational-email'
import { escapeHtml } from '@/lib/services/email/email-layout'

export { accessTypeLabel } from '@/lib/access/access-labels'

export type AccessPassIssuedEmailData = {
  recipientName: string
  familyName: string
  credentialCode: string
  validFromLabel: string
  validUntilLabel: string
  organizationName?: string | null
  accessTypeLabel: string
  qrDataUrl: string
  privacyUrl: string
}

export async function buildAccessPassIssuedEmail(data: AccessPassIssuedEmailData) {
  const orgRow = data.organizationName
    ? [{ label: 'Arrendatario', value: data.organizationName }]
    : []

  return buildOperationalEmail({
    headline: 'Credencial digital de acceso',
    preheader: `Tu pase QR para ${data.familyName} está listo.`,
    greetingName: data.recipientName,
    introHtml: `<p style="margin:0 0 8px;">Se emitió tu credencial digital de acceso. Preséntala al personal autorizado; no la compartas ni la reenvíes.</p>
<p style="margin:16px 0 8px;text-align:center;">
  <img src="${data.qrDataUrl}" width="220" height="220" alt="Código QR de acceso" style="display:inline-block;border:1px solid #e4e4e7;border-radius:8px;" />
</p>
<p style="margin:0 0 8px;color:#71717a;font-size:13px;text-align:center;">Escanea este código en el punto de control. El código no contiene tu nombre ni documento.</p>`,
    infoRows: [
      { label: 'Área', value: data.familyName },
      { label: 'Tipo de acceso', value: data.accessTypeLabel },
      ...orgRow,
      { label: 'Código de credencial', value: data.credentialCode },
      { label: 'Vigente desde', value: data.validFromLabel },
      { label: 'Vigente hasta', value: data.validUntilLabel },
    ],
    cta: { href: data.privacyUrl, label: 'Ver aviso de privacidad' },
    footnote:
      'Tus datos personales se tratan conforme a la LOPDP Ecuador. Si no solicitaste este acceso, ignora este mensaje y avisa al área emisora.',
  })
}

export function accessPassEmailSubject(familyName: string): string {
  return `Credencial digital de acceso · ${familyName}`
}

export async function buildAccessPrivacyInvitationEmail(
  data: Omit<AccessPassIssuedEmailData, 'qrDataUrl'> & {
    acceptanceUrl: string
  }
) {
  return buildOperationalEmail({
    headline: 'Confirma tu aviso de privacidad',
    preheader: `Completa la aceptación para activar tu credencial de ${data.familyName}.`,
    greetingName: data.recipientName,
    introHtml:
      '<p style="margin:0;">Para activar tu credencial digital de acceso, revisa el aviso de privacidad y confirma tu aceptación. Tu QR se enviará únicamente después de completar este paso.</p>',
    infoRows: [
      { label: 'Área', value: data.familyName },
      { label: 'Tipo de acceso', value: data.accessTypeLabel },
      ...(data.organizationName ? [{ label: 'Arrendatario', value: data.organizationName }] : []),
      { label: 'Vigente desde', value: data.validFromLabel },
      { label: 'Vigente hasta', value: data.validUntilLabel },
    ],
    cta: { href: data.acceptanceUrl, label: 'Revisar y aceptar' },
    footnote:
      'Este enlace es personal y temporal. Si no solicitaste este acceso, ignora este mensaje y avisa al área emisora.',
  })
}

export function accessPrivacyInvitationAltText(data: {
  recipientName: string
  familyName: string
  acceptanceUrl: string
}): string {
  return [
    `Hola ${data.recipientName},`,
    `Revisa y acepta el aviso de privacidad para activar tu credencial de ${data.familyName}.`,
    `Enlace personal: ${data.acceptanceUrl}`,
  ].join('\n')
}

/** Texto plano auxiliar si el HTML no se renderiza. */
export function accessPassEmailAltText(data: AccessPassIssuedEmailData): string {
  return [
    `Hola ${data.recipientName},`,
    `Tu pase QR para ${escapeHtml(data.familyName)} está vigente desde ${data.validFromLabel} hasta ${data.validUntilLabel}.`,
    `Código: ${data.credentialCode}`,
    `Privacidad: ${data.privacyUrl}`,
  ].join('\n')
}
