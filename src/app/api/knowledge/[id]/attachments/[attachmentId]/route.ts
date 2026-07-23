import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { FileService } from '@/lib/services/file-service'
import prisma from '@/lib/prisma'
import {
  assertCanAccessKnowledgeArticle,
  KnowledgeAccessError,
} from '@/lib/knowledge/article-access'

/**
 * GET /api/knowledge/[id]/attachments/[attachmentId]
 * Sirve un adjunto del ticket origen si el usuario tiene acceso al artículo (familia).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id: articleId, attachmentId } = await params
    const { searchParams } = new URL(request.url)
    const isPreview = searchParams.get('preview') === 'true'

    const article = await prisma.knowledge_articles.findUnique({
      where: { id: articleId },
      select: {
        id: true,
        familyId: true,
        isPublished: true,
        authorId: true,
        sourceTicketId: true,
      },
    })

    if (!article || !article.sourceTicketId) {
      return NextResponse.json({ error: 'Artículo no encontrado' }, { status: 404 })
    }

    try {
      await assertCanAccessKnowledgeArticle(
        {
          id: session.user.id,
          role: session.user.role,
          isSuperAdmin: (session.user as { isSuperAdmin?: boolean }).isSuperAdmin,
        },
        article
      )
    } catch (err) {
      if (err instanceof KnowledgeAccessError) {
        return NextResponse.json({ error: err.message }, { status: err.statusCode })
      }
      throw err
    }

    const attachment = await prisma.attachments.findFirst({
      where: {
        id: attachmentId,
        ticketId: article.sourceTicketId,
      },
    })

    if (!attachment) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
    }

    const fileData = await FileService.getFile(attachmentId)
    if (!fileData) {
      return NextResponse.json(
        { error: 'Archivo no encontrado en el almacenamiento' },
        { status: 404 }
      )
    }

    const disposition = isPreview ? 'inline' : 'attachment'

    return new NextResponse(fileData.buffer, {
      headers: {
        'Content-Type': attachment.mimeType || 'application/octet-stream',
        'Content-Disposition': `${disposition}; filename="${encodeURIComponent(attachment.originalName)}"`,
        'Content-Length': attachment.size.toString(),
      },
    })
  } catch (error) {
    console.error('[knowledge-attachment] Error:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
