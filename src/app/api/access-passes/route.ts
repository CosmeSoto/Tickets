import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  assertCanManageAccess,
  getAccessModulePermission,
  isAccessFamilyAllowed,
  generateAccessQrSecret,
} from '@/lib/access/access-control'
import { AuditActionsComplete, AuditServiceComplete } from '@/lib/services/audit-service-complete'
import { queueNotificationEmail } from '@/lib/notifications/queue-notification-email'
import { getEmailBranding } from '@/lib/services/email/email-branding'
import {
  accessPassEmailSubject,
  accessPrivacyInvitationAltText,
  accessTypeLabel,
  buildAccessPrivacyInvitationEmail,
} from '@/lib/services/email/templates/access-pass-issued'

const createSchema = z
  .object({
    familyId: z.string().uuid(),
    firstName: z.string().trim().min(2).max(120),
    lastName: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(320).optional().nullable(),
    phone: z.string().trim().max(40).optional().nullable(),
    organizationId: z.string().uuid().optional().nullable(),
    accessType: z.enum(['TENANT_EMPLOYEE', 'AUTHORIZED_VISITOR', 'CONTRACTOR']),
    purpose: z.string().trim().max(1000).optional().nullable(),
    documentLast4: z
      .string()
      .trim()
      .regex(/^\d{4}$/)
      .optional()
      .nullable(),
    privacyNoticeVersion: z.string().trim().min(1).max(50),
    validFrom: z.coerce.date(),
    validUntil: z.coerce.date(),
    sendEmail: z.literal(true),
  })
  .refine(data => data.validUntil > data.validFrom, {
    message: 'La vigencia final debe ser posterior al inicio.',
    path: ['validUntil'],
  })
  .refine(data => !!data.email, {
    message: 'Se requiere correo para solicitar la aceptación y activar la credencial.',
    path: ['email'],
  })

/** Campos mínimos para listado de gestores (sin teléfono, propósito ni rutas internas). */
const PASS_LIST_INCLUDE = {
  subject: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      organization: true,
      organizationId: true,
      accessType: true,
      isActive: true,
    },
  },
  family: { select: { id: true, name: true, code: true, color: true } },
  createdBy: { select: { id: true, name: true } },
}

/** Respuesta de emisión: solo lo necesario para confirmar el alta (sin photoPath absoluto). */
const PASS_CREATE_INCLUDE = {
  subject: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      organization: true,
      organizationId: true,
      accessType: true,
      isActive: true,
    },
  },
  family: { select: { id: true, name: true, code: true, color: true } },
  createdBy: { select: { id: true, name: true } },
}

