import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import QRCode from 'qrcode'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  generateAccessQrSecret,
  isAccessFamilyAllowed,
  requireAccessPermission,
} from '@/lib/access/access-control'
import { getEmailBranding } from '@/lib/services/email/email-branding'
import { queueNotificationEmail } from '@/lib/notifications/queue-notification-email'
import {
  accessPassEmailSubject,
  accessTypeLabel,
  buildAccessPassIssuedEmail,
} from '@/lib/services/email/templates/access-pass-issued'
import { formatAccessDateTime } from '@/lib/access/access-dates'

/** Reemite un QR nuevo por correo; el QR anterior queda inmediatamente inválido. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { denied, permission } = await requireAccessPermission(session.user.id, 'manage')
  if (denied) return denied

  const id = (await params).id
  const pass = await prisma.access_passes.findUnique({
    where: { id },
    include: {
      subject: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          organization: true,
          accessType: true,
        },
      },
      family: { select: { name: true } },
    },
  })
  if (!pass) return NextResponse.json({ error: 'Pase no encontrado.' }, { status: 404 })
  if (!isAccessFamilyAllowed(permission, pass.familyId)) {
    return NextResponse.json({ error: 'No tienes acceso a este pase.' }, { status: 403 })
  }
  // Segundo cerrojo (además de assertAccessStatusTransition en el PATCH de
  // gestión): nunca se envía un QR real sin consentimiento registrado.
  if (pass.status !== 'ACTIVE' || !pass.subject.email || !pass.privacyAcceptedAt) {
    return NextResponse.json(
      { error: 'Solo se puede reenviar una credencial activa con correo registrado.' },
      { status: 409 }
    )
  }

  const secret = generateAccessQrSecret()
  // Claim atómico antes de construir el correo: si el pase se revocó/suspendió
  // mientras se preparaba el envío (doble click, otro gestor revocando a la
  // vez), esto aborta sin invalidar el QR anterior ni mandar nada por correo.
  const claimed = await prisma.access_passes.updateMany({
    where: { id, status: 'ACTIVE', privacyAcceptedAt: { not: null } },
    data: { tokenHash: secret.tokenHash, emailedAt: new Date(), updatedById: session.user.id },
  })
  if (claimed.count !== 1) {
    return NextResponse.json(
      {
        error:
          'El pase dejó de estar activo mientras se preparaba el envío. Actualiza e inténtalo de nuevo.',
      },
      { status: 409 }
    )
  }

  const qrCode = await QRCode.toDataURL(`ACCESS:${secret.token}`, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 420,
  })
  const branding = await getEmailBranding()
  const { html, text } = await buildAccessPassIssuedEmail({
    recipientName: `${pass.subject.firstName} ${pass.subject.lastName}`,
    familyName: pass.family.name,
    credentialCode: pass.credentialCode,
    validFromLabel: formatAccessDateTime(pass.validFrom),
    validUntilLabel: formatAccessDateTime(pass.validUntil),
    organizationName: pass.subject.organization,
    accessTypeLabel: accessTypeLabel(pass.subject.accessType),
    qrDataUrl: qrCode,
    privacyUrl: branding.privacyUrl,
  })
  try {
    await queueNotificationEmail({
      to: pass.subject.email,
      module: 'access',
      event: 'accessPassIssued',
      priority: 'important',
      subject: accessPassEmailSubject(pass.family.name),
      html,
      text,
    })
  } catch (error) {
    console.error('[access] no se pudo encolar la reemisión de QR:', error)
    return NextResponse.json(
      {
        error:
          'El QR anterior fue invalidado, pero no se pudo encolar el correo. Intenta reenviarlo nuevamente.',
      },
      { status: 502 }
    )
  }
  return NextResponse.json({ message: 'Se encoló un QR nuevo; el QR anterior quedó inválido.' })
}
