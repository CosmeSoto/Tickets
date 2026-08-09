import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { FileService } from '@/lib/services/file-service'
import { prisma } from '@/lib/prisma'
import { assertCanManageNews, assertCanModifyNews } from '@/lib/news/news-manage-access'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const deniedManage = await assertCanManageNews(session.user.id, session.user.role)
    if (deniedManage) return deniedManage

    const { id: newsId, attachmentId } = await params

    const deniedModify = await assertCanModifyNews(newsId, session.user.id, session.user.role)
    if (deniedModify) return deniedModify

    const attachment = await prisma.news_attachments.findFirst({
      where: { id: attachmentId, newsId },
      select: { id: true },
    })
    if (!attachment) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
    }

    await FileService.deleteNewsFile(attachmentId, session.user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[news-attachments] Error al eliminar archivo:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
