import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { z } from 'zod'
import { randomUUID } from 'crypto'

// Schema de validación para crear artículo
const createArticleSchema = z.object({
  title: z.string().min(10, 'El título debe tener al menos 10 caracteres').max(200, 'El título no puede exceder 200 caracteres'),
  content: z.string().min(50, 'El contenido debe tener al menos 50 caracteres'),
  summary: z.string().optional(),
  categoryId: z.string().uuid('ID de categoría inválido'),
  tags: z.array(z.string().min(2).max(30)).max(10, 'Máximo 10 tags permitidos'),
  sourceTicketId: z.string().uuid().optional(),
})

// GET /api/knowledge - Listar artículos con filtros
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const categoryId = searchParams.get('categoryId') || undefined
    const tagsParam = searchParams.get('tags')
    const tags = tagsParam ? tagsParam.split(',') : undefined
    const authorId = searchParams.get('authorId') || undefined
    const sortBy = searchParams.get('sortBy') || 'recent'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    // Construir condiciones de búsqueda
    const whereConditions: any = {
      isPublished: true,
    }

    // Búsqueda por texto
    if (search) {
      whereConditions.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Filtro por categoría
    if (categoryId) {
      whereConditions.categoryId = categoryId
    }

    // Filtro por tags
    if (tags && tags.length > 0) {
      whereConditions.tags = { hasSome: tags }
    }

    // Filtro por autor
    if (authorId) {
      whereConditions.authorId = authorId
    }

    // Determinar ordenamiento
    let orderBy: any = { createdAt: 'desc' }
    if (sortBy === 'views') {
      orderBy = { views: 'desc' }
    } else if (sortBy === 'helpful') {
      orderBy = { helpfulVotes: 'desc' }
    }

    // Obtener artículos
    const [articles, total] = await Promise.all([
      prisma.knowledge_articles.findMany({
        where: whereConditions,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          sourceTicket: {
            select: {
              id: true,
              title: true,
            },
          },
          _count: {
            select: {
              votes: true,
            },
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      prisma.knowledge_articles.count({ where: whereConditions }),
    ])

    // Calcular porcentaje de votos útiles
    const articlesWithStats = articles.map(article => ({
      ...article,
      helpfulPercentage: article.helpfulVotes + article.notHelpfulVotes > 0
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
    console.error('Error al obtener artículos:', error)
    return NextResponse.json(
      { error: 'Error al obtener artículos' },
      { status: 500 }
    )
  }
}

// POST /api/knowledge - Crear nuevo artículo
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Verificar que el usuario sea TECHNICIAN o ADMIN
    if (session.user.role !== UserRole.TECHNICIAN && session.user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: 'Solo técnicos y administradores pueden crear artículos' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Validar datos
    const validationResult = createArticleSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Verificar que la categoría existe
    const category = await prisma.categories.findUnique({
      where: { id: data.categoryId },
    })

    if (!category) {
      return NextResponse.json(
        { error: 'Categoría no encontrada' },
        { status: 404 }
      )
    }

    // Si hay sourceTicketId, verificar que el ticket existe y está resuelto
    if (data.sourceTicketId) {
      const ticket = await prisma.tickets.findUnique({
        where: { id: data.sourceTicketId },
      })

      if (!ticket) {
        return NextResponse.json(
          { error: 'Ticket no encontrado' },
          { status: 404 }
        )
      }

      if (ticket.status !== 'RESOLVED') {
        return NextResponse.json(
          { error: 'Solo se pueden crear artículos desde tickets resueltos' },
          { status: 400 }
        )
      }
    }

    // Crear artículo
    const article = await prisma.knowledge_articles.create({
      data: {
        title: data.title,
        content: data.content,
        summary: data.summary || data.content.substring(0, 200) + '...',
        categoryId: data.categoryId,
        tags: data.tags,
        sourceTicketId: data.sourceTicketId,
        authorId: session.user.id,
        isPublished: true,
        views: 0,
        helpfulVotes: 0,
        notHelpfulVotes: 0,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        sourceTicket: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    })

    // Registrar en auditoría
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        userId: session.user.id,
        action: 'CREATE',
        entityType: 'knowledge_article',
        entityId: article.id,
        details: {
          title: article.title,
          categoryId: article.categoryId,
        },
      },
    })

    return NextResponse.json(article, { status: 201 })
  } catch (error) {
    console.error('Error al crear artículo:', error)
    return NextResponse.json(
      { error: 'Error al crear artículo' },
      { status: 500 }
    )
  }
}
