/**
 * API: User - React to News
 * POST /api/news/[id]/react
 * DELETE /api/news/[id]/react
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
    const { reaction } = data

    const validReactions = ['👍', '❤️', '🎉', '😮', '😢', '👏']
    if (!validReactions.includes(reaction)) {
      return NextResponse.json({ error: 'Reacción no válida' }, { status: 400 })
    }

    const news = await prisma.news.findUnique({
      where: { id: id },
      select: { allowReactions: true },
    })

    if (!news) {
      return NextResponse.json({ error: 'Noticia no encontrada' }, { status: 404 })
    }

    if (!news.allowReactions) {
      return NextResponse.json(
        { error: 'Reacciones no permitidas en esta noticia' },
        { status: 403 }
      )
    }

    const existingReaction = await prisma.news_reactions.findUnique({
      where: {
        newsId_userId: {
          newsId: id,
          userId: session.user.id,
        },
      },
    })

    if (existingReaction) {
      if (existingReaction.reaction === reaction) {
        await prisma.news_reactions.delete({
          where: { id: existingReaction.id },
        })
        return NextResponse.json({ success: true, reaction: null })
      } else {
        await prisma.news_reactions.update({
          where: { id: existingReaction.id },
          data: { reaction },
        })
        return NextResponse.json({ success: true, reaction })
      }
    } else {
      await prisma.news_reactions.create({
        data: {
          newsId: id,
          userId: session.user.id,
          reaction,
        },
      })
      return NextResponse.json({ success: true, reaction })
    }
  } catch (error) {
    console.error('Error agregando reacción:', error)
    return NextResponse.json({ error: 'Error al agregar reacción' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    await prisma.news_reactions.deleteMany({
      where: {
        newsId: id,
        userId: session.user.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error eliminando reacción:', error)
    return NextResponse.json({ error: 'Error al eliminar reacción' }, { status: 500 })
  }
}
