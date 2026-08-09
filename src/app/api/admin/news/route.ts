/**
 * API: Admin - News Management
 * GET /api/admin/news
 * POST /api/admin/news
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import { assertCanManageNews } from '@/lib/news/news-manage-access'
import {
  getContentVisibilityScope,
  sanitizeVisibilityPayload,
} from '@/lib/content/visibility-scope'
import { buildVisibilityAuditSummary } from '@/lib/content/visibility-audit'
import { buildNewsVisibilityConditions, getNewsViewer } from '@/lib/news/news-access'

/**
 * GET - Obtener listado de noticias
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const denied = await assertCanManageNews(session.user.id, session.user.role)
    if (denied) return denied

    const dbUser = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { isSuperAdmin: true, role: true },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const isSuperAdmin = dbUser.isSuperAdmin === true

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const search = searchParams.get('search')

    const where: any = {}

    // Super Admin ve todo; el resto: creadas + visibles por alcance
    if (!isSuperAdmin) {
      const viewer = await getNewsViewer(session.user.id)
      if (viewer) {
        where.OR = buildNewsVisibilityConditions(viewer)
      }
    }

    if (status && status !== 'all') {
      where.status = status
    }

    if (type && type !== 'all') {
      where.type = type
    }

    if (search) {
      // Combinar búsqueda con visibilidad usando AND
      const searchCondition = {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { content: { contains: search, mode: 'insensitive' } },
          { summary: { contains: search, mode: 'insensitive' } },
        ],
      }
      if (where.OR) {
        where.AND = [{ OR: where.OR }, searchCondition]
        delete where.OR
      } else {
        Object.assign(where, searchCondition)
      }
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

    const deniedManage = await assertCanManageNews(session.user.id, session.user.role)
    if (deniedManage) return deniedManage

    const data = await request.json()

    if (!data.title?.trim()) {
      return NextResponse.json({ error: 'El título es obligatorio' }, { status: 400 })
    }

    const isSuperAdmin =
      (
        await prisma.users.findUnique({
          where: { id: session.user.id },
          select: { isSuperAdmin: true },
        })
      )?.isSuperAdmin === true
    const visScope = await getContentVisibilityScope(
      session.user.id,
      session.user.role,
      isSuperAdmin
    )
    const sanitized = await sanitizeVisibilityPayload(visScope, {
      roles: data.roles,
      familyIds: data.familyIds,
      departmentIds: data.departmentIds,
      userIds: data.userIds,
    })
    if (sanitized instanceof NextResponse) return sanitized

    // Validar enums — si llegan valores inválidos Prisma lanza error 500
    const validTypes = [
      'NEWS',
      'ANNOUNCEMENT',
      'EVENT',
      'BIRTHDAY',
      'HOLIDAY',
      'ALERT',
      'INTERNAL_AD',
      'RECOGNITION',
    ]
    const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
    const validStatuses = ['DRAFT', 'PUBLISHED', 'ARCHIVED']

    const type = validTypes.includes(data.type) ? data.type : 'NEWS'
    const priority = validPriorities.includes(data.priority) ? data.priority : 'MEDIUM'
    const newsStatus = validStatuses.includes(data.status) ? data.status : 'DRAFT'

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
        content: data.content || null,
        summary: data.summary || null,
        imageUrl: data.imageUrl || null,
        type,
        priority,
        status: newsStatus,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        isFeatured: data.isFeatured || false,
        allowComments: data.allowComments || false,
        allowReactions: data.allowReactions !== false,
        createdById: session.user.id,
        news_roles: {
          create: sanitized.roles.map(role => ({ role })),
        },
        news_users: {
          create: sanitized.userIds.map(userId => ({ userId })),
        },
        news_departments: {
          create: sanitized.departmentIds.map(departmentId => ({ departmentId })),
        },
        news_families: {
          create: sanitized.familyIds.map(familyId => ({ familyId })),
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

    await AuditServiceComplete.log({
      action:
        newsStatus === 'PUBLISHED'
          ? AuditActionsComplete.NEWS_PUBLISHED
          : AuditActionsComplete.NEWS_CREATED,
      entityType: 'news',
      entityId: news.id,
      userId: session.user.id,
      newValues: {
        title: data.title,
        type,
        status: newsStatus,
        priority,
        ...buildVisibilityAuditSummary(sanitized),
      },
      details: { source: 'news_module', publishedOnCreate: newsStatus === 'PUBLISHED' },
      request,
    })

    // Notificar solo a destinatarios de la visibilidad (no a todos los SSE conectados)
    if (newsStatus === 'PUBLISHED') {
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
            newsType: type,
          })
        }

        const priorityLabel = priority === 'URGENT' ? '🚨 ' : priority === 'HIGH' ? '⚠️ ' : ''

        await Promise.allSettled(
          targetUsers.map(u =>
            NotificationService.push({
              userId: u.id,
              type:
                priority === 'URGENT' || priority === 'HIGH'
                  ? NotificationType.WARNING
                  : NotificationType.INFO,
              title: `${priorityLabel}Nueva noticia publicada`,
              message: `${data.title}`,
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
    console.error('Error creando noticia:', error)
    const message = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ error: 'Error al crear noticia', detail: message }, { status: 500 })
  }
}
