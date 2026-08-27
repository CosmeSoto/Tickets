import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import {
  assertCanAccessKnowledgeArticle,
  buildArticleSourceContext,
  filterArticleContentForClient,
  KnowledgeAccessError,
  rewriteTicketAttachmentLinks,
} from '@/lib/knowledge/article-access'

// ── Dedup de vistas ───────────────────────────────────────────────────────
// GET incrementa `views`, pero este endpoint se llama en cada recarga en
// segundo plano (refetch de sesión de NextAuth, pestañas duplicadas, ida y
// vuelta con el botón atrás, etc.) — sin esto, cada recarga silenciosa suma
// una vista aunque el usuario "solo abrió el artículo una vez". Se cuenta
// como máximo una vista por usuario+artículo cada 30 minutos, sin importar
// cuántas veces se dispare el GET en ese lapso.
const VIEW_DEDUP_WINDOW_MS = 30 * 60 * 1000
const recentArticleViews = new Map<string, number>() // `${userId}:${articleId}` -> timestamp

function shouldCountView(userId: string, articleId: string): boolean {
  const key = `${userId}:${articleId}`
  const now = Date.now()
  const last = recentArticleViews.get(key)
  if (last && now - last < VIEW_DEDUP_WINDOW_MS) return false
  recentArticleViews.set(key, now)
  return true
}

// Limpieza periódica para no acumular memoria indefinidamente
if (typeof setInterval !== 'undefined') {
  setInterval(
    () => {
      const now = Date.now()
      for (const [key, ts] of recentArticleViews.entries()) {
        if (now - ts > VIEW_DEDUP_WINDOW_MS) recentArticleViews.delete(key)
      }
    },
    10 * 60 * 1000
  )
}

// Schema de validación para actualizar artículo
const updateArticleSchema = z.object({
  title: z.string().min(10).max(200).optional(),
  content: z.string().min(50).optional(),
  summary: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  tags: z.array(z.string().min(2).max(30)).max(10).optional(),
  isPublished: z.boolean().optional(),
})

// GET /api/knowledge/[id] - Ver artículo (incrementa views)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const user = {
      id: session.user.id,
      role: session.user.role,
      isSuperAdmin: (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true,
    }

    // Obtener artículo
    const article = await prisma.knowledge_articles.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        family: {
          select: {
            id: true,
            name: true,
            code: true,
            color: true,
          },
        },
        sourceTicket: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        votes: {
          where: {
            userId: session.user.id,
          },
          select: {
            isHelpful: true,
          },
        },
        _count: {
          select: {
            votes: true,
          },
        },
      },
    })

    if (!article) {
      return NextResponse.json({ error: 'Artículo no encontrado' }, { status: 404 })
    }

    try {
      await assertCanAccessKnowledgeArticle(user, article)
    } catch (err) {
      if (err instanceof KnowledgeAccessError) {
        return NextResponse.json({ error: err.message }, { status: err.statusCode })
      }
      throw err
    }

    // Incrementar contador de vistas — excepto cuando el autor ve su propio
    // artículo (p. ej. mientras lo edita o revisa) o cuando este mismo usuario
    // ya generó una vista de este artículo en los últimos 30 minutos.
    const isOwnArticle = article.authorId === session.user.id
    const countsAsNewView = !isOwnArticle && shouldCountView(session.user.id, id)
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

    // Calcular estadísticas
    const helpfulPercentage =
      article.helpfulVotes + article.notHelpfulVotes > 0
        ? Math.round(
            (article.helpfulVotes / (article.helpfulVotes + article.notHelpfulVotes)) * 100
          )
        : 0

    // Obtener voto del usuario actual
    const userVote = article.votes.length > 0 ? article.votes[0].isHelpful : null

    // Contexto del ticket origen (filtrado por rol)
    let sourceContext = null
    if (article.sourceTicketId) {
      sourceContext = await buildArticleSourceContext(article.id, article.sourceTicketId, user)
    }

    // Contenido: reescribir adjuntos al proxy del KB.
    // Métricas/calificación salen del markdown (van en sourceContext para staff).
    let content = article.content
    if (article.sourceTicketId) {
      content = rewriteTicketAttachmentLinks(content, article.id, article.sourceTicketId)
    }
    content = filterArticleContentForClient(content)

    return NextResponse.json({
      ...article,
      content,
      views: countsAsNewView ? article.views + 1 : article.views,
      helpfulPercentage,
      userVote,
      sourceContext,
    })
  } catch (error) {
    console.error('Error al obtener artículo:', error)
    return NextResponse.json({ error: 'Error al obtener artículo' }, { status: 500 })
  }
}

// PUT /api/knowledge/[id] - Actualizar artículo
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params

    // Obtener artículo actual
    const existingArticle = await prisma.knowledge_articles.findUnique({
      where: { id },
    })

    if (!existingArticle) {
      return NextResponse.json({ error: 'Artículo no encontrado' }, { status: 404 })
    }

    // Verificar permisos: solo el autor o ADMIN pueden editar
    const isAuthor = existingArticle.authorId === session.user.id
    const isAdmin = session.user.role === UserRole.ADMIN

    if (!isAuthor && !isAdmin) {
      return NextResponse.json(
        { error: 'No tienes permisos para editar este artículo' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Validar datos
    const validationResult = updateArticleSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Si se actualiza la categoría, verificar que existe
    if (data.categoryId) {
      const category = await prisma.categories.findUnique({
        where: { id: data.categoryId },
      })

      if (!category) {
        return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })
      }
    }

    // Actualizar artículo
    const updatedArticle = await prisma.knowledge_articles.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        sourceTicket: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    })

    // Registrar en auditoría
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        userId: session.user.id,
        action: 'UPDATE',
        entityType: 'knowledge_article',
        entityId: id,
        details: {
          changes: data,
        },
      },
    })

    return NextResponse.json(updatedArticle)
  } catch (error) {
    console.error('Error al actualizar artículo:', error)
    return NextResponse.json({ error: 'Error al actualizar artículo' }, { status: 500 })
  }
}

// DELETE /api/knowledge/[id] - Eliminar artículo
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params

    // Obtener artículo actual
    const existingArticle = await prisma.knowledge_articles.findUnique({
      where: { id },
    })

    if (!existingArticle) {
      return NextResponse.json({ error: 'Artículo no encontrado' }, { status: 404 })
    }

    // Verificar permisos: solo el autor o ADMIN pueden eliminar
    const isAuthor = existingArticle.authorId === session.user.id
    const isAdmin = session.user.role === UserRole.ADMIN

    if (!isAuthor && !isAdmin) {
      return NextResponse.json(
        { error: 'No tienes permisos para eliminar este artículo' },
        { status: 403 }
      )
    }

    // Eliminar votos primero (por la relación)
    await prisma.article_votes.deleteMany({
      where: { articleId: id },
    })

    // Eliminar artículo
    await prisma.knowledge_articles.delete({
      where: { id },
    })

    // Registrar en auditoría
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        userId: session.user.id,
        action: 'DELETE',
        entityType: 'knowledge_article',
        entityId: id,
        details: {
          title: existingArticle.title,
        },
      },
    })

    return NextResponse.json({ message: 'Artículo eliminado exitosamente' })
  } catch (error) {
    console.error('Error al eliminar artículo:', error)
    return NextResponse.json({ error: 'Error al eliminar artículo' }, { status: 500 })
  }
}
