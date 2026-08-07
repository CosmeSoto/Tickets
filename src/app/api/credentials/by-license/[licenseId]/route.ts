import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  checkCredentialsModuleAccess,
  credentialEntryMetadataSelect,
  getCredentialsFamilyScopeIds,
} from '@/lib/credentials/access'

type RouteParams = { params: Promise<{ licenseId: string }> }

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { licenseId } = await params
  const ctx = {
    userId: session.user.id,
    role: session.user.role,
    isSuperAdmin: (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true,
  }

  if (!(await checkCredentialsModuleAccess(ctx))) {
    return NextResponse.json({ error: 'Módulo de credenciales no habilitado' }, { status: 403 })
  }

  const familyIds = await getCredentialsFamilyScopeIds(session.user.id, {
    isSuperAdmin: ctx.isSuperAdmin,
  })

  const entries = await prisma.credential_entries.findMany({
    where: {
      licenseId,
      isActive: true,
      vault: {
        isActive: true,
        OR: [{ familyId: { in: familyIds } }, { ownerUserId: session.user.id, kind: 'PERSONAL' }],
      },
    },
    select: credentialEntryMetadataSelect,
    orderBy: { title: 'asc' },
  })

  return NextResponse.json({ entries })
}
