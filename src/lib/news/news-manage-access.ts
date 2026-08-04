/**
 * Permisos de gestión del módulo de Noticias (crear/editar/eliminar).
 *
 * - newsEnabled: puede VER noticias (según visibilidad).
 * - canManageNews: puede CREAR / editar / eliminar (alcance por rol).
 *
 * ADMIN: siempre puede gestionar.
 * TECHNICIAN / CLIENT: requieren canManageNews (+ módulo activo).
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function assertCanManageNews(
  userId: string,
  role: string
): Promise<NextResponse | null> {
  if (role === 'ADMIN') return null

  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { canManageNews: true, newsEnabled: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  if (!user.canManageNews || !user.newsEnabled) {
    return NextResponse.json(
      { error: 'No tienes permisos para gestionar noticias' },
      { status: 403 }
    )
  }

  return null
}

export async function assertCanModifyNews(
  newsId: string,
  userId: string,
  role: string
): Promise<NextResponse | null> {
  if (role === 'ADMIN') return null

  const news = await prisma.news.findUnique({
    where: { id: newsId },
    select: { createdById: true },
  })

  if (!news) {
    return NextResponse.json({ error: 'Noticia no encontrada' }, { status: 404 })
  }

  if (news.createdById !== userId) {
    return NextResponse.json(
      { error: 'Solo puedes editar o eliminar noticias que tú creaste' },
      { status: 403 }
    )
  }

  return null
}
