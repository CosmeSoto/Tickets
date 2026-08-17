import { createHash, createHmac } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { generateAccessQrSecret } from '@/lib/access/access-control'
import { DigitalSignatureService } from '@/lib/services/digital-signature.service'
import { AuditActionsComplete, AuditServiceComplete } from '@/lib/services/audit-service-complete'
import { queueNotificationEmail } from '@/lib/notifications/queue-notification-email'
import { getEmailBranding } from '@/lib/services/email/email-branding'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  accessPassEmailSubject,
  accessTypeLabel,
  buildAccessPassIssuedEmail,
} from '@/lib/services/email/templates/access-pass-issued'
import { formatAccessDateTime } from '@/lib/access/access-dates'

const acceptanceSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'El enlace de aceptación no es válido.'),
  accepted: z.literal(true),
})

const publicPassInclude = {
  subject: {
    select: {
      firstName: true,
      lastName: true,
      email: true,
      organization: true,
      accessType: true,
      privacyNoticeVersion: true,
    },
  },
  family: { select: { name: true } },
} as const

async function findPendingPass(id: string, token: string) {
  const tokenHash = createHash('sha256').update(token).digest('hex')
  return (prisma as any).access_passes.findFirst({
    where: { id, privacyAcceptanceTokenHash: tokenHash },
    include: publicPassInclude,
  })
}

