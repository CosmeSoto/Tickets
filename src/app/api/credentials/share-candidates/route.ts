import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  checkCredentialsModuleAccess,
  credentialEntryMetadataSelect,
  userCanMutateEntry,
} from '@/lib/credentials/access'
import { listCredentialShareCandidates } from '@/lib/credentials/share-scope'

/**
 * GET /api/credentials/share-candidates?entryId=&q=
 * Candidatos para compartir una entrada concreta (requiere poder mutarla).
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const ctx = {
    userId: session.user.id,
    role: session.user.role,
    isSuperAdmin: (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true,
  }

  if (!(await checkCredentialsModuleAccess(ctx))) {
    return NextResponse.json({ error: 'Módulo de credenciales no habilitado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const entryId = searchParams.get('entryId')?.trim()
  if (!entryId) {
    return NextResponse.json({ error: 'entryId requerido' }, { status: 400 })
  }

  const entry = await prisma.credential_entries.findUnique({
    where: { id: entryId },
    select: {
      ...credentialEntryMetadataSelect,
      createdBy: { select: { role: true, isSuperAdmin: true } },
    },
  })
  if (!entry || !entry.isActive) {
    return NextResponse.json({ error: 'Credencial no encontrada' }, { status: 404 })
  }

  if (!(await userCanMutateEntry(ctx, entry))) {
    return NextResponse.json({ error: 'Sin permiso para compartir esta credencial' }, { status: 403 })
  }

  const q = searchParams.get('q')?.trim() ?? ''
  const users = await listCredentialShareCandidates(ctx, { q, take: 50 })

  return NextResponse.json({
    users,
    meta: {
      rule: ctx.isSuperAdmin
        ? 'SuperAdmin: todos los usuarios activos (auditable)'
        : 'Tu nivel o inferior, en tu área nativa o familias asignadas de Credenciales',
    },
  })
}
