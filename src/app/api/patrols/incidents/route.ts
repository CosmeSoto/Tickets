/**
 * GET /api/patrols/incidents
 * Lista tickets con source=PATROL (incidencias de rondas) filtrados por familias del usuario.
 * Supervisores (TECHNICIAN/ADMIN) ven incidencias de sus familias asignadas.
 * Super Admin ve todas.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { checkPatrolModuleAccess } from '@/lib/patrol/patrol-helpers'
import { getPatrolAccessibleFamilyIds } from '@/lib/patrol/patrol-access'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    if (!['ADMIN', 'TECHNICIAN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const denied = await checkPatrolModuleAccess(session.user.id, session.user.role)
    if (denied) return denied

    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status')
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50')))
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))

    // Determinar familias accesibles
    const isSuperAdmin = (session.user as any).isSuperAdmin === true
    const accessibleFamilyIds = await getPatrolAccessibleFamilyIds(
      session.user.id,
      session.user.role,
      isSuperAdmin
    )

    // Construir filtro
    const where: any = { source: 'PATROL' }

    if (statusParam) {
      where.status = statusParam
    }

    // Filtrar por familias accesibles (undefined = sin restricción para super admin)
    if (accessibleFamilyIds !== undefined) {
      if (accessibleFamilyIds.length === 0) {
        // Sin familias = sin acceso a incidencias
        return NextResponse.json({
          success: true,
          data: [],
          pagination: { total: 0, page, limit, totalPages: 0 },
        })
      }
      where.familyId = { in: accessibleFamilyIds }
    }

    const [total, tickets] = await Promise.all([
      prisma.tickets.count({ where }),
      prisma.tickets.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          createdAt: true,
          ticketCode: true,
          family: { select: { id: true, name: true, color: true } },
          users_tickets_clientIdTousers: { select: { id: true, name: true } },
          users_tickets_assigneeIdTousers: { select: { id: true, name: true } },
          checkIn: {
            select: {
              id: true,
              checkpoint: { select: { id: true, name: true } },
              patrol: {
                select: {
                  id: true,
                  route: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    const data = tickets.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      createdAt: t.createdAt.toISOString(),
      ticketCode: t.ticketCode,
      family: t.family,
      client: t.users_tickets_clientIdTousers,
      assignee: t.users_tickets_assigneeIdTousers,
      checkIn: t.checkIn
        ? {
            id: t.checkIn.id,
            checkpoint: t.checkIn.checkpoint,
            patrol: t.checkIn.patrol
              ? { id: t.checkIn.patrol.id, route: t.checkIn.patrol.route }
              : null,
          }
        : null,
    }))

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('[patrols/incidents] GET:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
