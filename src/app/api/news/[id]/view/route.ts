/**
 * API: User - Mark News as Viewed
 * POST /api/news/[id]/view
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

    const news = await prisma.news.findUnique({
      where: { id: id },
    })

    if (!news) {
      return NextResponse.json({ error: 'Noticia no encontrada' }, { status: 404 })
    }

    const existingView = await prisma.news_views.findUnique({
      where: {
        newsId_userId: {
          newsId: id,
          userId: session.user.id,
        },
      },
    })

    if (!existingView) {
      await prisma.news_views.create({
        data: {
          newsId: id,
          userId: session.user.id,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error marcando noticia como vista:', error)
    return NextResponse.json({ error: 'Error al marcar noticia como vista' }, { status: 500 })
  }
}
