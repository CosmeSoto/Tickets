/**
 * API: User - News Feed
 * GET /api/news
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET - Obtener noticias visibles para el usuario actual
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const period = searchParams.get('period')

    const now = new Date()
    let dateFilter: any = {}

    if (period === 'today') {
      const startOfDay = new Date(now.setHours(0, 0, 0, 0))
      const endOfDay = new Date(now.setHours(23, 59, 59, 999))
      dateFilter = {
        OR: [{ startDate: null }, { startDate: { lte: endOfDay } }],
      }
    } else if (period === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      dateFilter = {
        OR: [{ startDate: null }, { startDate: { lte: now } }],
      }
    } else if (period === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      dateFilter = {
        OR: [{ startDate: null }, { startDate: { lte: now } }],
      }
    }

    const where: any = {
      status: 'PUBLISHED',
      AND: [
        dateFilter,
        {
          OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
        },
      ],
    }

    if (type) {
      where.type = type
    }

    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        role: true,
        departmentId: true,
        newsEnabled: true,
        departments: {
          select: {
            familyId: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    if (user.newsEnabled === false) {
      return NextResponse.json({ news: [] })
    }

    const userFamilyId = (user.departments as any)?.familyId

    let visibilityFilter: any = {
      OR: [
        { news_roles: { none: {} }, news_users: { none: {} }, news_departments: { none: {} } },
        { news_roles: { some: { role: user.role } } },
        { news_users: { some: { userId: user.id } } },
        ...(user.departmentId
          ? [{ news_departments: { some: { departmentId: user.departmentId } } }]
          : []),
      ],
    }

    try {
      const test = await prisma.news_families.count()
      visibilityFilter = {
        OR: [
          {
            news_roles: { none: {} },
            news_users: { none: {} },
            news_departments: { none: {} },
            news_families: { none: {} },
          },
          { news_roles: { some: { role: user.role } } },
          { news_users: { some: { userId: user.id } } },
          ...(user.departmentId
            ? [{ news_departments: { some: { departmentId: user.departmentId } } }]
            : []),
          ...(userFamilyId ? [{ news_families: { some: { familyId: userFamilyId } } }] : []),
        ],
      }
    } catch (e) {
      console.log('news_families relation not yet synced, skipping for now')
    }

    where.AND.push(visibilityFilter)

    const news = await prisma.news.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        news_roles: true,
        news_users: true,
        news_departments: true,
        news_views: {
          where: { userId: user.id },
          select: { id: true },
        },
        news_reactions: {
          where: { userId: user.id },
          select: { id: true, reaction: true },
        },
        _count: {
          select: {
            news_views: true,
            news_reactions: true,
            news_comments: true,
          },
        },
      },
      orderBy: [{ isFeatured: 'desc' }, { priority: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({ news })
  } catch (error) {
    console.error('Error obteniendo noticias:', error)
    return NextResponse.json({ error: 'Error al obtener noticias' }, { status: 500 })
  }
}
