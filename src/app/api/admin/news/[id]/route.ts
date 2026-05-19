/**
 * API: Admin - Single News Management
 * GET /api/admin/news/[id]
 * PUT /api/admin/news/[id]
 * DELETE /api/admin/news/[id]
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'

interface Params {
  params: Promise<{ id: string }>
}

/**
 * GET - Obtener una noticia por ID
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN' && !session.user.isSuperAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const news = await prisma.news.findUnique({
      where: { id },
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
    })

    if (!news) {
      return NextResponse.json({ error: 'Noticia no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ news })
  } catch (error) {
    console.error('Error obteniendo noticia:', error)
    return NextResponse.json({ error: 'Error al obtener noticia' }, { status: 500 })
  }
}

/**
 * PUT - Actualizar una noticia
 */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN' && !session.user.isSuperAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const data = await request.json()
    const existingNews = await prisma.news.findUnique({
      where: { id: id },
    })

    if (!existingNews) {
      return NextResponse.json({ error: 'Noticia no encontrada' }, { status: 404 })
    }

    let slug = existingNews.slug
    if (data.title && data.title !== existingNews.title) {
      slug = data.title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .trim()
        .substring(0, 200)
      slug = `${slug}-${Date.now()}`
    }

    const news = await prisma.news.update({
      where: { id: id },
      data: {
        title: data.title,
        slug,
        content: data.content,
        summary: data.summary,
        imageUrl: data.imageUrl,
        type: data.type,
        priority: data.priority,
        status: data.status,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        isFeatured: data.isFeatured,
        allowComments: data.allowComments,
        allowReactions: data.allowReactions,
        updatedById: session.user.id,
      },
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
        news_users: true,
        news_departments: true,
      },
    })

    if (data.roles !== undefined) {
      await prisma.news_roles.deleteMany({ where: { newsId: id } })
      await prisma.news_roles.createMany({
        data: data.roles.map((role: string) => ({ newsId: id, role })),
      })
    }

    if (data.userIds !== undefined) {
      await prisma.news_users.deleteMany({ where: { newsId: id } })
      await prisma.news_users.createMany({
        data: data.userIds.map((userId: string) => ({ newsId: id, userId })),
      })
    }

    if (data.departmentIds !== undefined) {
      await prisma.news_departments.deleteMany({ where: { newsId: id } })
      await prisma.news_departments.createMany({
        data: data.departmentIds.map((departmentId: string) => ({
          newsId: id,
          departmentId,
        })),
      })
    }

    if (data.familyIds !== undefined) {
      await prisma.news_families.deleteMany({ where: { newsId: id } })
      await prisma.news_families.createMany({
        data: data.familyIds.map((familyId: string) => ({ newsId: id, familyId })),
      })
    }

    await createAuditLog({
      action: 'UPDATE',
      entityType: 'NEWS',
      entityId: news.id,
      userId: session.user.id,
      metadata: { title: data.title || existingNews.title },
    })

    return NextResponse.json({ news })
  } catch (error) {
    console.error('Error actualizando noticia:', error)
    return NextResponse.json({ error: 'Error al actualizar noticia' }, { status: 500 })
  }
}

/**
 * DELETE - Eliminar una noticia
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN' && !session.user.isSuperAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const existingNews = await prisma.news.findUnique({
      where: { id: id },
    })

    if (!existingNews) {
      return NextResponse.json({ error: 'Noticia no encontrada' }, { status: 404 })
    }

    await prisma.news.delete({
      where: { id: id },
    })

    await createAuditLog({
      action: 'DELETE',
      entityType: 'NEWS',
      entityId: id,
      userId: session.user.id,
      metadata: { title: existingNews.title },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error eliminando noticia:', error)
    return NextResponse.json({ error: 'Error al eliminar noticia' }, { status: 500 })
  }
}
