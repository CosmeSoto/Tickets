/**
 * GET /api/admin/news/[id]/attachments/[attachmentId]/file
 * Sirve el archivo adjunto de una noticia (gestores con acceso).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assertCanViewNews } from '@/lib/news/news-access'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return new NextResponse('No autorizado', { status: 401 })
    }

    const { id: newsId, attachmentId } = await params

    const denied = await assertCanViewNews(newsId, session.user.id, { allowAdminBypass: true })
    if (denied) {
      const status = denied.status
      return new NextResponse(status === 404 ? 'Noticia no encontrada' : 'No autorizado', { status })
    }

    const attachment = await prisma.news_attachments.findUnique({
      where: { id: attachmentId },
    })

    if (!attachment || attachment.newsId !== newsId) {
      return new NextResponse('Archivo no encontrado', { status: 404 })
    }

    if (!existsSync(attachment.path)) {
      return new NextResponse('Archivo no disponible', { status: 404 })
    }

    const fileBuffer = await readFile(attachment.path)

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Disposition': `inline; filename="${attachment.originalName}"`,
        'Cache-Control': 'private, max-age=86400',
      },
    })
  } catch (error) {
    console.error('[news-attachment-file] Error:', error)
    return new NextResponse('Error al servir archivo', { status: 500 })
  }
}
