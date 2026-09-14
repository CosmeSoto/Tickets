import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  assertCanAccessKnowledgeArticle,
  KnowledgeAccessError,
} from '@/lib/knowledge/article-access'
import { shouldCountArticleView } from '@/lib/knowledge/view-dedup'

/**
 * POST /api/knowledge-articles/[id]/view
 *
 * Incrementa el contador de vistas de un artículo.
 *
 * Usado por el modal de artículos sugeridos al crear ticket
 * (ArticleViewerModal.tsx) — a diferencia de GET /api/knowledge/[id] (la
 * vista completa del artículo), esta ruta NO validaba scope de familia
 * antes de incrementar (cualquier usuario autenticado podía inflar el
 * contador de cualquier artículo por id) ni deduplicaba (cada llamada
 * sumaba una vista, reabriendo el mismo problema que ya se corrigió del
 * otro lado). Ambos puntos ahora replican el mismo criterio que
 * GET /api/knowledge/[id], compartiendo el dedup en memoria.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params

    const article = await prisma.knowledge_articles.findUnique({
      where: { id },
      select: { id: true, authorId: true, familyId: true, isPublished: true },
    })

    if (!article) {
      return NextResponse.json({ success: false, error: 'Artículo no encontrado' }, { status: 404 })
    }

    const user = {
      id: session.user.id,
      role: session.user.role,
      isSuperAdmin: (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true,
    }

    try {
      await assertCanAccessKnowledgeArticle(user, article)
    } catch (err) {
      if (err instanceof KnowledgeAccessError) {
        return NextResponse.json({ success: false, error: err.message }, { status: err.statusCode })
      }
      throw err
    }

    const isOwnArticle = article.authorId === session.user.id
    const countsAsNewView = !isOwnArticle && shouldCountArticleView(session.user.id, id)

    if (countsAsNewView) {
      await prisma.knowledge_articles.update({
        where: { id },
        data: {
          views: {
            increment: 1,
          },
        },
      })
    }

    return NextResponse.json({
      success: true,
      counted: countsAsNewView,
    })
  } catch (error) {
    console.error('Error incrementing article views:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error al registrar vista',
      },
      { status: 500 }
    )
  }
}
