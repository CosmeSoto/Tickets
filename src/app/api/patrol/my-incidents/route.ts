/**
 * GET /api/patrol/my-incidents
 * Devuelve los tickets con source=PATROL creados por el agente autenticado.
 * Solo accesible por el agente (TECHNICIAN / CLIENT con patrolsEnabled).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    // Verificar que el usuario tiene el módulo de patrullas habilitado
    const sessionUser = session.user as { patrolsEnabled?: boolean }
    const fromToken = sessionUser.patrolsEnabled

    if (fromToken === false) {
      return NextResponse.json({ error: 'Módulo de patrullas no habilitado' }, { status: 403 })
    }

    if (fromToken !== true) {
      const me = await prisma.users.findUnique({
        where: { id: session.user.id },
        select: { patrolsEnabled: true },
      })
      if (!me?.patrolsEnabled) {
        return NextResponse.json({ error: 'Módulo de patrullas no habilitado' }, { status: 403 })
      }
    }

    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status')
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50')))
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))

    const where: any = {
      source: 'PATROL',
      // El agente es el "cliente" del ticket en el modelo de incidentes de patrulla
      clientId: session.user.id,
    }

    if (statusParam) {
      where.status = statusParam
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
    console.error('[patrol/my-incidents] GET:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
