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
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import { assertCanManageNews, assertCanModifyNews } from '@/lib/news/news-manage-access'
import {
  getContentVisibilityScope,
  sanitizeVisibilityPayload,
} from '@/lib/content/visibility-scope'
import { buildVisibilityAuditSummary } from '@/lib/content/visibility-audit'
import { buildNewsVisibilityConditions, getNewsViewer } from '@/lib/news/news-access'

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

    const denied = await assertCanManageNews(session.user.id, session.user.role)
    if (denied) return denied

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

    const viewer = await getNewsViewer(session.user.id)
    if (!viewer?.isSuperAdmin) {
      const inScope = await prisma.news.count({
        where: {
          id,
          OR: viewer ? buildNewsVisibilityConditions(viewer) : [{ createdById: session.user.id }],
        },
      })
      if (!inScope) {
        return NextResponse.json({ error: 'No tienes acceso a esta noticia' }, { status: 403 })
      }
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

    const deniedManage = await assertCanManageNews(session.user.id, session.user.role)
    if (deniedManage) return deniedManage
    const deniedModify = await assertCanModifyNews(id, session.user.id, session.user.role)
    if (deniedModify) return deniedModify

    const data = await request.json()
    const existingNews = await prisma.news.findUnique({
      where: { id: id },
    })

    if (!existingNews) {
      return NextResponse.json({ error: 'Noticia no encontrada' }, { status: 404 })
    }

    const isSuperAdmin =
      (
        await prisma.users.findUnique({
          where: { id: session.user.id },
          select: { isSuperAdmin: true },
        })
      )?.isSuperAdmin === true
    let sanitized = null as Awaited<ReturnType<typeof sanitizeVisibilityPayload>> | null
    if (
      data.roles !== undefined ||
      data.userIds !== undefined ||
      data.departmentIds !== undefined ||
      data.familyIds !== undefined
    ) {
      const visScope = await getContentVisibilityScope(
        session.user.id,
        session.user.role,
        isSuperAdmin
      )
      sanitized = await sanitizeVisibilityPayload(visScope, {
        roles: data.roles,
        familyIds: data.familyIds,
        departmentIds: data.departmentIds,
        userIds: data.userIds,
      })
      if (sanitized instanceof NextResponse) return sanitized
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

    if (sanitized && !(sanitized instanceof NextResponse)) {
      await prisma.news_roles.deleteMany({ where: { newsId: id } })
      if (sanitized.roles.length) {
        await prisma.news_roles.createMany({
          data: sanitized.roles.map(role => ({ newsId: id, role })),
        })
      }

      await prisma.news_users.deleteMany({ where: { newsId: id } })
      if (sanitized.userIds.length) {
        await prisma.news_users.createMany({
          data: sanitized.userIds.map(userId => ({ newsId: id, userId })),
        })
      }

      await prisma.news_departments.deleteMany({ where: { newsId: id } })
      if (sanitized.departmentIds.length) {
        await prisma.news_departments.createMany({
          data: sanitized.departmentIds.map(departmentId => ({
            newsId: id,
            departmentId,
          })),
        })
      }

      await prisma.news_families.deleteMany({ where: { newsId: id } })
      if (sanitized.familyIds.length) {
        await prisma.news_families.createMany({
          data: sanitized.familyIds.map(familyId => ({ newsId: id, familyId })),
        })
      }
    }

    const visibilitySummary =
      sanitized && !(sanitized instanceof NextResponse)
        ? buildVisibilityAuditSummary(sanitized)
        : {}

    await AuditServiceComplete.log({
      action:
        data.status === 'PUBLISHED' && existingNews.status !== 'PUBLISHED'
          ? AuditActionsComplete.NEWS_PUBLISHED
          : AuditActionsComplete.NEWS_UPDATED,
      entityType: 'news',
      entityId: news.id,
      userId: session.user.id,
      oldValues: {
        title: existingNews.title,
        status: existingNews.status,
        priority: existingNews.priority,
      },
      newValues: {
        title: data.title || existingNews.title,
        status: data.status,
        priority: data.priority,
        ...visibilitySummary,
      },
      details: {
        source: 'news_module',
        publishedNow: data.status === 'PUBLISHED' && existingNews.status !== 'PUBLISHED',
      },
      request,
    })

    // Notificar solo a destinatarios de la visibilidad al publicar
    if (data.status === 'PUBLISHED' && existingNews.status !== 'PUBLISHED') {
      try {
        const { NotificationService } = await import('@/lib/services/notification-service')
        const { NotificationType } = await import('@prisma/client')
        const { NotificationEvents } = await import('@/lib/notification-events')
        const { getNewsNotificationLink, getNewsNotificationRecipientIds } =
          await import('@/lib/news/news-access')

        const targetUsers = await getNewsNotificationRecipientIds(news.id, session.user.id)
        const targetIds = targetUsers.map(u => u.id)

        if (targetIds.length > 0) {
          NotificationEvents.emitToMany?.(targetIds, {
            type: 'news_published',
            newsId: news.id,
            newsType: news.type,
          })
        }

        const newsPriority = news.priority ?? 'MEDIUM'
        const priorityLabel =
          newsPriority === 'URGENT' ? '🚨 ' : newsPriority === 'HIGH' ? '⚠️ ' : ''

        await Promise.allSettled(
          targetUsers.map(u =>
            NotificationService.push({
              userId: u.id,
              type:
                newsPriority === 'URGENT' || newsPriority === 'HIGH'
                  ? NotificationType.WARNING
                  : NotificationType.INFO,
              title: `${priorityLabel}Nueva noticia publicada`,
              message: `${news.title}`,
              metadata: {
                link: getNewsNotificationLink(u),
                newsId: news.id,
              },
            })
          )
        )
      } catch {
        // no-op: notificación opcional
      }
    }

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

    const deniedManage = await assertCanManageNews(session.user.id, session.user.role)
    if (deniedManage) return deniedManage
    const deniedModify = await assertCanModifyNews(id, session.user.id, session.user.role)
    if (deniedModify) return deniedModify

    const existingNews = await prisma.news.findUnique({
      where: { id: id },
    })

    if (!existingNews) {
      return NextResponse.json({ error: 'Noticia no encontrada' }, { status: 404 })
    }

    await prisma.news.delete({
      where: { id: id },
    })

    await AuditServiceComplete.log({
      action: AuditActionsComplete.NEWS_DELETED,
      entityType: 'news',
      entityId: id,
      userId: session.user.id,
      oldValues: { title: existingNews.title, status: existingNews.status },
      request,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error eliminando noticia:', error)
    return NextResponse.json({ error: 'Error al eliminar noticia' }, { status: 500 })
  }
}
