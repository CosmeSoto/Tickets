import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { checkCredentialsModuleAccess, userCanAccessEntry } from '@/lib/credentials/access'
import { EncryptionService } from '@/lib/services/encryption.service'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * POST — Devuelve el secreto solo para pegar en portapapeles (estilo KeePass).
 * No es un “reveal” en UI: el cliente debe copiar y descartar sin mostrarlo.
 * Queda auditado como credential_copied (distinto de credential_revealed).
 */
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

  const entry = await prisma.credential_entries.findFirst({
    where: { id, isActive: true },
    include: { vault: true },
  })

  if (!entry) {
    return NextResponse.json({ error: 'Credencial no encontrada' }, { status: 404 })
  }

  if (!(await userCanAccessEntry(ctx, entry))) {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  }

  const secret = EncryptionService.decrypt(entry.secretEncrypted)

  await prisma.credential_entries.update({
    where: { id },
    data: { lastRevealedAt: new Date() },
  })

  await AuditServiceComplete.log({
    action: AuditActionsComplete.CREDENTIAL_COPIED,
    entityType: 'credential_entry',
    entityId: id,
    userId: session.user.id,
    details: {
      title: entry.title,
      vaultId: entry.vaultId,
      mode: 'clipboard',
      // Nunca incluir el secreto en auditoría
    },
    ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  })

  return NextResponse.json({
    secret,
    /** Hint al cliente: no renderizar; solo clipboard */
    display: 'clipboard_only',
  })
}
