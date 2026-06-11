import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { FileService } from '@/lib/services/file-service'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Permitir admin o usuarios con canManageNews (gestores de noticias)
    if (session.user.role !== 'ADMIN') {
      const user = await prisma.users.findUnique({
        where: { id: session.user.id },
        select: { canManageNews: true },
      })
      if (!user?.canManageNews) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
    }

    const { id: newsId } = await params

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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Permitir admin o usuarios con canManageNews (gestores de noticias)
    if (session.user.role !== 'ADMIN') {
      const user = await prisma.users.findUnique({
        where: { id: session.user.id },
        select: { canManageNews: true },
      })
      if (!user?.canManageNews) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
    }

    const { id: newsId } = await params

    const attachments = await FileService.getFilesByNews(newsId)
    return NextResponse.json(attachments)
  } catch (error) {
    console.error('[news-attachments] Error al obtener archivos:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
