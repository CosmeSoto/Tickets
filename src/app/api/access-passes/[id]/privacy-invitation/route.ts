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
import {
  ACCESS_PRIVACY_ACCEPTANCE_TTL_MS,
  sendAccessPrivacyInvitation,
} from '@/lib/access/access-invitation'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const denied = await assertCanManageAccess(session.user.id, session.user.role)
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
  const expiresAt = new Date(Date.now() + ACCESS_PRIVACY_ACCEPTANCE_TTL_MS)
  // Claim atómico: si el pase dejó de estar PENDING_PRIVACY entre la lectura
  // y este punto (p. ej. la persona ya aceptó, o un admin lo revocó), abortar
  // sin rotar el token — evita dejar un token de aceptación huérfano o
  // invalidar una aceptación en curso.
  const claimed = await prisma.access_passes.updateMany({
    where: { id, status: 'PENDING_PRIVACY' },
    data: {
      privacyAcceptanceTokenHash: secret.tokenHash,
      privacyAcceptanceExpiresAt: expiresAt,
      updatedById: session.user.id,
    },
  })
  if (claimed.count !== 1) {
    return NextResponse.json(
      { error: 'El pase dejó de estar pendiente de aceptación mientras se preparaba el envío.' },
      { status: 409 }
    )
  }

  await sendAccessPrivacyInvitation({
    to: pass.subject.email,
    recipientName: `${pass.subject.firstName} ${pass.subject.lastName}`,
    familyName: pass.family.name,
    credentialCode: pass.credentialCode,
    validFrom: pass.validFrom,
    validUntil: pass.validUntil,
    organizationName: pass.subject.organization,
    accessType: pass.subject.accessType,
    passId: id,
    token: secret.token,
    subjectOverride: 'Recordatorio: confirma tu aviso de privacidad',
  })
  return NextResponse.json({
    message: 'Invitación reenviada; el enlace anterior dejó de ser válido.',
  })
}
