/**
 * Registro de módulos para backups parciales (JSON/Prisma).
 * Añade nuevas entradas aquí cuando un módulo esté listo para respaldo independiente.
 */

import prisma from '@/lib/prisma'

export type BackupModuleId = 'tickets'

export interface BackupModuleDefinition {
  id: BackupModuleId
  /** Etiqueta en UI */
  label: string
  description: string
}

export const BACKUP_MODULE_REGISTRY: Record<BackupModuleId, BackupModuleDefinition> = {
  tickets: {
    id: 'tickets',
    label: 'Tickets',
    description:
      'Tickets, comentarios, adjuntos, historial, colaboradores, calificaciones, planes de resolución, enlaces a conocimiento y notificaciones ligadas al ticket.',
  },
}

export const DEFAULT_BACKUP_CRON_SCOPE: 'full' | BackupModuleId = 'full'

export function isBackupModuleId(value: unknown): value is BackupModuleId {
  return typeof value === 'string' && value in BACKUP_MODULE_REGISTRY
}

/** Orden de inserción respetando FKs típicas del módulo tickets (sin SLA policies globales). */
export const TICKETS_MODULE_RESTORE_ORDER = [
  'tickets',
  'comments',
  'attachments',
  'ticket_history',
  'ticket_ratings',
  'ticket_collaborators',
  'resolution_plans',
  'resolution_tasks',
  'knowledge_articles',
  'article_votes',
  'ticket_knowledge_articles',
  'notifications',
] as const

export type TicketsModuleTable = (typeof TICKETS_MODULE_RESTORE_ORDER)[number]

const EMPTY_TICKETS_PAYLOAD: Record<TicketsModuleTable, unknown[]> = {
  tickets: [],
  comments: [],
  attachments: [],
  ticket_history: [],
  ticket_ratings: [],
  ticket_collaborators: [],
  resolution_plans: [],
  resolution_tasks: [],
  knowledge_articles: [],
  article_votes: [],
  ticket_knowledge_articles: [],
  notifications: [],
}

/**
 * Exporta solo datos del módulo tickets (JSON). No incluye catálogos (usuarios, categorías, etc.).
 */
export async function exportTicketsModuleData(): Promise<Record<TicketsModuleTable, unknown[]>> {
  const tickets = await prisma.tickets.findMany()
  const ticketIds = tickets.map(t => t.id)

  if (ticketIds.length === 0) {
    return { ...EMPTY_TICKETS_PAYLOAD }
  }

  const [
    comments,
    attachments,
    ticket_history,
    ticket_ratings,
    ticket_collaborators,
    resolution_plans,
    ticket_knowledge_articles,
    notifications,
  ] = await Promise.all([
    prisma.comments.findMany({ where: { ticketId: { in: ticketIds } } }),
    prisma.attachments.findMany({ where: { ticketId: { in: ticketIds } } }),
    prisma.ticket_history.findMany({ where: { ticketId: { in: ticketIds } } }),
    prisma.ticket_ratings.findMany({ where: { ticketId: { in: ticketIds } } }),
    prisma.ticket_collaborators.findMany({ where: { ticketId: { in: ticketIds } } }),
    prisma.resolution_plans.findMany({ where: { ticketId: { in: ticketIds } } }),
    prisma.ticket_knowledge_articles.findMany({ where: { ticketId: { in: ticketIds } } }),
    prisma.notifications.findMany({
      where: { ticketId: { in: ticketIds } },
    }),
  ])

  const planIds = resolution_plans.map(p => p.id)
  const resolution_tasks =
    planIds.length > 0
      ? await prisma.resolution_tasks.findMany({ where: { planId: { in: planIds } } })
      : []

  const articleIdFromLinks = new Set(ticket_knowledge_articles.map(l => l.articleId))
  const sourceLinked = await prisma.knowledge_articles.findMany({
    where: { sourceTicketId: { in: ticketIds } },
    select: { id: true },
  })
  for (const row of sourceLinked) {
    articleIdFromLinks.add(row.id)
  }

  const knowledge_articles =
    articleIdFromLinks.size > 0
      ? await prisma.knowledge_articles.findMany({
          where: { id: { in: [...articleIdFromLinks] } },
        })
      : []

  const articleIds = new Set(knowledge_articles.map(a => a.id))
  const article_votes =
    articleIds.size > 0
      ? await prisma.article_votes.findMany({
          where: { articleId: { in: [...articleIds] } },
        })
      : []

  return {
    tickets: tickets as unknown[],
    comments: comments as unknown[],
    attachments: attachments as unknown[],
    ticket_history: ticket_history as unknown[],
    ticket_ratings: ticket_ratings as unknown[],
    ticket_collaborators: ticket_collaborators as unknown[],
    resolution_plans: resolution_plans as unknown[],
    resolution_tasks: resolution_tasks as unknown[],
    knowledge_articles: knowledge_articles as unknown[],
    article_votes: article_votes as unknown[],
    ticket_knowledge_articles: ticket_knowledge_articles as unknown[],
    notifications: notifications as unknown[],
  } as Record<TicketsModuleTable, unknown[]>
}
