import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkCredentialsModuleAccess } from '@/lib/credentials/access'
import { listCredentialShareCandidates } from '@/lib/credentials/share-scope'

/**
 * GET /api/credentials/share-candidates?q=
 * Lista usuarios del sistema según jerarquía del emisor (SuperAdmin / Admin / inferior).
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

  const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
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
