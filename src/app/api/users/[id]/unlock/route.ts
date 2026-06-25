import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SecurityConfigService } from '@/lib/services/security-config-service'
import prisma from '@/lib/prisma'

/**
 * POST /api/users/[id]/unlock
 * Desbloquea una cuenta bloqueada por intentos fallidos de login.
 * Solo ADMIN.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params

  const { assertAdminCanManageUser } = await import('@/lib/auth/admin-scope')
  const scopeCheck = await assertAdminCanManageUser(
    session.user.id,
    (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true,
    id
  )
  if (!scopeCheck.allowed) {
    return NextResponse.json({ error: scopeCheck.error }, { status: scopeCheck.status })
  }

  const user = await prisma.users.findUnique({ where: { id }, select: { email: true, name: true } })
  if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  await SecurityConfigService.unlockAccount(user.email)

  return NextResponse.json({ success: true, message: `Cuenta de ${user.name} desbloqueada` })
}
