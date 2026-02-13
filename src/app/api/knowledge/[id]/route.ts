import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { z } from 'zod'
import { randomUUID } from 'crypto'

// Schema de validación para actualizar artículo
const updateArticleSchema = z.object({
  title: z.string().min(10).max(200).optional(),
  content: z.string().min(50).optional(),
  summary: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  tags: z.array(z.string().min(2).max(30)).max(10).optional(),
  isPublished: z.boolean().optional(),
})

// GET /api/knowledge/[id] - Ver artículo (incrementa views)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const { id } = await params

    // Obtener artículo
    const article = await prisma.knowledge_articles.findUnique({
      where: { id },
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
            status: true,
          },
        },
        votes: {
          where: {
            userId: session.user.id,
          },
          select: {
            isHelpful: true,
          },
        },
        _count: {
          select: {
            votes: true,
          },
        },
      },
    })

    if (!article) {
      return NextResponse.json(
        { error: 'Artículo no encontrado' },
        { status: 404 }
      )
    }

    // Incrementar contador de vistas
    await prisma.knowledge_articles.update({
      where: { id },
      data: {
        views: {
          increment: 1,
        },
      },
    })

    // Calcular estadísticas
    const helpfulPercentage = article.helpfulVotes + article.notHelpfulVotes > 0
      ? Math.round((article.helpfulVotes / (article.helpfulVotes + article.notHelpfulVotes)) * 100)
      : 0

    // Obtener voto del usuario actual
    const userVote = article.votes.length > 0 ? article.votes[0].isHelpful : null

    return NextResponse.json({
      ...article,
      views: article.views + 1, // Retornar el valor actualizado
      helpfulPercentage,
      userVote,
    })
  } catch (error) {
    console.error('Error al obtener artículo:', error)
    return NextResponse.json(
      { error: 'Error al obtener artículo' },
      { status: 500 }
    )
  }
}

// PUT /api/knowledge/[id] - Actualizar artículo
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const { id } = await params

    // Obtener artículo actual
    const existingArticle = await prisma.knowledge_articles.findUnique({
      where: { id },
    })

    if (!existingArticle) {
      return NextResponse.json(
        { error: 'Artículo no encontrado' },
        { status: 404 }
      )
    }

    // Verificar permisos: solo el autor o ADMIN pueden editar
    const isAuthor = existingArticle.authorId === session.user.id
    const isAdmin = session.user.role === UserRole.ADMIN

    if (!isAuthor && !isAdmin) {
      return NextResponse.json(
        { error: 'No tienes permisos para editar este artículo' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Validar datos
    const validationResult = updateArticleSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Si se actualiza la categoría, verificar que existe
    if (data.categoryId) {
      const category = await prisma.categories.findUnique({
        where: { id: data.categoryId },
      })

      if (!category) {
        return NextResponse.json(
          { error: 'Categoría no encontrada' },
          { status: 404 }
        )
      }
    }

    // Actualizar artículo
    const updatedArticle = await prisma.knowledge_articles.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
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
        action: 'UPDATE',
        entityType: 'knowledge_article',
        entityId: id,
        details: {
          changes: data,
        },
      },
    })

    return NextResponse.json(updatedArticle)
  } catch (error) {
    console.error('Error al actualizar artículo:', error)
    return NextResponse.json(
      { error: 'Error al actualizar artículo' },
      { status: 500 }
    )
  }
}

// DELETE /api/knowledge/[id] - Eliminar artículo
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const { id } = await params

    // Obtener artículo actual
    const existingArticle = await prisma.knowledge_articles.findUnique({
      where: { id },
    })

    if (!existingArticle) {
      return NextResponse.json(
        { error: 'Artículo no encontrado' },
        { status: 404 }
      )
    }

    // Verificar permisos: solo el autor o ADMIN pueden eliminar
    const isAuthor = existingArticle.authorId === session.user.id
    const isAdmin = session.user.role === UserRole.ADMIN

    if (!isAuthor && !isAdmin) {
      return NextResponse.json(
        { error: 'No tienes permisos para eliminar este artículo' },
        { status: 403 }
      )
    }

    // Eliminar votos primero (por la relación)
    await prisma.article_votes.deleteMany({
      where: { articleId: id },
    })

    // Eliminar artículo
    await prisma.knowledge_articles.delete({
      where: { id },
    })

    // Registrar en auditoría
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        userId: session.user.id,
        action: 'DELETE',
        entityType: 'knowledge_article',
        entityId: id,
        details: {
          title: existingArticle.title,
        },
      },
    })

    return NextResponse.json({ message: 'Artículo eliminado exitosamente' })
  } catch (error) {
    console.error('Error al eliminar artículo:', error)
    return NextResponse.json(
      { error: 'Error al eliminar artículo' },
      { status: 500 }
    )
  }
}
