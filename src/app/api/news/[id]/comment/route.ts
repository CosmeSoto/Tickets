/**
 * API: User - Comment on News
 * POST /api/news/[id]/comment
 * DELETE /api/news/[id]/comment/[commentId]
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const data = await request.json()
    const { content, parentId } = data

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'El contenido del comentario es requerido' },
        { status: 400 }
      )
    }

    const news = await prisma.news.findUnique({
      where: { id: id },
      select: { allowComments: true },
    })

    if (!news) {
      return NextResponse.json({ error: 'Noticia no encontrada' }, { status: 404 })
    }

    if (!news.allowComments) {
      return NextResponse.json(
        { error: 'Comentarios no permitidos en esta noticia' },
        { status: 403 }
      )
    }

    if (parentId) {
      const parentComment = await prisma.news_comments.findUnique({
        where: { id: parentId },
      })
      if (!parentComment) {
        return NextResponse.json({ error: 'Comentario padre no encontrado' }, { status: 404 })
      }
    }

    const comment = await prisma.news_comments.create({
      data: {
        newsId: id,
        userId: session.user.id,
        content: content.trim(),
        parentId: parentId || null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    })

    return NextResponse.json(comment)
  } catch (error) {
    console.error('Error agregando comentario:', error)
    return NextResponse.json({ error: 'Error al agregar comentario' }, { status: 500 })
  }
}
