/**
 * Registro de módulos para backups parciales (JSON/Prisma).
 * Añade nuevas entradas aquí cuando un módulo esté listo para respaldo independiente.
 */

import prisma from '@/lib/prisma'

export type BackupModuleId =
  | 'tickets'
  | 'news'
  | 'patrols'
  | 'families'
  | 'audits'
  | 'configurations'

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
  news: {
    id: 'news',
    label: 'Noticias y Comunicados',
    description:
      'Noticias, comunicados, reacciones, comentarios, visualizaciones, roles de visibilidad, usuarios asignados y adjuntos del módulo de noticias.',
  },
  patrols: {
    id: 'patrols',
    label: 'Rondas y Patrullajes',
    description:
      'Rondas, rutas, checkpoints, programaciones, ejecuciones, incidentes, fotos, reportes y configuraciones del módulo de rondas y patrullajes.',
  },
  families: {
    id: 'families',
    label: 'Familias',
    description: 'Familias del sistema y sus configuraciones.',
  },

  audits: {
    id: 'audits',
    label: 'Auditorías',
    description: 'Registros de auditoría del sistema.',
  },
  configurations: {
    id: 'configurations',
    label: 'Configuraciones del Sistema',
    description: 'Configuraciones generales del sistema (system_settings, site_config, etc.).',
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

/** Orden de inserción respetando FKs del módulo news. */
export const NEWS_MODULE_RESTORE_ORDER = [
  'news',
  'news_roles',
  'news_users',
  'news_departments',
  'news_views',
  'news_reactions',
  'news_comments',
  'news_attachments',
] as const

export type NewsModuleTable = (typeof NEWS_MODULE_RESTORE_ORDER)[number]

const EMPTY_NEWS_PAYLOAD: Record<NewsModuleTable, unknown[]> = {
  news: [],
  news_roles: [],
  news_users: [],
  news_departments: [],
  news_views: [],
  news_reactions: [],
  news_comments: [],
  news_attachments: [],
}

/**
 * Exporta solo datos del módulo news (JSON). */
export async function exportNewsModuleData(): Promise<Record<NewsModuleTable, unknown[]>> {
  const news = await prisma.news.findMany()
  const newsIds = news.map(n => n.id)

  if (newsIds.length === 0) {
    return { ...EMPTY_NEWS_PAYLOAD }
  }

  const [
    news_roles,
    news_users,
    news_departments,
    news_views,
    news_reactions,
    news_comments,
    news_attachments,
  ] = await Promise.all([
    prisma.news_roles.findMany({ where: { newsId: { in: newsIds } } }),
    prisma.news_users.findMany({ where: { newsId: { in: newsIds } } }),
    prisma.news_departments.findMany({ where: { newsId: { in: newsIds } } }),
    prisma.news_views.findMany({ where: { newsId: { in: newsIds } } }),
    prisma.news_reactions.findMany({ where: { newsId: { in: newsIds } } }),
    prisma.news_comments.findMany({ where: { newsId: { in: newsIds } } }),
    prisma.news_attachments.findMany({ where: { newsId: { in: newsIds } } }),
  ])

  return {
    news: news as unknown[],
    news_roles: news_roles as unknown[],
    news_users: news_users as unknown[],
    news_departments: news_departments as unknown[],
    news_views: news_views as unknown[],
    news_reactions: news_reactions as unknown[],
    news_comments: news_comments as unknown[],
    news_attachments: news_attachments as unknown[],
  } as Record<NewsModuleTable, unknown[]>
}

/** Orden de inserción respetando FKs del módulo patrols. */
export const PATROLS_MODULE_RESTORE_ORDER = [
  'patrol_family_config',
  'patrol_family_assignments',
  'patrol_checkpoints',
  'patrol_routes',
  'patrol_route_checkpoints',
  'patrol_schedules',
  'patrols',
  'patrol_check_ins',
  'patrol_photos',
] as const

export type PatrolsModuleTable = (typeof PATROLS_MODULE_RESTORE_ORDER)[number]

const EMPTY_PATROLS_PAYLOAD: Record<PatrolsModuleTable, unknown[]> = {
  patrol_family_config: [],
  patrol_family_assignments: [],
  patrol_checkpoints: [],
  patrol_routes: [],
  patrol_route_checkpoints: [],
  patrol_schedules: [],
  patrols: [],
  patrol_check_ins: [],
  patrol_photos: [],
}

/**
 * Exporta solo datos del módulo patrols (JSON). */
export async function exportPatrolsModuleData(): Promise<Record<PatrolsModuleTable, unknown[]>> {
  const [
    patrol_family_config,
    patrol_family_assignments,
    patrol_checkpoints,
    patrol_routes,
    patrol_schedules,
    patrols,
  ] = await Promise.all([
    prisma.patrol_family_config.findMany(),
    prisma.patrol_family_assignments.findMany(),
    prisma.patrol_checkpoints.findMany(),
    prisma.patrol_routes.findMany(),
    prisma.patrol_schedules.findMany(),
    prisma.patrols.findMany(),
  ])

  const routeIds = patrol_routes.map(r => r.id)
  const scheduleIds = patrol_schedules.map(s => s.id)
  const patrolIds = patrols.map(p => p.id)

  const [patrol_route_checkpoints, patrol_check_ins, patrol_photos] = await Promise.all([
    routeIds.length > 0
      ? prisma.patrol_route_checkpoints.findMany({ where: { routeId: { in: routeIds } } })
      : [],
    patrolIds.length > 0
      ? prisma.patrol_check_ins.findMany({ where: { patrolId: { in: patrolIds } } })
      : [],
    patrolIds.length > 0
      ? prisma.patrol_photos.findMany({ where: { patrolId: { in: patrolIds } } })
      : [],
  ])

  return {
    patrol_family_config,
    patrol_family_assignments,
    patrol_checkpoints,
    patrol_routes,
    patrol_route_checkpoints,
    patrol_schedules,
    patrols,
    patrol_check_ins,
    patrol_photos,
  } as Record<PatrolsModuleTable, unknown[]>
}

/** Orden de inserción respetando FKs del módulo families. */
export const FAMILIES_MODULE_RESTORE_ORDER = ['families', 'departments'] as const

export type FamiliesModuleTable = (typeof FAMILIES_MODULE_RESTORE_ORDER)[number]

const EMPTY_FAMILIES_PAYLOAD: Record<FamiliesModuleTable, unknown[]> = {
  families: [],
  departments: [],
}

export async function exportFamiliesModuleData(): Promise<Record<FamiliesModuleTable, unknown[]>> {
  const families = await prisma.families.findMany()
  const departments = await prisma.departments.findMany()
  return {
    families: families as unknown[],
    departments: departments as unknown[],
  }
}

/** Orden de inserción respetando FKs del módulo audits. */
export const AUDITS_MODULE_RESTORE_ORDER = ['audit_logs'] as const

export type AuditsModuleTable = (typeof AUDITS_MODULE_RESTORE_ORDER)[number]

const EMPTY_AUDITS_PAYLOAD: Record<AuditsModuleTable, unknown[]> = {
  audit_logs: [],
}

export async function exportAuditsModuleData(): Promise<Record<AuditsModuleTable, unknown[]>> {
  const audit_logs = await prisma.audit_logs.findMany()
  return { audit_logs: audit_logs as unknown[] }
}

/** Orden de inserción respetando FKs del módulo configurations. */
export const CONFIGURATIONS_MODULE_RESTORE_ORDER = [
  'system_settings',
  'system_modules',
  'site_config',
  'pages',
  'oauth_configs',
] as const

export type ConfigurationsModuleTable = (typeof CONFIGURATIONS_MODULE_RESTORE_ORDER)[number]

const EMPTY_CONFIGURATIONS_PAYLOAD: Record<ConfigurationsModuleTable, unknown[]> = {
  system_settings: [],
  system_modules: [],
  site_config: [],
  pages: [],
  oauth_configs: [],
}

export async function exportConfigurationsModuleData(): Promise<
  Record<ConfigurationsModuleTable, unknown[]>
> {
  const [system_settings, system_modules, site_config, pages, oauth_configs] = await Promise.all([
    prisma.system_settings.findMany(),
    prisma.system_modules.findMany(),
    prisma.site_config.findMany(),
    prisma.pages.findMany(),
    prisma.oauth_configs.findMany(),
  ])

  return {
    system_settings: system_settings as unknown[],
    system_modules: system_modules as unknown[],
    site_config: site_config as unknown[],
    pages: pages as unknown[],
    oauth_configs: oauth_configs as unknown[],
  }
}
