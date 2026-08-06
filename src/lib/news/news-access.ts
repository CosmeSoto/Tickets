/**
 * Control de acceso y visibilidad del módulo de Noticias.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@prisma/client'

export type NewsViewer = {
  id: string
  role: UserRole
  departmentId: string | null
  familyId: string | null
  familyIds: string[]
  isSuperAdmin: boolean
  newsEnabled: boolean
  canManageNews: boolean
}

export type NewsVisibilityData = {
  status: string
  createdById: string
  startDate: Date | null
  endDate: Date | null
  news_roles: { role: UserRole }[]
  news_users: { userId: string }[]
  news_departments: { departmentId: string }[]
  news_families: { familyId: string }[]
}

const NEWS_VISIBILITY_INCLUDE = {
  news_roles: true,
  news_users: true,
  news_departments: true,
  news_families: true,
} as const

export async function getNewsViewer(userId: string): Promise<NewsViewer | null> {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      departmentId: true,
      isSuperAdmin: true,
      newsEnabled: true,
      canManageNews: true,
      departments: { select: { familyId: true } },
    },
  })

  if (!user) return null

  const nativeFamilyId = user.departments?.familyId ?? null
  let familyIds: string[] = nativeFamilyId ? [nativeFamilyId] : []

  if (!(user.role === 'ADMIN' && user.isSuperAdmin)) {
    const { resolveModuleFamilyScopeIds } = await import('@/lib/auth/user-family-access')
    familyIds = await resolveModuleFamilyScopeIds(userId, 'content', 'canView')
  }

  return {
    id: user.id,
    role: user.role,
    departmentId: user.departmentId,
    familyId: nativeFamilyId,
    familyIds,
    isSuperAdmin: user.isSuperAdmin === true,
    newsEnabled: user.newsEnabled === true,
    canManageNews: user.canManageNews === true,
  }
}

export function hasNewsModuleAccess(viewer: NewsViewer): boolean {
  return (
    viewer.isSuperAdmin || viewer.role === 'ADMIN' || viewer.newsEnabled || viewer.canManageNews
  )
}

export function buildNewsVisibilityConditions(viewer: NewsViewer) {
  const conditions: Record<string, unknown>[] = [
    {
      news_roles: { none: {} },
      news_users: { none: {} },
      news_departments: { none: {} },
      news_families: { none: {} },
    },
    { news_roles: { some: { role: viewer.role } } },
    { news_users: { some: { userId: viewer.id } } },
    { createdById: viewer.id },
  ]

  if (viewer.departmentId) {
    conditions.push({ news_departments: { some: { departmentId: viewer.departmentId } } })
  }
  if (viewer.familyIds.length > 0) {
    conditions.push({ news_families: { some: { familyId: { in: viewer.familyIds } } } })
  } else if (viewer.familyId) {
    conditions.push({ news_families: { some: { familyId: viewer.familyId } } })
  }

  return conditions
}

export function userCanAccessNews(
  news: NewsVisibilityData,
  viewer: NewsViewer,
  options?: { allowAdminBypass?: boolean; requirePublished?: boolean }
): boolean {
  const { allowAdminBypass = false, requirePublished = true } = options ?? {}

  if (viewer.isSuperAdmin || news.createdById === viewer.id) return true
  if (allowAdminBypass && viewer.role === 'ADMIN') return true

  if (requirePublished && news.status !== 'PUBLISHED') return false

  const now = new Date()
  if (news.startDate && news.startDate > now) return false
  if (news.endDate && news.endDate < now) return false

  const noRestrictions =
    news.news_roles.length === 0 &&
    news.news_users.length === 0 &&
    news.news_departments.length === 0 &&
    news.news_families.length === 0

  if (noRestrictions) return true

  return (
    news.news_roles.some(r => r.role === viewer.role) ||
    news.news_users.some(u => u.userId === viewer.id) ||
    (viewer.departmentId
      ? news.news_departments.some(d => d.departmentId === viewer.departmentId)
      : false) ||
    (viewer.familyIds.length > 0
      ? news.news_families.some(f => viewer.familyIds.includes(f.familyId))
      : viewer.familyId
        ? news.news_families.some(f => f.familyId === viewer.familyId)
        : false)
  )
}

export async function assertCanViewNews(
  newsId: string,
  userId: string,
  options?: { allowAdminBypass?: boolean; requirePublished?: boolean }
): Promise<NextResponse | null> {
  const viewer = await getNewsViewer(userId)
  if (!viewer) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  if (!hasNewsModuleAccess(viewer)) {
    return NextResponse.json({ error: 'No tienes acceso al módulo de noticias' }, { status: 403 })
  }

  const news = await prisma.news.findUnique({
    where: { id: newsId },
    include: NEWS_VISIBILITY_INCLUDE,
  })

  if (!news) {
    return NextResponse.json({ error: 'Noticia no encontrada' }, { status: 404 })
  }

  if (!userCanAccessNews(news, viewer, options)) {
    return NextResponse.json({ error: 'No tienes acceso a esta noticia' }, { status: 403 })
  }

  return null
}

export function getNewsNotificationLink(viewer: { role: string; canManageNews?: boolean }): string {
  // Gestores → panel admin; lectores → dashboard (feed embebido)
  if (viewer.role === 'ADMIN' || viewer.canManageNews) return '/admin/news'
  if (viewer.role === 'TECHNICIAN') return '/technician'
  return '/client'
}

/** Usuarios que deben recibir notificación al publicar una noticia. */
export async function getNewsNotificationRecipientIds(
  newsId: string,
  excludeUserId?: string
): Promise<Array<{ id: string; role: string; canManageNews: boolean }>> {
  const news = await prisma.news.findUnique({
    where: { id: newsId },
    include: NEWS_VISIBILITY_INCLUDE,
  })

  if (!news || news.status !== 'PUBLISHED') return []

  const moduleAccess = {
    isActive: true,
    OR: [{ newsEnabled: true }, { canManageNews: true }, { role: 'ADMIN' as const }],
  }

  const noRestrictions =
    news.news_roles.length === 0 &&
    news.news_users.length === 0 &&
    news.news_departments.length === 0 &&
    news.news_families.length === 0

  const visibilityOr: Record<string, unknown>[] = []
  if (news.news_roles.length > 0) {
    visibilityOr.push({ role: { in: news.news_roles.map(r => r.role) } })
  }
  if (news.news_users.length > 0) {
    visibilityOr.push({ id: { in: news.news_users.map(u => u.userId) } })
  }
  if (news.news_departments.length > 0) {
    visibilityOr.push({
      departmentId: { in: news.news_departments.map(d => d.departmentId) },
    })
  }
  if (news.news_families.length > 0) {
    visibilityOr.push({
      departments: { familyId: { in: news.news_families.map(f => f.familyId) } },
    })
  }

  const users = await prisma.users.findMany({
    where: {
      ...moduleAccess,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      ...(noRestrictions ? {} : { OR: visibilityOr }),
    },
    select: { id: true, role: true, canManageNews: true },
  })

  return users
}
