import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  assertCanDeleteAccess,
  assertCanManageAccess,
  getAccessModulePermission,
  isAccessFamilyAllowed,
  generateAccessQrSecret,
} from '@/lib/access/access-control'
import { assertAccessStatusTransition } from '@/lib/access/access-pass-state'
import { hardDeleteAccessPasses } from '@/lib/access/delete-access-passes'
import { AuditActionsComplete, AuditServiceComplete } from '@/lib/services/audit-service-complete'

const updateSchema = z
  .object({
    status: z.enum(['ACTIVE', 'SUSPENDED', 'REVOKED']).optional(),
    validFrom: z.coerce.date().optional(),
    validUntil: z.coerce.date().optional(),
    revokedReason: z.string().trim().min(3).max(1000).optional(),
    reissueQr: z.boolean().optional(),
  })
  .refine(data => !(data.status === 'REVOKED' && !data.revokedReason), {
    message: 'Indica el motivo de revocación.',
    path: ['revokedReason'],
  })

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const denied = await assertCanManageAccess(session.user.id, session.user.role)
  if (denied) return denied
  const parsed = updateSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Cambio inválido.', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const id = (await params).id
  const existing = await prisma.access_passes.findUnique({
    where: { id },
    include: { subject: { select: { firstName: true, lastName: true } } },
  })
  if (!existing) return NextResponse.json({ error: 'Pase no encontrado.' }, { status: 404 })
  const permission = await getAccessModulePermission(session.user.id, session.user.role)
  if (!isAccessFamilyAllowed(permission, existing.familyId)) {
    return NextResponse.json({ error: 'No tienes acceso a este pase.' }, { status: 403 })
  }
  const data = parsed.data
  const validFrom = data.validFrom ?? existing.validFrom
  const validUntil = data.validUntil ?? existing.validUntil
  if (validUntil <= validFrom) {
    return NextResponse.json(
      { error: 'La vigencia final debe ser posterior al inicio.' },
      { status: 400 }
    )
  }

  const reissued = data.reissueQr ? generateAccessQrSecret() : null
  const restoringRevoked = Boolean(reissued && existing.status === 'REVOKED')
  const nextStatus = data.status ?? (restoringRevoked ? 'ACTIVE' : existing.status)

  // Única fuente de verdad para qué cambios de status se permiten: cierra el
  // bypass de consentimiento (nunca se activa "a mano" un pase que la persona
  // no aceptó) sin bloquear transiciones legítimas ya usadas por la consola
  // (p. ej. revocar un pase que sigue PENDING_PRIVACY).
  const transition = assertAccessStatusTransition(existing.status, nextStatus, {
    reissueQr: Boolean(data.reissueQr),
    hasPrivacyAcceptance: Boolean(existing.privacyAcceptedAt),
  })
  if (!transition.ok) {
    return NextResponse.json({ error: transition.message, code: transition.code }, { status: 409 })
  }

  const isRevocation = nextStatus === 'REVOKED' && existing.status !== 'REVOKED'

  // Claim atómico: dos PATCH casi simultáneos sobre el mismo pase (revocar +
  // reemitir, doble click, dos gestores) no deben poder pisarse — solo uno de
  // los dos debe poder ganar la escritura. `status: existing.status` en el
  // where actúa como token optimista: si el status cambió entre el findUnique
  // de arriba y este updateMany, count será 0 y abortamos sin aplicar nada.
  const claimed = await prisma.access_passes.updateMany({
    where: { id, status: existing.status },
    data: {
      status: nextStatus,
      validFrom,
      validUntil,
      ...(reissued ? { tokenHash: reissued.tokenHash } : {}),
      updatedById: session.user.id,
      ...(isRevocation
        ? { revokedAt: new Date(), revokedById: session.user.id, revokedReason: data.revokedReason }
        : {}),
      ...(restoringRevoked || (nextStatus === 'ACTIVE' && existing.status === 'REVOKED')
        ? { revokedAt: null, revokedById: null, revokedReason: null }
        : {}),
    },
  })
  if (claimed.count !== 1) {
    return NextResponse.json(
      { error: 'El pase cambió mientras editabas. Recarga la página e intenta de nuevo.' },
      { status: 409 }
    )
  }
  const pass = await prisma.access_passes.findUniqueOrThrow({
    where: { id },
    include: {
      subject: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          organization: true,
          accessType: true,
          isActive: true,
        },
      },
      family: { select: { id: true, name: true, code: true } },
    },
  })
  await AuditServiceComplete.log({
    action: isRevocation
      ? AuditActionsComplete.ACCESS_PASS_REVOKED
      : reissued
        ? AuditActionsComplete.ACCESS_PASS_QR_REISSUED
        : AuditActionsComplete.ACCESS_PASS_UPDATED,
    entityType: 'access_pass',
    entityId: id,
    userId: session.user.id,
    oldValues: {
      status: existing.status,
      validFrom: existing.validFrom,
      validUntil: existing.validUntil,
    },
    newValues: { status: pass.status, validFrom: pass.validFrom, validUntil: pass.validUntil },
    details: {
      source: 'access_module',
      qrReissued: Boolean(reissued),
      restoredFromRevoked: restoringRevoked,
      revocationReason: data.revokedReason,
    },
    request,
  })
  return NextResponse.json({
    pass,
    qrPayload: reissued ? `ACCESS:${reissued.token}` : undefined,
  })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const denied = await assertCanDeleteAccess(session.user.id, session.user.role)
  if (denied) return denied

  const id = (await params).id
  const { deleted, subjectsRemoved } = await hardDeleteAccessPasses([id])
  if (deleted.length === 0) {
    return NextResponse.json({ error: 'Pase no encontrado.' }, { status: 404 })
  }
  const pass = deleted[0]
  await AuditServiceComplete.log({
    action: AuditActionsComplete.ACCESS_PASS_DELETED,
    entityType: 'access_pass',
    entityId: pass.id,
    userId: session.user.id,
    details: {
      source: 'access_module',
      credentialCode: pass.credentialCode,
      familyId: pass.familyId,
      status: pass.status,
      subjectRemoved: subjectsRemoved > 0,
    },
    request,
  })
  return NextResponse.json({
    success: true,
    deleted: 1,
    subjectsRemoved,
    message: 'Pase eliminado de forma permanente.',
  })
}
