/**
 * Acceso a artículos de conocimiento por familia (nativa + asignada)
 * y DTO del ticket origen filtrado por rol.
 */

import prisma from '@/lib/prisma'
import { getTicketConsumerFamilyIds } from '@/lib/auth/family-scope'
import { getAdminFamilyScope } from '@/lib/auth/admin-scope'

export class KnowledgeAccessError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 403) {
    super(message)
    this.statusCode = statusCode
  }
}

type SessionUser = {
  id: string
  role: string
  isSuperAdmin?: boolean
}

/** Familias donde el usuario puede ver artículos (nativa + asignaciones / scope admin). */
export async function getKnowledgeFamilyIds(user: SessionUser): Promise<string[] | undefined> {
  const isSuperAdmin = user.isSuperAdmin === true
  if (user.role === 'ADMIN' && isSuperAdmin) return undefined

  if (user.role === 'ADMIN') {
    const scope = await getAdminFamilyScope(user.id, false)
    return scope.familyIds ?? []
  }

  // CLIENT / TECHNICIAN: nativa + asignaciones de consumo
  const ids = await getTicketConsumerFamilyIds(user.id, user.role, false)
  return ids ?? []
}

export async function assertCanAccessKnowledgeArticle(
  user: SessionUser,
  article: { familyId: string | null; isPublished: boolean; authorId: string }
): Promise<void> {
  // Borradores: solo autor o admin
  if (!article.isPublished) {
    const isAuthor = article.authorId === user.id
    const isAdmin = user.role === 'ADMIN'
    if (!isAuthor && !isAdmin) {
      throw new KnowledgeAccessError('No tienes acceso a este artículo', 403)
    }
  }

  // Sin familia = legado visible si ya pasó publicación
  if (!article.familyId) return

  const allowed = await getKnowledgeFamilyIds(user)
  if (allowed === undefined) return // Super Admin
  if (allowed.length === 0 || !allowed.includes(article.familyId)) {
    throw new KnowledgeAccessError('No tienes acceso a artículos de esta área de soporte', 403)
  }
}

export type ArticleSourceContext = {
  ticketId: string
  title: string
  status: string
  priority: string
  categoryName: string | null
  canOpenTicket: boolean
  ticketHref: string | null
  attachments: Array<{
    id: string
    originalName: string
    mimeType: string
    size: number
    url: string
  }>
  /** Solo staff (ADMIN / TECHNICIAN) */
  rating: {
    rating: number
    feedback: string | null
    responseTime: number
    technicalSkill: number
    communication: number
    problemResolution: number
  } | null
  /**
   * Comentarios internos / solo equipo.
   * Los públicos ya van en el cuerpo del artículo (Solución aplicada).
   * Solo staff con acceso al ticket.
   */
  internalComments: Array<{
    id: string
    content: string
    createdAt: string
    authorName: string
    authorRole: string
  }>
}

function ticketHrefForRole(role: string, ticketId: string): string {
  if (role === 'ADMIN') return `/admin/tickets/${ticketId}`
  if (role === 'TECHNICIAN') return `/technician/tickets/${ticketId}`
  return `/client/tickets/${ticketId}`
}

/**
 * Construye el contexto del ticket origen según el rol.
 * Clientes: adjuntos + datos básicos (sin calificación ni notas internas).
 * Staff con acceso al ticket: calificación + notas internas del equipo.
 */
export async function buildArticleSourceContext(
  articleId: string,
  ticketId: string,
  user: SessionUser
): Promise<ArticleSourceContext | null> {
  const ticket = await prisma.tickets.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      clientId: true,
      assigneeId: true,
      familyId: true,
      categories: { select: { name: true } },
      attachments: {
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          size: true,
        },
        orderBy: { createdAt: 'asc' },
      },
      ticket_ratings: {
        select: {
          rating: true,
          feedback: true,
          responseTime: true,
          technicalSkill: true,
          communication: true,
          problemResolution: true,
        },
      },
      comments: {
        where: { isInternal: true },
        orderBy: { createdAt: 'asc' },
        take: 30,
        select: {
          id: true,
          content: true,
          createdAt: true,
          users: { select: { name: true, role: true } },
        },
      },
    },
  })

  if (!ticket) return null

  const isStaff = user.role === 'ADMIN' || user.role === 'TECHNICIAN'
  const isClientOwner = user.role === 'CLIENT' && ticket.clientId === user.id

  // ¿Puede abrir el ticket en la app?
  let canOpenTicket = false
  if (user.role === 'ADMIN' && user.isSuperAdmin) {
    canOpenTicket = true
  } else if (isClientOwner) {
    canOpenTicket = true
  } else if (isStaff) {
    try {
      const { assertTicketAccessById, toTicketAccessUser } =
        await import('@/lib/tickets/ticket-access')
      await assertTicketAccessById(toTicketAccessUser(user), ticketId, 'read')
      canOpenTicket = true
    } catch {
      canOpenTicket = false
    }
  }

  // Internos: solo staff con acceso real al ticket (no clientes)
  const canViewInternal = isStaff && canOpenTicket

  const attachments = ticket.attachments.map(a => ({
    id: a.id,
    originalName: a.originalName,
    mimeType: a.mimeType,
    size: a.size,
    // Proxy por artículo: quien tiene acceso al KB puede descargar
    url: `/api/knowledge/${articleId}/attachments/${a.id}`,
  }))

  return {
    ticketId: ticket.id,
    title: ticket.title,
    status: ticket.status,
    priority: ticket.priority,
    categoryName: ticket.categories?.name ?? null,
    canOpenTicket,
    ticketHref: canOpenTicket ? ticketHrefForRole(user.role, ticket.id) : null,
    attachments,
    rating:
      isStaff && ticket.ticket_ratings
        ? {
            rating: ticket.ticket_ratings.rating,
            feedback: ticket.ticket_ratings.feedback,
            responseTime: ticket.ticket_ratings.responseTime,
            technicalSkill: ticket.ticket_ratings.technicalSkill,
            communication: ticket.ticket_ratings.communication,
            problemResolution: ticket.ticket_ratings.problemResolution,
          }
        : null,
    internalComments: canViewInternal
      ? ticket.comments.map(c => ({
          id: c.id,
          content: c.content,
          createdAt: c.createdAt.toISOString(),
          authorName: c.users.name,
          authorRole: c.users.role,
        }))
      : [],
  }
}

/** Reescribe enlaces de adjuntos del ticket al proxy del artículo. */
export function rewriteTicketAttachmentLinks(
  content: string,
  articleId: string,
  ticketId: string
): string {
  const escaped = ticketId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return content.replace(
    new RegExp(`/api/tickets/${escaped}/attachments/([\\w-]+)`, 'g'),
    `/api/knowledge/${articleId}/attachments/$1`
  )
}

/** Quita secciones sensibles del markdown para clientes. */
export function filterArticleContentForClient(content: string): string {
  const patterns = [
    /#{2,3}\s*📊?\s*Métricas de Resolución[\s\S]*?(?=#{2,3}\s|$)/gi,
    /#{2,3}\s*⭐?\s*Calificación del Cliente[\s\S]*?(?=#{2,3}\s|$)/gi,
  ]
  let filtered = content
  for (const pattern of patterns) {
    filtered = filtered.replace(pattern, '')
  }
  return filtered.trim()
}