async function assertPublicRateLimit(request: NextRequest, action: 'view' | 'accept') {
  const ip = DigitalSignatureService.extractIpAddress(request.headers)
  const result = await checkRateLimit(
    `access-consent:${action}:${ip}`,
    action === 'accept' ? 8 : 30,
    15 * 60_000
  )
  if (result.success) return null
  return NextResponse.json(
    { error: 'Demasiadas solicitudes. Inténtalo nuevamente más tarde.' },
    { status: 429, headers: { 'Retry-After': String(result.retryAfter ?? 60) } }
  )
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rateLimited = await assertPublicRateLimit(request, 'view')
  if (rateLimited) return rateLimited
  const token = new URL(request.url).searchParams.get('token')
  if (!token || !DigitalSignatureService.isValidAcceptanceToken(token)) {
    return NextResponse.json({ error: 'Enlace de aceptación inválido.' }, { status: 404 })
  }
  const pass = await findPendingPass((await params).id, token)
  if (!pass) return NextResponse.json({ error: 'Enlace de aceptación inválido.' }, { status: 404 })
  if (
    pass.status !== 'PENDING_PRIVACY' &&
    (!pass.privacyAcceptanceExpiresAt || pass.privacyAcceptanceExpiresAt <= new Date())
  ) {
    return NextResponse.json({ error: 'Enlace de aceptación inválido.' }, { status: 404 })
  }

  const expired =
    pass.status === 'PENDING_PRIVACY' &&
    (!pass.privacyAcceptanceExpiresAt || pass.privacyAcceptanceExpiresAt <= new Date())
  return NextResponse.json(
    {
      pass: {
        id: pass.id,
        status: pass.status,
        credentialCode: pass.credentialCode,
        validFrom: pass.validFrom,
        validUntil: pass.validUntil,
        acceptedAt: pass.privacyAcceptedAt,
        expiresAt: pass.privacyAcceptanceExpiresAt,
        subject: {
          firstName: pass.subject.firstName,
          lastName: pass.subject.lastName,
          organization: pass.subject.organization,
          accessType: pass.subject.accessType,
          privacyNoticeVersion: pass.subject.privacyNoticeVersion,
        },
        family: pass.family,
      },
      canAccept: pass.status === 'PENDING_PRIVACY' && !expired,
      expired,
    },
    { headers: { 'Cache-Control': 'no-store, private' } }
  )
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rateLimited = await assertPublicRateLimit(request, 'accept')
  if (rateLimited) return rateLimited
  const parsed = acceptanceSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos de aceptación inválidos.' }, { status: 400 })
  }
  const id = (await params).id
  const pass = await findPendingPass(id, parsed.data.token)
  if (!pass) return NextResponse.json({ error: 'Enlace de aceptación inválido.' }, { status: 404 })
  if (pass.status === 'ACTIVE' && pass.privacyAcceptedAt) {
    return NextResponse.json({
      message: 'La aceptación ya estaba registrada. Tu QR fue enviado al correo indicado.',
    })
  }
  if (pass.status !== 'PENDING_PRIVACY') {
    return NextResponse.json(
      { error: 'Esta credencial ya fue procesada o dejó de estar disponible.' },
      { status: 409 }
    )
  }
  if (!pass.privacyAcceptanceExpiresAt || pass.privacyAcceptanceExpiresAt <= new Date()) {
    return NextResponse.json({ error: 'Este enlace de aceptación expiró.' }, { status: 410 })
  }

  const ipAddress = DigitalSignatureService.extractIpAddress(request.headers)
  const userAgent = DigitalSignatureService.extractUserAgent(request.headers).slice(0, 1000)
  const acceptedAt = new Date()
  const qrSecret = generateAccessQrSecret()
  const evidenceHash = createHmac(
    'sha256',
    process.env.NEXTAUTH_SECRET || 'access-consent-evidence'
  )
    .update(
      [
        pass.id,
        pass.subject.email ?? '',
        pass.subject.privacyNoticeVersion ?? '',
        acceptedAt.toISOString(),
        ipAddress,
        userAgent,
      ].join('|')
    )
    .digest('hex')

  const activatedPass = await (prisma as any).$transaction(async (tx: any) => {
    const update = await tx.access_passes.updateMany({
      where: {
        id,
        status: 'PENDING_PRIVACY',
        privacyAcceptanceTokenHash: createHash('sha256').update(parsed.data.token).digest('hex'),
      },
      data: {
        status: 'ACTIVE',
        tokenHash: qrSecret.tokenHash,
        privacyAcceptedAt: acceptedAt,
        privacyAcceptedIp: ipAddress,
        privacyAcceptedUserAgent: userAgent,
        privacyAcceptanceHash: evidenceHash,
        // Conservamos el hash durante 24 h para que los reintentos HTTP sean idempotentes.
        privacyAcceptanceExpiresAt: new Date(acceptedAt.getTime() + 24 * 60 * 60 * 1000),
      },
    })
    if (update.count !== 1) throw new Error('La credencial ya fue procesada.')
    return tx.access_passes.findUniqueOrThrow({ where: { id }, include: publicPassInclude })
  })

  const qrPayload = `ACCESS:${qrSecret.token}`
  const qrCode = await QRCode.toDataURL(qrPayload, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 420,
  })
  const branding = await getEmailBranding()
  let emailQueued = false
  if (activatedPass.subject.email) {
    const { html, text } = await buildAccessPassIssuedEmail({
      recipientName: `${activatedPass.subject.firstName} ${activatedPass.subject.lastName}`,
      familyName: activatedPass.family.name,
      credentialCode: activatedPass.credentialCode,
      validFromLabel: formatAccessDateTime(activatedPass.validFrom),
      validUntilLabel: formatAccessDateTime(activatedPass.validUntil),
      organizationName: activatedPass.subject.organization,
      accessTypeLabel: accessTypeLabel(activatedPass.subject.accessType),
      qrDataUrl: qrCode,
      privacyUrl: branding.privacyUrl,
    })
    try {
      await queueNotificationEmail({
        to: activatedPass.subject.email,
        module: 'access',
        event: 'accessPassIssued',
        priority: 'important',
        subject: accessPassEmailSubject(activatedPass.family.name),
        html,
        text,
      })
      emailQueued = true
      await (prisma as any).access_passes.update({
        where: { id },
        data: { emailedAt: acceptedAt },
      })
    } catch (error) {
      console.error('[access] no se pudo encolar el QR tras consentimiento:', error)
    }
  }

  await AuditServiceComplete.log({
    action: AuditActionsComplete.ACCESS_PASS_UPDATED,
    entityType: 'access_pass',
    entityId: id,
    userId: activatedPass.createdById,
    newValues: { status: 'ACTIVE', privacyAcceptedAt: acceptedAt },
    details: {
      source: 'public_privacy_acceptance',
      privacyNoticeVersion: activatedPass.subject.privacyNoticeVersion,
    },
    request,
  })
  return NextResponse.json({
    message: emailQueued
      ? 'Aceptación registrada. Tu QR fue enviado al correo indicado.'
      : 'Aceptación registrada. El área emisora fue informada para reenviar tu credencial.',
  })
}
