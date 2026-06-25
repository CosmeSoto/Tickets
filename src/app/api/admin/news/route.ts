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
      select: { newsEnabled: true, isSuperAdmin: true, role: true, canManageNews: true },
    })

    if (!dbUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const isSuperAdmin = dbUser.isSuperAdmin === true
    const isAdmin = dbUser.role === 'ADMIN'
    // Puede acceder al panel admin de noticias: ADMIN, o cualquier usuario con canManageNews
    const hasNewsAccess = isAdmin || dbUser.canManageNews === true

    if (!hasNewsAccess) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const search = searchParams.get('search')

    const where: any = {}

    // Super Admin ve todo
    // Admin normal y usuarios con newsEnabled: ven las que crearon + las que les llegaron
    if (!isSuperAdmin) {
      const userDept = await prisma.users.findUnique({
        where: { id: session.user.id },
        select: { departmentId: true, departments: { select: { familyId: true } } },
      })
      const userDeptId = userDept?.departmentId
      const userFamilyId = userDept?.departments?.familyId

      const visibilityConditions: any[] = [
        // Noticias que creó
        { createdById: session.user.id },
        // Sin restricciones (visibles para todos)
        {
          news_roles: { none: {} },
          news_users: { none: {} },
          news_departments: { none: {} },
          news_families: { none: {} },
        },
        // Asignado por rol
        { news_roles: { some: { role: dbUser.role } } },
        // Asignado directamente
        { news_users: { some: { userId: session.user.id } } },
      ]
      if (userDeptId) {
        visibilityConditions.push({ news_departments: { some: { departmentId: userDeptId } } })
      }
      if (userFamilyId) {
        visibilityConditions.push({ news_families: { some: { familyId: userFamilyId } } })
      }

      where.OR = visibilityConditions
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

    const isSuperAdmin = (session.user as any).isSuperAdmin === true
    if (session.user.role !== 'ADMIN' && !isSuperAdmin) {
      // Permitir acceso a usuarios con canManageNews
      const userHasNewsAccess = await prisma.users.findUnique({
        where: { id: session.user.id },
        select: { canManageNews: true },
      })
      if (!userHasNewsAccess?.canManageNews) {
        return NextResponse.json(
          { error: 'No tienes permisos para gestionar noticias' },
          { status: 403 }
        )
      }
    }

    const data = await request.json()

    if (!data.title?.trim()) {
      return NextResponse.json({ error: 'El título es obligatorio' }, { status: 400 })
    }

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

    await AuditServiceComplete.log({
      action: AuditActionsComplete.NEWS_CREATED,
      entityType: 'news',
      entityId: news.id,
      userId: session.user.id,
      newValues: { title: data.title, type, status: newsStatus, priority },
      request,
    })

    // Notificar en tiempo real si se publica directamente (especialmente ALERT/URGENT)
    if (newsStatus === 'PUBLISHED') {
      try {
        const { NotificationEvents } = await import('@/lib/notification-events')
        // Notificar a usuarios con sesión activa que hay nueva noticia
        const activeUserIds = NotificationEvents.getConnectedUserIds?.() ?? []
        if (activeUserIds.length > 0) {
          NotificationEvents.emitToMany(activeUserIds, {
            type: 'news_published',
            newsId: news.id,
            newsType: type,
          })
        }

        // Crear notificaciones persistentes para usuarios con el módulo de noticias habilitado
        const { NotificationService } = await import('@/lib/services/notification-service')
        const { NotificationType } = await import('@prisma/client')
        const {
          getNewsNotificationLink,
          getNewsNotificationRecipientIds,
        } = await import('@/lib/news/news-access')

        const targetUsers = await getNewsNotificationRecipientIds(news.id, session.user.id)

        const priorityLabel =
          priority === 'URGENT' ? '🚨 ' : priority === 'HIGH' ? '⚠️ ' : ''

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
