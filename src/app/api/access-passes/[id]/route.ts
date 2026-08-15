import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  assertCanManageAccess,
  getAccessModulePermission,
  isAccessFamilyAllowed,
  generateAccessQrSecret,
} from '@/lib/access/access-control'
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
  const existing = await (prisma as any).access_passes.findUnique({
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

  // Un pase REVOKED no puede volver a ACTIVE/SUSPENDED con el mismo tokenHash.
  if (
    existing.status === 'REVOKED' &&
    data.status &&
    data.status !== 'REVOKED' &&
    !data.reissueQr
  ) {
    return NextResponse.json(
      {
        error:
          'Un pase revocado no se puede reactivar con el mismo QR. Usa reemisión para generar un código nuevo.',
      },
      { status: 400 }
    )
  }

  const reissued = data.reissueQr ? generateAccessQrSecret() : null
  const restoringRevoked = Boolean(reissued && existing.status === 'REVOKED')
  const nextStatus = data.status ?? (restoringRevoked ? 'ACTIVE' : undefined)
  const isRevocation = nextStatus === 'REVOKED' && existing.status !== 'REVOKED'
  const pass = await (prisma as any).access_passes.update({
    where: { id },
    data: {
      ...(nextStatus ? { status: nextStatus } : {}),
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
