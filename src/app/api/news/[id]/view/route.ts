/**
 * API: User - Mark News as Viewed
 * POST /api/news/[id]/view
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

    const denied = await assertCanViewNews(id, session.user.id)
    if (denied) return denied

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
