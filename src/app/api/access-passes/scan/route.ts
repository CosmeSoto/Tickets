import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  ACCESS_SCAN_MESSAGES,
  findAccessPassByScanPayload,
  isAccessFamilyAllowed,
  requireAccessPermission,
  resolveAccessPassState,
} from '@/lib/access/access-control'
import { AuditActionsComplete, AuditServiceComplete } from '@/lib/services/audit-service-complete'

const scanSchema = z.object({ payload: z.string().trim().min(6).max(500) })

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json(
      { error: 'No autenticado', result: 'FORBIDDEN', valid: false, message: 'No autenticado' },
      { status: 401 }
    )
  }
  const { denied, permission } = await requireAccessPermission(session.user.id, 'scan')
  if (denied) {
    return NextResponse.json(
      {
        error: 'No tienes acceso al módulo de Accesos.',
        result: 'FORBIDDEN',
        valid: false,
        message: ACCESS_SCAN_MESSAGES.FORBIDDEN,
      },
      { status: 403 }
    )
  }
  const parsed = scanSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Código inválido.',
        result: 'NOT_FOUND',
        valid: false,
        message: ACCESS_SCAN_MESSAGES.NOT_FOUND,
      },
      { status: 400 }
    )
  }

  const pass = await findAccessPassByScanPayload(parsed.data.payload)
  const context = {
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
    userAgent: request.headers.get('user-agent') || null,
  }
  if (!pass) {
    await prisma.access_scan_events.create({
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
      message: ACCESS_SCAN_MESSAGES.NOT_FOUND,
    })
  }
  if (!isAccessFamilyAllowed(permission, pass.familyId)) {
    await prisma.access_scan_events.create({
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
      {
        result: 'OUT_OF_SCOPE',
        valid: false,
        message: ACCESS_SCAN_MESSAGES.OUT_OF_SCOPE,
      },
      { status: 403 }
    )
  }
  const result = resolveAccessPassState(pass)
  await prisma.$transaction([
    prisma.access_scan_events.create({
      data: {
        passId: pass.id,
        familyId: pass.familyId,
        agentId: session.user.id,
        result,
        ...context,
      },
    }),
    // updateMany en vez de update: si el pase se borró justo entre el
    // findAccessPassByScanPayload de arriba y este punto, el bookkeeping de
    // lastScannedAt no debe tumbar la request con un P2025 — el scan_event
    // (lo que realmente importa auditar) ya quedó registrado en esta misma
    // transacción.
    prisma.access_passes.updateMany({
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
  const { ...subject } = pass.subject
  return NextResponse.json({
    result,
    valid: result === 'VALID',
    message:
      ACCESS_SCAN_MESSAGES[result] ||
      (result === 'VALID' ? 'Acceso autorizado' : 'Acceso no autorizado'),
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
