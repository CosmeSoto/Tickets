/**
 * API: User - Comment on News
 * POST /api/news/[id]/comment
 * DELETE /api/news/[id]/comment/[commentId]
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assertCanViewNews } from '@/lib/news/news-access'

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

    const denied = await assertCanViewNews(id, session.user.id)
    if (denied) return denied

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
      // El padre debe pertenecer a ESTA noticia — antes solo se verificaba
      // que el comentario existiera en cualquier parte, así que se podía
      // colgar una respuesta en el hilo de OTRA noticia (con allowComments
      // desactivado, o sin acceso a esa noticia). También se limita a un
      // solo nivel de respuestas: GET /api/news/[id] solo incluye un nivel
      // de `replies`, así que una respuesta a una respuesta quedaría
      // invisible en el hilo pero seguiría contando en _count.news_comments.
      const parentComment = await prisma.news_comments.findFirst({
        where: { id: parentId, newsId: id, isHidden: false },
        select: { id: true, parentId: true },
      })
      if (!parentComment) {
        return NextResponse.json(
          { error: 'El comentario al que respondes no existe en esta noticia' },
          { status: 404 }
        )
      }
      if (parentComment.parentId) {
        return NextResponse.json(
          { error: 'Solo se permite un nivel de respuestas' },
          { status: 400 }
        )
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
