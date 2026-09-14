/**
 * Permisos de gestión del módulo de Noticias (crear/editar/eliminar).
 *
 * - newsEnabled: puede VER noticias (según visibilidad).
 * - canManageNews: puede CREAR / editar / eliminar (TECH/CLIENT), pero solo
 *   las que él mismo creó.
 * - ADMIN de familia: módulo ON (newsEnabled) implica gestión, pero
 *   acotada al mismo alcance de visibilidad que ya usa el GET de admin
 *   (`buildNewsVisibilityConditions`) — nunca noticias fuera de su alcance,
 *   aunque sean de otra familia o del propio Super Admin. Antes cualquier
 *   ADMIN con `newsEnabled` podía editar/borrar CUALQUIER noticia del
 *   sistema sin este chequeo.
 * - Super Admin: siempre puede gestionar.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildNewsVisibilityConditions, getNewsViewer } from '@/lib/news/news-access'

export async function assertCanManageNews(userId: string): Promise<NextResponse | null> {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { role: true, canManageNews: true, newsEnabled: true, isSuperAdmin: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  if (user.isSuperAdmin) return null

  if (user.role === 'ADMIN') {
    if (!user.newsEnabled) {
      return NextResponse.json(
        { error: 'No tienes permisos para gestionar noticias' },
        { status: 403 }
      )
    }
    return null
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
  userId: string
): Promise<NextResponse | null> {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { role: true, newsEnabled: true, isSuperAdmin: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  if (user.isSuperAdmin) return null

  const news = await prisma.news.findUnique({
    where: { id: newsId },
    select: { createdById: true },
  })

  if (!news) {
    return NextResponse.json({ error: 'Noticia no encontrada' }, { status: 404 })
  }

  // Autoría siempre alcanza, para cualquier rol.
  if (news.createdById === userId) return null

  if (user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Solo puedes editar o eliminar noticias que tú creaste' },
      { status: 403 }
    )
  }

  if (!user.newsEnabled) {
    return NextResponse.json(
      { error: 'No tienes permisos para gestionar noticias' },
      { status: 403 }
    )
  }

  // ADMIN de familia: mismo alcance de visibilidad que ya usa el GET de
  // administración de esta noticia — puede gestionar cualquier noticia
  // dentro de su alcance (no solo las suyas), pero nunca las de otra
  // familia ni las que están fuera de su scope.
  const viewer = await getNewsViewer(userId)
  if (!viewer) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }
  const inScope = await prisma.news.count({
    where: { id: newsId, OR: buildNewsVisibilityConditions(viewer) },
  })
  if (inScope === 0) {
    return NextResponse.json({ error: 'No tienes acceso a esta noticia' }, { status: 403 })
  }

  return null
}
