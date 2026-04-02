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

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (categoryId) {
      where.categoryId = categoryId
    }

    // Filtro de familia según rol
    const role = session.user.role

    if (familyId) {
      // Filtro explícito por familia (solo ADMIN puede usarlo sin restricción)
      if (role === 'ADMIN') {
        where.familyId = familyId
      }
    }

    if (role === 'TECHNICIAN') {
      // Solo artículos de familias asignadas al técnico
      const assignments = await prisma.technician_family_assignments.findMany({
        where: { technicianId: session.user.id, isActive: true },
        select: { familyId: true },
      })
      const assignedFamilyIds = assignments.map((a) => a.familyId)
      where.familyId = assignedFamilyIds.length > 0 ? { in: assignedFamilyIds } : undefined
    } else if (role === 'CLIENT') {
      // Solo artículos de familias de los departamentos de sus tickets
      const clientTickets = await prisma.tickets.findMany({
        where: { clientId: session.user.id, familyId: { not: null } },
        select: { familyId: true },
        distinct: ['familyId'],
      })
      const clientFamilyIds = clientTickets.map((t) => t.familyId).filter(Boolean) as string[]
      where.familyId = clientFamilyIds.length > 0 ? { in: clientFamilyIds } : undefined
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

    const articlesWithStats = articles.map((article) => ({
      ...article,
      helpfulPercentage:
        article.helpfulVotes + article.notHelpfulVotes > 0
          ? Math.round((article.helpfulVotes / (article.helpfulVotes + article.notHelpfulVotes)) * 100)
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
    return NextResponse.json(
      { error: 'Error al obtener artículos' },
      { status: 500 }
    )
  }
}
