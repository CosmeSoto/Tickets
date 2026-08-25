/**
 * API: User - News Feed
 * GET /api/news
 *
 * Devuelve noticias publicadas visibles para el usuario actual.
 * Resiliente: nunca devuelve 500 — si algo falla, devuelve array vacío.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  buildNewsVisibilityConditions,
  getNewsViewer,
  hasNewsModuleAccess,
} from '@/lib/news/news-access'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ news: [] })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const period = searchParams.get('period')

    const user = await getNewsViewer(session.user.id)

    if (!user || !hasNewsModuleAccess(user)) {
      return NextResponse.json({ news: [] })
    }

    // ── Construir filtro WHERE ────────────────────────────────────────────────
    // Siempre filtrar por rango de fechas: solo mostrar noticias cuyo período esté activo
    const now = new Date()
    const andConditions: any[] = [
      // endDate: no ha vencido
      { OR: [{ endDate: null }, { endDate: { gte: now } }] },
      // startDate: ya comenzó (o no tiene fecha de inicio)
      { OR: [{ startDate: null }, { startDate: { lte: now } }] },
    ]

    if (period === 'today') {
      const endOfDay = new Date()
      endOfDay.setHours(23, 59, 59, 999)
      const startOfDay = new Date(now)
      startOfDay.setHours(0, 0, 0, 0)
      andConditions.push({ createdAt: { gte: startOfDay } })
    } else if (period === 'week') {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      andConditions.push({ createdAt: { gte: weekAgo } })
    } else if (period === 'month') {
      const monthAgo = new Date()
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      andConditions.push({ createdAt: { gte: monthAgo } })
    }

    // Filtro de visibilidad: la noticia es visible si:
    // - No tiene restricciones (ningún rol, usuario, departamento, familia asignado)
    // - O el usuario cumple alguna de las restricciones
    const visibilityConditions = buildNewsVisibilityConditions(user)

    andConditions.push({ OR: visibilityConditions })

    const where: any = {
      status: 'PUBLISHED',
      AND: andConditions,
    }

    if (type) {
      where.type = type
    }

    // ── Query ─────────────────────────────────────────────────────────────────
    const news = await prisma.news.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        news_roles: true,
        news_users: true,
        news_departments: true,
        news_attachments: true,
        news_views: {
          where: { userId: user.id },
          select: { id: true },
        },
        news_reactions: {
          where: { userId: user.id },
          select: { id: true, reaction: true },
        },
        _count: {
          select: { news_views: true, news_reactions: true, news_comments: true },
        },
      },
      orderBy: [{ isFeatured: 'desc' }, { priority: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({ news })
  } catch (error) {
    // Nunca devolver 500 — el feed de noticias no debe romper la página
    console.error('[/api/news] Error:', error)
    return NextResponse.json({ news: [] })
  }
}
