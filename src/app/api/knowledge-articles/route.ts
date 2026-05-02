import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * GET /api/knowledge-articles
 * Filtra artículos por familia según el rol del usuario:
 * - ADMIN: sin filtro de familia
 * - TECHNICIAN: solo familias asignadas en technician_family_assignments
 * - CLIENT: solo familias de los departamentos de sus tickets
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const categoryId = searchParams.get('categoryId') || undefined
    const familyId = searchParams.get('familyId') || undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: any = { isPublished: true }

    // Búsqueda de texto — se guarda aparte para combinar con AND si hay filtro de familia
    const textSearchCondition = search
      ? [
          { title: { contains: search, mode: 'insensitive' } },
          { content: { contains: search, mode: 'insensitive' } },
          { summary: { contains: search, mode: 'insensitive' } },
        ]
      : null

    if (categoryId) {
      where.categoryId = categoryId
    }

    // Filtro de familia según rol
    const role = session.user.role

    if (role === 'TECHNICIAN') {
      // Solo artículos de familias asignadas al técnico
      const assignments = await prisma.technician_family_assignments.findMany({
        where: { technicianId: session.user.id, isActive: true },
        select: { familyId: true },
      })
      const assignedFamilyIds = assignments.map(a => a.familyId)

      if (assignedFamilyIds.length > 0) {
        const effectiveIds = familyId
          ? assignedFamilyIds.filter(id => id === familyId)
          : assignedFamilyIds
        // Artículos de sus familias O sin familia (legado), combinado con búsqueda si existe
        const familyCondition = [{ familyId: { in: effectiveIds } }, { familyId: null }]
        where.AND = [
          { OR: familyCondition },
          ...(textSearchCondition ? [{ OR: textSearchCondition }] : []),
        ]
      } else if (textSearchCondition) {
        where.OR = textSearchCondition
      }
    } else if (role === 'CLIENT') {
      // SECURITY: usar client_family_assignments, no inferir desde tickets
      const [userDept, clientAssignments] = await Promise.all([
        prisma.users.findUnique({
          where: { id: session.user.id },
          select: { departments: { select: { familyId: true } } },
        }),
        prisma.client_family_assignments.findMany({
          where: { clientId: session.user.id, isActive: true },
          select: { familyId: true },
        }),
      ])
      const allowedIds = new Set<string>(clientAssignments.map(a => a.familyId))
      if (userDept?.departments?.familyId) allowedIds.add(userDept.departments.familyId)

      if (allowedIds.size > 0) {
        const effectiveIds = familyId
          ? Array.from(allowedIds).filter(id => id === familyId)
          : Array.from(allowedIds)
        const familyCondition = [{ familyId: { in: effectiveIds } }, { familyId: null }]
        where.AND = [
          { OR: familyCondition },
          ...(textSearchCondition ? [{ OR: textSearchCondition }] : []),
        ]
      } else {
        // Sin asignaciones: no ve ningún artículo
        where.familyId = { in: [] }
      }
    } else if (role === 'ADMIN') {
      if (familyId) where.familyId = familyId
      if (textSearchCondition) where.OR = textSearchCondition
    } else {
      if (textSearchCondition) where.OR = textSearchCondition
    }

    const [articles, total] = await Promise.all([
      prisma.knowledge_articles.findMany({
        where,
        include: {
          category: {
            select: { id: true, name: true, color: true },
          },
          author: {
            select: { id: true, name: true, email: true, avatar: true },
          },
          family: {
            select: { id: true, name: true, code: true, color: true },
          },
          _count: { select: { votes: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.knowledge_articles.count({ where }),
    ])

    const articlesWithStats = articles.map(article => ({
      ...article,
      helpfulPercentage:
        article.helpfulVotes + article.notHelpfulVotes > 0
          ? Math.round(
              (article.helpfulVotes / (article.helpfulVotes + article.notHelpfulVotes)) * 100
            )
          : 0,
    }))

    return NextResponse.json({
      success: true,
      data: articlesWithStats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error al obtener artículos de conocimiento:', error)
    return NextResponse.json({ error: 'Error al obtener artículos' }, { status: 500 })
  }
}
