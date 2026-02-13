import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * GET /api/admin/sla/violations
 * Obtener violaciones de SLA
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const isResolved = searchParams.get('isResolved')
    const severity = searchParams.get('severity')

    const where: any = {}

    if (isResolved !== null && isResolved !== undefined) {
      where.isResolved = isResolved === 'true'
    }

    if (severity) {
      where.severity = severity
    }

    const [violations, total] = await Promise.all([
      prisma.sla_violations.findMany({
        where,
        include: {
          ticket: {
            select: {
              id: true,
              title: true,
              priority: true,
              status: true,
              users_tickets_clientIdTousers: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              },
              users_tickets_assigneeIdTousers: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          },
          sla_policy: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.sla_violations.count({ where })
    ])

    return NextResponse.json({
      success: true,
      data: violations,
      meta: {
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: (page * limit) < total,
          hasPrev: page > 1
        }
      }
    })
  } catch (error) {
    console.error('[SLA] Error obteniendo violaciones:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al obtener violaciones SLA',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
