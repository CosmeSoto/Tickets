import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * GET /api/settings/sla
 * Retorna políticas SLA agrupadas: { byCategory, byFamily, global }
 * Solo accesible por ADMIN.
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const policies = await prisma.sla_policies.findMany({
      where: { isActive: true },
      include: {
        category: { select: { id: true, name: true } },
        family: { select: { id: true, name: true, code: true, color: true } },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    })

    // Agrupar políticas
    const byCategory = policies.filter((p) => p.categoryId !== null)
    const global = policies.filter((p) => p.categoryId === null && p.familyId === null)

    // byFamily: { [familyId]: sla_policies[] }
    const byFamily: Record<string, typeof policies> = {}
    for (const policy of policies) {
      if (policy.familyId && !policy.categoryId) {
        if (!byFamily[policy.familyId]) {
          byFamily[policy.familyId] = []
        }
        byFamily[policy.familyId].push(policy)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        byCategory,
        byFamily,
        global,
      },
    })
  } catch (error) {
    console.error('Error obteniendo políticas SLA:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
