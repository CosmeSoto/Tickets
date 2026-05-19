/**
 * API: User - Single News Actions
 * GET /api/news/[id]
 * POST /api/news/[id]/view
 * POST /api/news/[id]/react
 * POST /api/news/[id]/comment
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * GET - Obtener una noticia por ID (para usuarios)
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        role: true,
        departmentId: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const news = await prisma.news.findUnique({
      where: {
        id: id,
        status: 'PUBLISHED',
        AND: [
          {
            OR: [{ startDate: null }, { startDate: { lte: new Date() } }],
          },
          {
            OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
          },
        ],
      },
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
        news_attachments: true,
        news_comments: {
          where: { parentId: null },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
            replies: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    avatar: true,
                  },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            news_views: true,
            news_reactions: true,
            news_comments: true,
          },
        },
      },
    })

    if (!news) {
      return NextResponse.json({ error: 'Noticia no encontrada' }, { status: 404 })
    }

    const hasAccess =
      news.news_roles.length === 0 &&
      news.news_users.length === 0 &&
      (news as any).news_departments.length === 0

    if (!hasAccess) {
      const hasRoleAccess = news.news_roles.some((nr: any) => nr.role === user.role)
      const hasUserAccess = news.news_users.some((nu: any) => nu.userId === user.id)
      const hasDeptAccess = user.departmentId
        ? (news as any).news_departments.some((nd: any) => nd.departmentId === user.departmentId)
        : false

      if (!hasRoleAccess && !hasUserAccess && !hasDeptAccess) {
        return NextResponse.json({ error: 'No tienes acceso a esta noticia' }, { status: 403 })
      }
    }

    return NextResponse.json({ news })
  } catch (error) {
    console.error('Error obteniendo noticia:', error)
    return NextResponse.json({ error: 'Error al obtener noticia' }, { status: 500 })
  }
}
