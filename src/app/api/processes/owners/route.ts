import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  assertCanManageProcesses,
  getProcessAccess,
  isFamilyWithinProcessScope,
} from '@/lib/processes/access'

/**
 * GET /api/processes/owners?familyId=...
 * Devuelve únicamente usuarios activos que pueden acceder al área indicada y,
 * por tanto, pueden asumir la responsabilidad del proceso.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const denied = await assertCanManageProcesses(session.user.id, session.user.role)
  if (denied) return denied

  const familyId = new URL(request.url).searchParams.get('familyId')
  if (!familyId) return NextResponse.json({ error: 'familyId es obligatorio.' }, { status: 400 })

  const access = await getProcessAccess(session.user.id, session.user.role)
  if (!isFamilyWithinProcessScope(access, familyId)) {
    return NextResponse.json({ error: 'No tienes acceso a esa área.' }, { status: 403 })
  }

  const owners = await (prisma as any).users.findMany({
    where: {
      isActive: true,
      OR: [
        { isSuperAdmin: true },
        {
          AND: [
            { OR: [{ processesEnabled: true }, { canManageProcesses: true }] },
            {
              OR: [
                { departments: { familyId } },
                {
                  userFamilyAccess: {
                    some: {
                      familyId,
                      module: 'processes',
                      isActive: true,
                      OR: [{ canView: true }, { canOperate: true }, { canConsume: true }],
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ owners })
}
