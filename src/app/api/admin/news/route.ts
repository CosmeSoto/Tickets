/**
 * API: Admin - News Management
 * GET /api/admin/news
 * POST /api/admin/news
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

/**
 * GET - Obtener listado de noticias
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Leer siempre desde DB para tener datos frescos (sesión puede estar desactualizada)
    const dbUser = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { newsEnabled: true, isSuperAdmin: true, role: true },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const isSuperAdmin = dbUser.isSuperAdmin === true
    const isAdmin = dbUser.role === 'ADMIN'
    const hasNewsAccess = dbUser.newsEnabled === true || isAdmin

    if (!hasNewsAccess) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const search = searchParams.get('search')

    const where: any = {}

    // Super Admin ve todo; los demás solo ven sus propias noticias
    if (!isSuperAdmin) {
      where.createdById = session.user.id
    }

    if (status && status !== 'all') {
      where.status = status
    }

    if (type && type !== 'all') {
      where.type = type
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
      ]
    }

    const news = await prisma.news.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        news_roles: true,
        news_users: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        news_departments: {
          include: {
            departments: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        news_families: {
          include: {
            families: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        news_attachments: true,
        _count: {
          select: {
            news_views: true,
            news_reactions: true,
            news_comments: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ news })
  } catch (error) {
    console.error('[/api/admin/news GET] Error:', error)
    // No devolver 500 — devolver array vacío para no romper la UI
    return NextResponse.json({ news: [] })
  }
}

/**
 * POST - Crear nueva noticia
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN' && !session.user.isSuperAdmin) {
      // Permitir acceso a usuarios con newsEnabled (gestores de noticias)
      const userHasNewsAccess = await prisma.users.findUnique({
        where: { id: session.user.id },
        select: { newsEnabled: true },
      })
      if (!userHasNewsAccess?.newsEnabled) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      }
    }

    const data = await request.json()

    const slug = data.title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim()
      .substring(0, 200)

    const news = await prisma.news.create({
      data: {
        title: data.title,
        slug: `${slug}-${Date.now()}`,
        content: data.content,
        summary: data.summary,
        imageUrl: data.imageUrl,
        type: data.type,
        priority: data.priority,
        status: data.status,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        isFeatured: data.isFeatured || false,
        allowComments: data.allowComments || false,
        allowReactions: data.allowReactions !== false,
        createdById: session.user.id,
        news_roles: {
          create: data.roles?.map((role: string) => ({ role })) || [],
        },
        news_users: {
          create: data.userIds?.map((userId: string) => ({ userId })) || [],
        },
        news_departments: {
          create: data.departmentIds?.map((departmentId: string) => ({ departmentId })) || [],
        },
        news_families: {
          create: data.familyIds?.map((familyId: string) => ({ familyId })) || [],
        },
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        news_roles: true,
        news_users: true,
        news_departments: true,
      },
    })

    await createAuditLog({
      action: 'CREATE',
      entityType: 'NEWS',
      entityId: news.id,
      userId: session.user.id,
      metadata: { title: data.title, type: data.type },
    })

    return NextResponse.json({ news })
  } catch (error) {
    console.error('Error creando noticia:', error)
    return NextResponse.json({ error: 'Error al crear noticia' }, { status: 500 })
  }
}
