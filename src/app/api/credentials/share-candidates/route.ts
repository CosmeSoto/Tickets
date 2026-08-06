import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { checkCredentialsModuleAccess, canManageCredentialsVault } from '@/lib/credentials/access'

/**
 * GET /api/credentials/share-candidates?q=
 * Usuarios activos con módulo Credenciales (o SuperAdmin) para el picker de compartir.
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
  if (!(await canManageCredentialsVault(session.user.id, session.user.role, ctx.isSuperAdmin))) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''

  const users = await prisma.users.findMany({
    where: {
      isActive: true,
      id: { not: session.user.id },
      OR: [{ credentialsEnabled: true }, { isSuperAdmin: true, role: 'ADMIN' }],
      ...(q
        ? {
            AND: [
              {
                OR: [
                  { name: { contains: q, mode: 'insensitive' } },
                  { email: { contains: q, mode: 'insensitive' } },
                ],
              },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
    orderBy: { name: 'asc' },
    take: 40,
  })

  return NextResponse.json({ users })
}
