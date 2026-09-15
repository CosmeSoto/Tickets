import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getAdminTicketFamilyFilter } from '@/lib/auth/admin-scope'

/**
 * GET /api/categories/priority-ceiling-stats?days=30
 *
 * Cuenta, por categoría, cuántos tickets recientes tuvieron su prioridad
 * recortada por el techo automático (tickets.requestedPriority !== null —
 * ver src/lib/tickets/priority-triage.ts). Es la señal para que un admin
 * decida si debe subir el techo de esa categoría: si los clientes chocan
 * seguido contra él, probablemente esté configurado demasiado bajo para el
 * tipo de problema real que representa esa categoría.
 *
 * Solo ADMIN (scope de familia igual que el resto de reportes admin — ver
 * getAdminTicketFamilyFilter, ya usado en /api/dashboard/tickets).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const daysParam = parseInt(searchParams.get('days') || '30')
    const days = Number.isFinite(daysParam) ? Math.min(Math.max(daysParam, 1), 365) : 30
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true
    const familyFilter = await getAdminTicketFamilyFilter(session.user.id, isSuperAdmin)

    const rows = await prisma.tickets.groupBy({
      by: ['categoryId'],
      where: {
        requestedPriority: { not: null },
        createdAt: { gte: since },
        ...familyFilter,
      },
      _count: { _all: true },
    })

    return NextResponse.json({
      success: true,
      days,
      data: rows.map(r => ({ categoryId: r.categoryId, count: r._count._all })),
    })
  } catch (error) {
    console.error('[GET /api/categories/priority-ceiling-stats]', error)
    return NextResponse.json(
      { success: false, message: 'Error al calcular estadísticas de techo de prioridad' },
      { status: 500 }
    )
  }
}