function credentialCode(): string {
  return `ACC-${new Date().getUTCFullYear()}-${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const denied = await assertCanManageAccess(session.user.id, session.user.role)
  if (denied) return denied

  const permission = await getAccessModulePermission(session.user.id, session.user.role)
  const { searchParams } = new URL(request.url)
  const familyId = searchParams.get('familyId')
  const state = searchParams.get('state')
  const search = searchParams.get('search')?.trim()
  if (familyId && !isAccessFamilyAllowed(permission, familyId)) {
    return NextResponse.json({ error: 'No tienes acceso a esa área.' }, { status: 403 })
  }

  const where: Record<string, unknown> = {}
  if (familyId) where.familyId = familyId
  else if (permission.familyIds) where.familyId = { in: permission.familyIds }
  if (state && ['PENDING_PRIVACY', 'ACTIVE', 'SUSPENDED', 'REVOKED'].includes(state)) {
    where.status = state
  }
  if (search) {
    where.OR = [
      { credentialCode: { contains: search, mode: 'insensitive' } },
      { subject: { firstName: { contains: search, mode: 'insensitive' } } },
      { subject: { lastName: { contains: search, mode: 'insensitive' } } },
      { subject: { email: { contains: search, mode: 'insensitive' } } },
      { subject: { organization: { contains: search, mode: 'insensitive' } } },
    ]
  }

  const passes = await (prisma as any).access_passes.findMany({
    where,
    include: PASS_LIST_INCLUDE,
    orderBy: [{ validUntil: 'asc' }, { createdAt: 'desc' }],
    take: 500,
  })
  return NextResponse.json({ passes })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const denied = await assertCanManageAccess(session.user.id, session.user.role)
  if (denied) return denied
  const parsed = createSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos de acceso inválidos.', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const data = parsed.data
  const permission = await getAccessModulePermission(session.user.id, session.user.role)
  if (!isAccessFamilyAllowed(permission, data.familyId)) {
    return NextResponse.json({ error: 'No puedes emitir pases para esa área.' }, { status: 403 })
  }
  const family = await prisma.families.findFirst({
    where: { id: data.familyId, isActive: true },
    select: { id: true, name: true },
  })
  if (!family) {
    return NextResponse.json({ error: 'El área seleccionada no está activa.' }, { status: 400 })
  }

  let organizationName: string | null = null
  let organizationId = data.organizationId || null
  if (organizationId) {
    const org = await (prisma as any).access_organizations.findFirst({
      where: { id: organizationId, isActive: true },
      select: { id: true, name: true },
    })
    if (!org) {
      return NextResponse.json(
        { error: 'El arrendatario registrado no está activo.' },
        { status: 400 }
      )
    }
    organizationId = org.id
    organizationName = org.name
  }

  const { tokenHash } = generateAccessQrSecret()
  const acceptanceToken = generateAccessQrSecret()
  const acceptanceExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const pass = await (prisma as any).$transaction(async (tx: any) => {
    const subject = await tx.access_subjects.create({
      data: {
        familyId: data.familyId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email || null,
        phone: data.phone || null,
        organizationId,
        organization: organizationName,
        accessType: data.accessType,
        purpose: data.purpose || null,
        documentLast4: data.documentLast4 || null,
        privacyNoticeVersion: data.privacyNoticeVersion,
      },
    })
    return tx.access_passes.create({
      data: {
        subjectId: subject.id,
        familyId: data.familyId,
        credentialCode: credentialCode(),
        tokenHash,
        status: 'PENDING_PRIVACY',
        privacyAcceptanceTokenHash: acceptanceToken.tokenHash,
        privacyAcceptanceExpiresAt: acceptanceExpiresAt,
        validFrom: data.validFrom,
        validUntil: data.validUntil,
        createdById: session.user.id,
      },
      include: PASS_CREATE_INCLUDE,
    })
  })

  if (data.email) {
    const branding = await getEmailBranding()
    const acceptanceUrl = `${branding.baseUrl}/access/passes/${pass.id}/accept?token=${encodeURIComponent(acceptanceToken.token)}`
    const { html } = await buildAccessPrivacyInvitationEmail({
      recipientName: `${data.firstName} ${data.lastName}`,
      familyName: family.name,
      validFromLabel: data.validFrom.toLocaleString('es-CO'),
      validUntilLabel: data.validUntil.toLocaleString('es-CO'),
      organizationName,
      accessTypeLabel: accessTypeLabel(data.accessType),
      privacyUrl: branding.privacyUrl,
      credentialCode: pass.credentialCode,
      acceptanceUrl,
    })
    await queueNotificationEmail({
      to: data.email,
      module: 'access',
      event: 'accessPassIssued',
      priority: 'important',
      subject: `Acción requerida · ${accessPassEmailSubject(family.name)}`,
      html,
      text: accessPrivacyInvitationAltText({
        recipientName: `${data.firstName} ${data.lastName}`,
        familyName: family.name,
        acceptanceUrl,
      }),
    })
    await (prisma as any).access_passes.update({
      where: { id: pass.id },
      data: { emailedAt: new Date(), updatedById: session.user.id },
    })
  }
  await AuditServiceComplete.log({
    action: AuditActionsComplete.ACCESS_PASS_CREATED,
    entityType: 'access_pass',
    entityId: pass.id,
    userId: session.user.id,
    newValues: {
      familyId: data.familyId,
      credentialCode: pass.credentialCode,
      validUntil: data.validUntil,
      organizationId,
    },
    details: {
      source: 'access_module',
      privacyInvitationQueued: true,
      subjectType: data.accessType,
      privacyNoticeVersion: data.privacyNoticeVersion,
    },
    request,
  })
  return NextResponse.json(
    {
      pass,
      verifyHint:
        'La credencial se activará y enviará el QR cuando la persona acepte el aviso de privacidad.',
    },
    { status: 201 }
  )
}
