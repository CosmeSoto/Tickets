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

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ news: [] })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const period = searchParams.get('period')

    // Obtener usuario desde DB
    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        role: true,
        departmentId: true,
        newsEnabled: true,
        departments: { select: { familyId: true } },
      },
    })

    // Si el usuario no existe, devolver vacío
    if (!user) {
      return NextResponse.json({ news: [] })
    }

    // ── Construir filtro WHERE ────────────────────────────────────────────────
    const andConditions: any[] = [{ OR: [{ endDate: null }, { endDate: { gte: new Date() } }] }]

    if (period === 'today') {
      const endOfDay = new Date()
      endOfDay.setHours(23, 59, 59, 999)
      andConditions.push({ OR: [{ startDate: null }, { startDate: { lte: endOfDay } }] })
    } else if (period === 'week' || period === 'month') {
      andConditions.push({ OR: [{ startDate: null }, { startDate: { lte: new Date() } }] })
    }

    // Filtro de visibilidad: la noticia es visible si:
    // - No tiene restricciones (ningún rol, usuario, departamento, familia asignado)
    // - O el usuario cumple alguna de las restricciones
    const userFamilyId = user.departments?.familyId
    const visibilityConditions: any[] = [
      // Sin restricciones = visible para todos
      {
        news_roles: { none: {} },
        news_users: { none: {} },
        news_departments: { none: {} },
        news_families: { none: {} },
      },
      // Restricción por rol
      { news_roles: { some: { role: user.role } } },
      // Restricción por usuario específico
      { news_users: { some: { userId: user.id } } },
    ]

    if (user.departmentId) {
      visibilityConditions.push({ news_departments: { some: { departmentId: user.departmentId } } })
    }
    if (userFamilyId) {
      visibilityConditions.push({ news_families: { some: { familyId: userFamilyId } } })
    }

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
