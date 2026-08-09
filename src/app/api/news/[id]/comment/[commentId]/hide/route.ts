/**
 * PATCH /api/news/[id]/comment/[commentId]/hide
 * Oculta o muestra un comentario. Solo el creador de la noticia o SuperAdmin.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const { id: newsId, commentId } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { isHidden } = await request.json()

    // Verificar que la noticia existe y que el usuario tiene permiso
    const news = await prisma.news.findUnique({
      where: { id: newsId },
      select: { createdById: true },
    })

    if (!news) {
      return NextResponse.json({ error: 'Noticia no encontrada' }, { status: 404 })
    }

    const dbUser = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { isSuperAdmin: true, newsEnabled: true },
    })

    const isSuperAdmin = dbUser?.isSuperAdmin === true
    const isOwner = news.createdById === session.user.id

    if (!isSuperAdmin && !isOwner) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const comment = await prisma.news_comments.findFirst({
      where: { id: commentId, newsId },
      select: { id: true },
    })
    if (!comment) {
      return NextResponse.json({ error: 'Comentario no encontrado' }, { status: 404 })
    }

    const updated = await prisma.news_comments.update({
      where: { id: commentId },
      data: { isHidden: Boolean(isHidden) },
    })

    return NextResponse.json({ comment: updated })
  } catch (error) {
    console.error('Error ocultando comentario:', error)
    return NextResponse.json({ error: 'Error al actualizar comentario' }, { status: 500 })
  }
}
