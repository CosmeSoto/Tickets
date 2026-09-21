/**
 * GET /api/planner/reports/catalog
 * Opciones para los filtros del reporte de Tareas: técnicos (solo si el
 * usuario puede filtrar por otra persona) y áreas dentro de su alcance.
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { assertCanViewPlanner, getPlannerAccess } from '@/lib/planner/access'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const denied = await assertCanViewPlanner(session.user.id, session.user.role)
  if (denied) return denied

  const access = await getPlannerAccess(session.user.id, session.user.role)
  const isSuperAdmin = (session.user as any).isSuperAdmin === true
  const canFilterByTechnician = access.canManage || session.user.role === 'ADMIN' || isSuperAdmin

  const [technicians, families] = await Promise.all([
    canFilterByTechnician
      ? prisma.users.findMany({
          where: { role: { in: ['ADMIN', 'TECHNICIAN'] }, isActive: true },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      : Promise.resolve([]),
    prisma.families.findMany({
      where: access.familyIds ? { id: { in: access.familyIds } } : undefined,
      select: { id: true, name: true, color: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return NextResponse.json({ canFilterByTechnician, technicians, families })
}
