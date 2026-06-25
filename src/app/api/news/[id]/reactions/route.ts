/**
 * GET /api/news/[id]/reactions
 * Devuelve todas las reacciones de una noticia con info del usuario
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assertCanViewNews } from '@/lib/news/news-access'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const denied = await assertCanViewNews(id, session.user.id, { allowAdminBypass: true })
    if (denied) return denied

    const reactions = await prisma.news_reactions.findMany({
      where: { newsId: id },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ reactions })
  } catch (error) {
    console.error('[/api/news/reactions] Error:', error)
    return NextResponse.json({ reactions: [] })
  }
}
