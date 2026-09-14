import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  isAccessFamilyAllowed,
  generateAccessQrSecret,
  requireAccessPermission,
} from '@/lib/access/access-control'
import { hardDeleteAccessPasses } from '@/lib/access/delete-access-passes'
import { accessTypeRequiresOrganization } from '@/lib/access/access-labels'
import {
  ACCESS_PRIVACY_ACCEPTANCE_TTL_MS,
  sendAccessPrivacyInvitation,
} from '@/lib/access/access-invitation'
import { ACCESS_PRIVACY_NOTICE_VERSION } from '@/lib/access/access-privacy-notice'
import { ACCESS_SUBJECT_TYPES } from '@/lib/access/access-pass-state'
import { isPrismaUniqueViolation } from '@/lib/access/access-errors'
import { AuditActionsComplete, AuditServiceComplete } from '@/lib/services/audit-service-complete'

const createSchema = z
  .object({
    familyId: z.string().uuid(),
    firstName: z.string().trim().min(2).max(120),
    lastName: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(320).optional().nullable(),
    phone: z.string().trim().max(40).optional().nullable(),
    organizationId: z.string().uuid().optional().nullable(),
    accessType: z.enum(ACCESS_SUBJECT_TYPES),
    purpose: z.string().trim().max(1000).optional().nullable(),
    documentLast4: z
      .string()
      .trim()
      .regex(/^\d{4}$/)
      .optional()
      .nullable(),
    // La versión del aviso de privacidad la fija el servidor
    // (ACCESS_PRIVACY_NOTICE_VERSION) — nunca un dato de entrada del cliente,
    // ya que queda como evidencia legal de consentimiento.
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
  // Empleado de arrendatario y contratista se definen por su relación con una empresa;
  // el visitante autorizado puede no pertenecer a ninguna (visita personal, entrega, etc.).
  .refine(data => !accessTypeRequiresOrganization(data.accessType) || !!data.organizationId, {
    message: 'Selecciona el arrendatario/empresa para este tipo de acceso.',
    path: ['organizationId'],
  })

/** Campos para listado de gestores: persona, pertenencia, tipo y motivo del acceso. */
const PASS_LIST_INCLUDE = {
  subject: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      organization: true,
      organizationId: true,
      accessType: true,
      purpose: true,
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
  const { denied, permission } = await requireAccessPermission(session.user.id, 'manage')
  if (denied) return denied

  const { searchParams } = new URL(request.url)
  const familyId = searchParams.get('familyId')
  const state = searchParams.get('state')
  const search = searchParams.get('search')?.trim()
  if (familyId && !isAccessFamilyAllowed(permission, familyId)) {
    return NextResponse.json({ error: 'No tienes acceso a esa área.' }, { status: 403 })
  }

  const where: Record<string, unknown> = {}
  if (familyId) where.familyId = familyId
  else if (permission.familyIds !== undefined) where.familyId = { in: permission.familyIds }
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
      { subject: { purpose: { contains: search, mode: 'insensitive' } } },
    ]
  }

  const passes = await prisma.access_passes.findMany({
    where,
    include: PASS_LIST_INCLUDE,
    orderBy: [{ validUntil: 'asc' }, { createdAt: 'desc' }],
    take: 500,
  })
  return NextResponse.json({ passes, canDelete: permission.canDelete === true })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { denied, permission } = await requireAccessPermission(session.user.id, 'manage')
  if (denied) return denied
  const parsed = createSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos de acceso inválidos.', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const data = parsed.data
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
    const org = await prisma.access_organizations.findFirst({
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
  const acceptanceExpiresAt = new Date(Date.now() + ACCESS_PRIVACY_ACCEPTANCE_TTL_MS)

  // credentialCode() toma 8 hex de un UUID sobre una columna @unique: la
  // colisión es muy improbable pero posible. Reintentar la transacción
  // completa (subject + pass se crean juntos) en vez de dejar que el P2002
  // se propague como 500 — el subject huérfano de un intento fallido nunca
  // llega a persistirse porque toda la transacción revierte.
  let pass!: Awaited<ReturnType<typeof prisma.access_passes.create>>
  const MAX_ATTEMPTS = 4
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      pass = await prisma.$transaction(async (tx: any) => {
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
            privacyNoticeVersion: ACCESS_PRIVACY_NOTICE_VERSION,
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
      break
    } catch (error) {
      const isCollision =
        isPrismaUniqueViolation(error, 'credential_code') ||
        isPrismaUniqueViolation(error, 'token_hash') ||
        isPrismaUniqueViolation(error, 'privacy_acceptance_token_hash')
      if (!isCollision || attempt === MAX_ATTEMPTS) throw error
    }
  }

  if (data.email) {
    await sendAccessPrivacyInvitation({
      to: data.email,
      recipientName: `${data.firstName} ${data.lastName}`,
      familyName: family.name,
      credentialCode: pass.credentialCode,
      validFrom: data.validFrom,
      validUntil: data.validUntil,
      organizationName,
      accessType: data.accessType,
      passId: pass.id,
      token: acceptanceToken.token,
    })
    await prisma.access_passes.update({
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
      privacyNoticeVersion: ACCESS_PRIVACY_NOTICE_VERSION,
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

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
})

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { denied, permission } = await requireAccessPermission(session.user.id, 'delete')
  if (denied) return denied

  const parsed = bulkDeleteSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Selecciona uno o más pases válidos para eliminar.' },
      { status: 400 }
    )
  }

  // Defensa en profundidad: canDelete hoy es exclusivo de Super Admin (scope
  // global), pero si el permiso se delega a un gestor de área en el futuro,
  // el borrado masivo nunca debe alcanzar pases fuera de su scope.
  const { deleted, subjectsRemoved } = await hardDeleteAccessPasses(
    parsed.data.ids,
    permission.familyIds
  )
  if (deleted.length === 0) {
    return NextResponse.json({ error: 'No se encontraron pases para eliminar.' }, { status: 404 })
  }

  await Promise.all(
    deleted.map(pass =>
      AuditServiceComplete.log({
        action: AuditActionsComplete.ACCESS_PASS_DELETED,
        entityType: 'access_pass',
        entityId: pass.id,
        userId: session.user.id,
        details: {
          source: 'access_module',
          credentialCode: pass.credentialCode,
          familyId: pass.familyId,
          status: pass.status,
          subjectsRemoved,
          deletedCount: deleted.length,
        },
        request,
      })
    )
  )

  return NextResponse.json({
    success: true,
    deleted: deleted.length,
    subjectsRemoved,
    message:
      deleted.length === 1
        ? 'Pase eliminado de forma permanente.'
        : `${deleted.length} pases eliminados de forma permanente.`,
  })
}
