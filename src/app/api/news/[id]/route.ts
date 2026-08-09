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
import { getNewsViewer, userCanAccessNews, hasNewsModuleAccess } from '@/lib/news/news-access'

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

    const user = await getNewsViewer(session.user.id)

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    if (!hasNewsModuleAccess(user)) {
      return NextResponse.json({ error: 'No tienes acceso al módulo de noticias' }, { status: 403 })
    }

    const news = await prisma.news.findUnique({
      where: { id },
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
        news_families: true,
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

    const isCreator = news.createdById === user.id

    if (news.status !== 'PUBLISHED' && !isCreator && !user.isSuperAdmin && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Noticia no encontrada' }, { status: 404 })
    }

    if (
      !userCanAccessNews(news, user, {
        allowAdminBypass: true,
        requirePublished: news.status === 'PUBLISHED',
      })
    ) {
      return NextResponse.json({ error: 'No tienes acceso a esta noticia' }, { status: 403 })
    }

    const canSeeHidden = user.isSuperAdmin || news.createdById === user.id
    if (!canSeeHidden && news.news_comments) {
      ;(news as any).news_comments = (news.news_comments as any[])
        .filter((c: any) => !c.isHidden)
        .map((c: any) => ({
          ...c,
          replies: (c.replies || []).filter((r: any) => !r.isHidden),
        }))
    }

    return NextResponse.json({ news })
  } catch (error) {
    console.error('[/api/news/[id]] Error:', error)
    return NextResponse.json({ news: null, error: 'Error al obtener noticia' }, { status: 404 })
  }
}
