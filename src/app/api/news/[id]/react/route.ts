/**
 * API: User - React to News
 * POST /api/news/[id]/react
 * DELETE /api/news/[id]/react
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assertCanViewNews } from '@/lib/news/news-access'
import { isPrismaUniqueViolation } from '@/lib/db/prisma-errors'

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const data = await request.json()
    const { reaction } = data

    const validReactions = ['👍', '❤️', '🎉', '😮', '😢', '👏']
    if (!validReactions.includes(reaction)) {
      return NextResponse.json({ error: 'Reacción no válida' }, { status: 400 })
    }

    const denied = await assertCanViewNews(id, session.user.id)
    if (denied) return denied

    const news = await prisma.news.findUnique({
      where: { id: id },
      select: { allowReactions: true },
    })

    if (!news) {
      return NextResponse.json({ error: 'Noticia no encontrada' }, { status: 404 })
    }

    if (!news.allowReactions) {
      return NextResponse.json(
        { error: 'Reacciones no permitidas en esta noticia' },
        { status: 403 }
      )
    }

    // El toggle-off ES el propio chequeo atómico: si el deleteMany borró
    // algo, es que ya existía exactamente esta reacción y el resultado
    // deseado ("sin reacción") ya se logró — sin el findUnique→delete de
    // antes, que dejaba una ventana entre leer y borrar.
    const removed = await prisma.news_reactions.deleteMany({
      where: { newsId: id, userId: session.user.id, reaction },
    })
    if (removed.count > 0) {
      return NextResponse.json({ success: true, reaction: null })
    }

    // No existía esa reacción concreta (puede que no hubiera ninguna, o que
    // el usuario tuviera otra distinta): upsert sobre el único compuesto
    // [newsId, userId]. Si dos upsert concurrentes chocan (P2002 — carrera
    // de dos reacciones simultáneas del mismo usuario), el resultado que
    // ambos querían (una fila con ESTA reacción) ya lo logró el otro; un
    // updateMany de rescate deja la fila con la reacción de quien llegó
    // último, en vez de propagar un 500.
    try {
      await prisma.news_reactions.upsert({
        where: { newsId_userId: { newsId: id, userId: session.user.id } },
        create: { newsId: id, userId: session.user.id, reaction },
        update: { reaction },
      })
    } catch (error) {
      if (!isPrismaUniqueViolation(error)) throw error
      await prisma.news_reactions.updateMany({
        where: { newsId: id, userId: session.user.id },
        data: { reaction },
      })
    }
    return NextResponse.json({ success: true, reaction })
  } catch (error) {
    console.error('Error agregando reacción:', error)
    return NextResponse.json({ error: 'Error al agregar reacción' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const denied = await assertCanViewNews(id, session.user.id)
    if (denied) return denied

    await prisma.news_reactions.deleteMany({
      where: {
        newsId: id,
        userId: session.user.id,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error eliminando reacción:', error)
    return NextResponse.json({ error: 'Error al eliminar reacción' }, { status: 500 })
  }
}
