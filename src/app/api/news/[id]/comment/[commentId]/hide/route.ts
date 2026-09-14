/**
 * PATCH /api/news/[id]/comment/[commentId]/hide
 * Oculta o muestra un comentario. Mismo criterio que editar/borrar la
 * noticia (assertCanModifyNews): autoría, o gestor dentro de su alcance.
 * Antes chequeaba `isSuperAdmin || isOwner` a mano, sin importar si el
 * autor de la noticia todavía tenía el módulo habilitado.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assertCanModifyNews } from '@/lib/news/news-manage-access'

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

    const denied = await assertCanModifyNews(newsId, session.user.id)
    if (denied) return denied

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
