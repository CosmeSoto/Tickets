import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'

// Schema de validación para votar
const voteSchema = z.object({
  isHelpful: z.boolean(),
})

// POST /api/knowledge/[id]/vote - Votar artículo
export async function POST(
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

    const { id: articleId } = await params

    // Verificar que el artículo existe
    const article = await prisma.knowledge_articles.findUnique({
      where: { id: articleId },
    })

    if (!article) {
      return NextResponse.json(
        { error: 'Artículo no encontrado' },
        { status: 404 }
      )
    }

    const body = await request.json()
    
    // Validar datos
    const validationResult = voteSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const { isHelpful } = validationResult.data

    // Verificar si el usuario ya votó
    const existingVote = await prisma.article_votes.findUnique({
      where: {
        articleId_userId: {
          articleId,
          userId: session.user.id,
        },
      },
    })

    let vote
    let oldVote: boolean | null = null

    if (existingVote) {
      // Si el voto es el mismo, no hacer nada
      if (existingVote.isHelpful === isHelpful) {
        return NextResponse.json({
          message: 'Ya has votado de esta manera',
          vote: existingVote,
        })
      }

      // Actualizar voto existente
      oldVote = existingVote.isHelpful
      vote = await prisma.article_votes.update({
        where: {
          articleId_userId: {
            articleId,
            userId: session.user.id,
          },
        },
        data: {
          isHelpful,
        },
      })

      // Actualizar contadores del artículo
      if (oldVote && !isHelpful) {
        // Cambió de útil a no útil
        await prisma.knowledge_articles.update({
          where: { id: articleId },
          data: {
            helpfulVotes: { decrement: 1 },
            notHelpfulVotes: { increment: 1 },
          },
        })
      } else if (!oldVote && isHelpful) {
        // Cambió de no útil a útil
        await prisma.knowledge_articles.update({
          where: { id: articleId },
          data: {
            helpfulVotes: { increment: 1 },
            notHelpfulVotes: { decrement: 1 },
          },
        })
      }
    } else {
      // Crear nuevo voto
      vote = await prisma.article_votes.create({
        data: {
          articleId,
          userId: session.user.id,
          isHelpful,
        },
      })

      // Actualizar contadores del artículo
      await prisma.knowledge_articles.update({
        where: { id: articleId },
        data: {
          helpfulVotes: isHelpful ? { increment: 1 } : undefined,
          notHelpfulVotes: !isHelpful ? { increment: 1 } : undefined,
        },
      })
    }

    // Obtener artículo actualizado con estadísticas
    const updatedArticle = await prisma.knowledge_articles.findUnique({
      where: { id: articleId },
      select: {
        id: true,
        helpfulVotes: true,
        notHelpfulVotes: true,
      },
    })

    const helpfulPercentage = updatedArticle && updatedArticle.helpfulVotes + updatedArticle.notHelpfulVotes > 0
      ? Math.round((updatedArticle.helpfulVotes / (updatedArticle.helpfulVotes + updatedArticle.notHelpfulVotes)) * 100)
      : 0

    return NextResponse.json({
      message: existingVote ? 'Voto actualizado' : 'Voto registrado',
      vote,
      article: {
        ...updatedArticle,
        helpfulPercentage,
      },
    })
  } catch (error) {
    console.error('Error al votar artículo:', error)
    return NextResponse.json(
      { error: 'Error al votar artículo' },
      { status: 500 }
    )
  }
}

// DELETE /api/knowledge/[id]/vote - Eliminar voto
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

    const { id: articleId } = await params

    // Verificar que el voto existe
    const existingVote = await prisma.article_votes.findUnique({
      where: {
        articleId_userId: {
          articleId,
          userId: session.user.id,
        },
      },
    })

    if (!existingVote) {
      return NextResponse.json(
        { error: 'No has votado este artículo' },
        { status: 404 }
      )
    }

    // Eliminar voto
    await prisma.article_votes.delete({
      where: {
        articleId_userId: {
          articleId,
          userId: session.user.id,
        },
      },
    })

    // Actualizar contadores del artículo
    await prisma.knowledge_articles.update({
      where: { id: articleId },
      data: {
        helpfulVotes: existingVote.isHelpful ? { decrement: 1 } : undefined,
        notHelpfulVotes: !existingVote.isHelpful ? { decrement: 1 } : undefined,
      },
    })

    return NextResponse.json({ message: 'Voto eliminado exitosamente' })
  } catch (error) {
    console.error('Error al eliminar voto:', error)
    return NextResponse.json(
      { error: 'Error al eliminar voto' },
      { status: 500 }
    )
  }
}
