import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  assertCanScanAccess,
  getAccessModulePermission,
  hashAccessQrSecret,
  isAccessFamilyAllowed,
  normalizeAccessQrPayload,
  resolveAccessPassState,
} from '@/lib/access/access-control'
import { AuditActionsComplete, AuditServiceComplete } from '@/lib/services/audit-service-complete'

const scanSchema = z.object({ payload: z.string().trim().min(8).max(500) })

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const denied = await assertCanScanAccess(session.user.id, session.user.role)
  if (denied) return denied
  const parsed = scanSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Código QR inválido.' }, { status: 400 })
  const token = normalizeAccessQrPayload(parsed.data.payload)
  if (!token || token.length < 32)
    return NextResponse.json({ error: 'Código QR inválido.' }, { status: 400 })

  const permission = await getAccessModulePermission(session.user.id, session.user.role)
  const pass = await (prisma as any).access_passes.findUnique({
    where: { tokenHash: hashAccessQrSecret(token) },
    include: {
      subject: {
        select: {
          firstName: true,
          lastName: true,
          accessType: true,
          organization: true,
          photoPath: true,
          isActive: true,
        },
      },
      family: { select: { id: true, name: true, code: true } },
    },
  })
  const context = {
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
    userAgent: request.headers.get('user-agent') || null,
  }
  if (!pass) {
    await (prisma as any).access_scan_events.create({
      data: {
        agentId: session.user.id,
        result: 'NOT_FOUND',
        failureCode: 'TOKEN_NOT_FOUND',
        ...context,
      },
    })
    return NextResponse.json({
      result: 'NOT_FOUND',
      valid: false,
      message: 'Credencial no reconocida.',
    })
  }
  if (!isAccessFamilyAllowed(permission, pass.familyId)) {
    await (prisma as any).access_scan_events.create({
      data: {
        passId: pass.id,
        familyId: pass.familyId,
        agentId: session.user.id,
        result: 'OUT_OF_SCOPE',
        failureCode: 'FAMILY_SCOPE',
        ...context,
      },
    })
    return NextResponse.json(
      { result: 'OUT_OF_SCOPE', valid: false, message: 'No tienes autorización para esta área.' },
      { status: 403 }
    )
  }
  const result = resolveAccessPassState(pass)
  await (prisma as any).$transaction([
    (prisma as any).access_scan_events.create({
      data: {
        passId: pass.id,
        familyId: pass.familyId,
        agentId: session.user.id,
        result,
        ...context,
      },
    }),
    (prisma as any).access_passes.update({
      where: { id: pass.id },
      data: { lastScannedAt: new Date() },
    }),
  ])
  await AuditServiceComplete.log({
    action: AuditActionsComplete.ACCESS_PASS_SCANNED,
    entityType: 'access_scan',
    entityId: pass.id,
    userId: session.user.id,
    details: { result, familyId: pass.familyId, credentialCode: pass.credentialCode },
    request,
  })
  const { photoPath: _photoPath, ...subject } = pass.subject
  return NextResponse.json({
    result,
    valid: result === 'VALID',
    pass: {
      id: pass.id,
      credentialCode: pass.credentialCode,
      validFrom: pass.validFrom,
      validUntil: pass.validUntil,
      subject,
      family: pass.family,
      photoUrl: pass.subject.photoPath ? `/api/access-passes/${pass.id}/photo` : null,
    },
  })
}
