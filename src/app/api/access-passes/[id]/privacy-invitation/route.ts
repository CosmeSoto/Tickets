import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  assertCanManageAccess,
  generateAccessQrSecret,
  getAccessModulePermission,
  isAccessFamilyAllowed,
} from '@/lib/access/access-control'
import { getEmailBranding } from '@/lib/services/email/email-branding'
import { queueNotificationEmail } from '@/lib/notifications/queue-notification-email'
import {
  accessPrivacyInvitationAltText,
  accessTypeLabel,
  buildAccessPrivacyInvitationEmail,
} from '@/lib/services/email/templates/access-pass-issued'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const denied = await assertCanManageAccess(session.user.id, session.user.role)
  if (denied) return denied

  const id = (await params).id
  const pass = await (prisma as any).access_passes.findUnique({
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
  const permission = await getAccessModulePermission(session.user.id, session.user.role)
  if (!isAccessFamilyAllowed(permission, pass.familyId)) {
    return NextResponse.json({ error: 'No tienes acceso a este pase.' }, { status: 403 })
  }
  if (pass.status !== 'PENDING_PRIVACY') {
    return NextResponse.json(
      { error: 'El pase ya no está pendiente de aceptación.' },
      { status: 409 }
    )
  }
  if (!pass.subject.email) {
    return NextResponse.json(
      { error: 'El pase no tiene un correo para enviar la invitación.' },
      { status: 400 }
    )
  }

  const secret = generateAccessQrSecret()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await (prisma as any).access_passes.update({
    where: { id },
    data: {
      privacyAcceptanceTokenHash: secret.tokenHash,
      privacyAcceptanceExpiresAt: expiresAt,
      updatedById: session.user.id,
    },
  })
  const branding = await getEmailBranding()
  const acceptanceUrl = `${branding.baseUrl}/access/passes/${id}/accept?token=${encodeURIComponent(secret.token)}`
  const recipientName = `${pass.subject.firstName} ${pass.subject.lastName}`
  const { html } = await buildAccessPrivacyInvitationEmail({
    recipientName,
    familyName: pass.family.name,
    credentialCode: pass.credentialCode,
    validFromLabel: pass.validFrom.toLocaleString('es-CO'),
    validUntilLabel: pass.validUntil.toLocaleString('es-CO'),
    organizationName: pass.subject.organization,
    accessTypeLabel: accessTypeLabel(pass.subject.accessType),
    privacyUrl: branding.privacyUrl,
    acceptanceUrl,
  })
  await queueNotificationEmail({
    to: pass.subject.email,
    module: 'access',
    event: 'accessPassIssued',
    priority: 'important',
    subject: 'Recordatorio: confirma tu aviso de privacidad',
    html,
    text: accessPrivacyInvitationAltText({
      recipientName,
      familyName: pass.family.name,
      acceptanceUrl,
    }),
  })
  return NextResponse.json({
    message: 'Invitación reenviada; el enlace anterior dejó de ser válido.',
  })
}
