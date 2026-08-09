import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { FileService } from '@/lib/services/file-service'
import { prisma } from '@/lib/prisma'
import { assertCanManageNews, assertCanModifyNews } from '@/lib/news/news-manage-access'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const deniedManage = await assertCanManageNews(session.user.id, session.user.role)
    if (deniedManage) return deniedManage

    const { id: newsId } = await params

    const deniedModify = await assertCanModifyNews(newsId, session.user.id, session.user.role)
    if (deniedModify) return deniedModify

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó ningún archivo' }, { status: 400 })
    }

    const attachment = await FileService.uploadNewsFile({
      file,
      newsId,
      uploadedBy: session.user.id,
    })

    return NextResponse.json(attachment, { status: 201 })
  } catch (error) {
    console.error('[news-attachments] Error al subir archivo:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const deniedManage = await assertCanManageNews(session.user.id, session.user.role)
    if (deniedManage) return deniedManage

    const { id: newsId } = await params

    const deniedModify = await assertCanModifyNews(newsId, session.user.id, session.user.role)
    if (deniedModify) return deniedModify

    const attachments = await FileService.getFilesByNews(newsId)
    return NextResponse.json(attachments)
  } catch (error) {
    console.error('[news-attachments] Error al obtener archivos:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
