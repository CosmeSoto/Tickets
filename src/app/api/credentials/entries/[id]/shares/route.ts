import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  checkCredentialsModuleAccess,
  canManageCredentialsVault,
  userCanAccessVault,
} from '@/lib/credentials/access'
import { assertCanShareCredentialWith } from '@/lib/credentials/share-scope'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import { notifyUser } from '@/lib/api/notify'

const createShareSchema = z.object({
  userId: z.string().min(1, 'Selecciona un usuario'),
  /** MVP: solo VIEW (revelar/usar). EDIT/ADMIN quedan para más adelante. */
  capability: z.enum(['VIEW']).optional().default('VIEW'),
})

type RouteParams = { params: Promise<{ id: string }> }

async function loadEntryWithVault(id: string) {
  return prisma.credential_entries.findFirst({
    where: { id, isActive: true },
    include: { vault: true },
  })
}

/**
 * GET — lista compartidos de una credencial (solo gestores del vault).
 * POST — comparte con un usuario que tenga el módulo Credenciales activo.
 * No envía el secreto; el destinatario revela con auditoría.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { id } = await params
  const ctx = {
    userId: session.user.id,
    role: session.user.role,
    isSuperAdmin: (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true,
  }

  if (!(await checkCredentialsModuleAccess(ctx))) {
    return NextResponse.json({ error: 'Módulo de credenciales no habilitado' }, { status: 403 })
  }
  if (!(await canManageCredentialsVault(session.user.id, session.user.role, ctx.isSuperAdmin))) {
    return NextResponse.json({ error: 'Sin permiso para gestionar compartidos' }, { status: 403 })
  }

  const entry = await loadEntryWithVault(id)
  if (!entry) {
    return NextResponse.json({ error: 'Credencial no encontrada' }, { status: 404 })
  }
  if (!(await userCanAccessVault(ctx, entry.vault))) {
    return NextResponse.json({ error: 'Sin acceso a la bóveda' }, { status: 403 })
  }

  const shares = await prisma.credential_shares.findMany({
    where: { entryId: id },
    include: {
      user: { select: { id: true, name: true, email: true, role: true, credentialsEnabled: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ shares })
}

export async function POST(request: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { id } = await params
  const ctx = {
    userId: session.user.id,
    role: session.user.role,
    isSuperAdmin: (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true,
  }

  if (!(await checkCredentialsModuleAccess(ctx))) {
    return NextResponse.json({ error: 'Módulo de credenciales no habilitado' }, { status: 403 })
  }
  if (!(await canManageCredentialsVault(session.user.id, session.user.role, ctx.isSuperAdmin))) {
    return NextResponse.json({ error: 'Sin permiso para compartir' }, { status: 403 })
  }

  const entry = await loadEntryWithVault(id)
  if (!entry) {
    return NextResponse.json({ error: 'Credencial no encontrada' }, { status: 404 })
  }
  if (!(await userCanAccessVault(ctx, entry.vault))) {
    return NextResponse.json({ error: 'Sin acceso a la bóveda' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createShareSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Datos inválidos' },
      { status: 400 }
    )
  }

  const scopeCheck = await assertCanShareCredentialWith(ctx, parsed.data.userId)
  if (!scopeCheck.ok) {
    return NextResponse.json({ error: scopeCheck.error }, { status: 422 })
  }
  const target = scopeCheck.target

  const existing = await prisma.credential_shares.findFirst({
    where: { entryId: id, userId: target.id },
  })
  if (existing) {
    return NextResponse.json(
      { error: 'Esta credencial ya está compartida con ese usuario' },
      { status: 409 }
    )
  }

  const share = await prisma.credential_shares.create({
    data: {
      id: randomUUID(),
      entryId: id,
      userId: target.id,
      capability: parsed.data.capability,
    },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  })

  await AuditServiceComplete.log({
    action: AuditActionsComplete.CREDENTIAL_SHARED,
    entityType: 'credential_entry',
    entityId: id,
    userId: session.user.id,
    details: {
      shareId: share.id,
      title: entry.title,
      targetUserId: target.id,
      targetEmail: target.email,
      targetRole: target.role,
      capability: share.capability,
    },
    ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  })

  // Notificación in-app (sin secreto). Tipo INFO para no exigir migración de enum.
  await notifyUser(
    target.id,
    'INFO',
    'Credencial compartida contigo',
    `${session.user.name || 'Un colega'} te compartió «${entry.title}». Ábrela en Credenciales y usa «Usar / revelar» (queda auditado).`,
    { metadata: { link: '/credentials', entryId: id, kind: 'credential_shared' } }
  )

  return NextResponse.json({ share }, { status: 201 })
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { id } = await params
  const ctx = {
    userId: session.user.id,
    role: session.user.role,
    isSuperAdmin: (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true,
  }

  if (!(await checkCredentialsModuleAccess(ctx))) {
    return NextResponse.json({ error: 'Módulo de credenciales no habilitado' }, { status: 403 })
  }
  if (!(await canManageCredentialsVault(session.user.id, session.user.role, ctx.isSuperAdmin))) {
    return NextResponse.json({ error: 'Sin permiso para revocar compartidos' }, { status: 403 })
  }

  const entry = await loadEntryWithVault(id)
  if (!entry) {
    return NextResponse.json({ error: 'Credencial no encontrada' }, { status: 404 })
  }
  if (!(await userCanAccessVault(ctx, entry.vault))) {
    return NextResponse.json({ error: 'Sin acceso a la bóveda' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const shareId = searchParams.get('shareId')
  const targetUserId = searchParams.get('userId')
  if (!shareId && !targetUserId) {
    return NextResponse.json({ error: 'Indica shareId o userId' }, { status: 400 })
  }

  const share = await prisma.credential_shares.findFirst({
    where: {
      entryId: id,
      ...(shareId ? { id: shareId } : { userId: targetUserId! }),
    },
  })
  if (!share) {
    return NextResponse.json({ error: 'Compartido no encontrado' }, { status: 404 })
  }

  await prisma.credential_shares.delete({ where: { id: share.id } })

  await AuditServiceComplete.log({
    action: AuditActionsComplete.CREDENTIAL_SHARE_REVOKED,
    entityType: 'credential_entry',
    entityId: id,
    userId: session.user.id,
    details: {
      shareId: share.id,
      title: entry.title,
      targetUserId: share.userId,
      capability: share.capability,
    },
    ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  })

  return NextResponse.json({ success: true })
}
