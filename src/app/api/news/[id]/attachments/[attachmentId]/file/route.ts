/**
 * GET /api/news/[id]/attachments/[attachmentId]/file
 * Sirve el archivo adjunto de una noticia (usuarios autenticados con acceso).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { serveNewsAttachment } from '@/lib/news/serve-news-attachment'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return new NextResponse('No autorizado', { status: 401 })
    }
    const { id: newsId, attachmentId } = await params
    return await serveNewsAttachment(newsId, attachmentId, session.user.id)
  } catch (error) {
    console.error('[public-news-attachment-file] Error:', error)
    return new NextResponse('Error al servir archivo', { status: 500 })
  }
}
