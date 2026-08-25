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
  | 'users'
  | 'audits'
  | 'configurations'
  | 'inventory'
  | 'credentials'
  | 'processes'
  | 'access'
  | 'forms'

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
  users: {
    id: 'users',
    label: 'Usuarios',
    description:
      'Usuarios del sistema, sus departamentos, configuraciones, preferencias de notificaciones, notificaciones en la app (todas, no solo las de tickets), asignaciones, credenciales OAuth y tokens de sesión.',
  },
  audits: {
    id: 'audits',
    label: 'Auditorías',
    description: 'Registros de auditoría del sistema.',
  },
  configurations: {
    id: 'configurations',
    label: 'Configuraciones del Sistema',
    description:
      'Configuraciones generales del sistema (system_settings, site_config, oauth, etc.) y el contenido de la página pública (hero, servicios, banners).',
  },
  inventory: {
    id: 'inventory',
    label: 'Inventario',
    description:
      'Equipos, licencias, suministros, mantenimientos, proveedores, contratos, bodegas, modelos, marcas, tipos y sus configuraciones.',
  },
  credentials: {
    id: 'credentials',
    label: 'Credenciales',
    description:
      'Bóvedas, entradas y compartidos del módulo Credenciales. Los secretos se exportan cifrados (AES-GCM / secretEncrypted); nunca en claro. Tras restaurar hace falta la misma ENCRYPTION_KEY del entorno original para poder revelar.',
  },
  processes: {
    id: 'processes',
    label: 'Procesos y Procedimientos',
    description:
      'Catálogo de procesos, versiones, diagramas, adjuntos, eventos de aprobación y evidencias de revisión externa (DPD). Los archivos en disco deben respaldarse junto con las rutas de process_attachments.',
  },
  access: {
    id: 'access',
    label: 'Accesos',
    description:
      'Personas externas, pases QR y trazabilidad de verificaciones. Los secretos QR se respaldan solo como hashes no reversibles.',
  },
  forms: {
    id: 'forms',
    label: 'Documentos',
    description:
      'Documentos descargables: categorías, formularios, visibilidad (roles/usuarios/departamentos/familias), descargas y adjuntos. Los archivos en disco (forms.fileUrl y form_attachments.path) deben respaldarse aparte.',
  },
}

export function isBackupModuleId(value: unknown): value is BackupModuleId {
  return typeof value === 'string' && value in BACKUP_MODULE_REGISTRY
}

export const DEFAULT_BACKUP_CRON_SCOPE: 'full' | BackupModuleId = 'full'

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
  'news_families',
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
  news_families: [],
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
    news_families,
    news_views,
    news_reactions,
    news_comments,
    news_attachments,
  ] = await Promise.all([
    prisma.news_roles.findMany({ where: { newsId: { in: newsIds } } }),
    prisma.news_users.findMany({ where: { newsId: { in: newsIds } } }),
    prisma.news_departments.findMany({ where: { newsId: { in: newsIds } } }),
    prisma.news_families.findMany({ where: { newsId: { in: newsIds } } }),
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
    news_families: news_families as unknown[],
    news_views: news_views as unknown[],
    news_reactions: news_reactions as unknown[],
    news_comments: news_comments as unknown[],
    news_attachments: news_attachments as unknown[],
  } as Record<NewsModuleTable, unknown[]>
}

/**
 * Orden de inserción respetando FKs del módulo patrols.
 *
 * NOTA: `patrol_incidents` (novedades reportadas por agentes) estuvo ausente de esta lista
 * y de exportPatrolsModuleData durante un tiempo — la descripción del módulo en
 * BACKUP_MODULE_REGISTRY ya prometía "incidentes" pero nunca se exportaban/restauraban,
 * así que un respaldo+restauración del módulo "Rondas y Patrullajes" perdía en silencio
 * todas las novedades (descripción, severidad, fotos, vínculo al ticket escalado). Va
 * después de `patrols` (FK patrolId) y antes de `patrol_photos` (FK incidentId opcional).
 */
export const PATROLS_MODULE_RESTORE_ORDER = [
  'patrol_family_config',
  'patrol_checkpoints',
  'patrol_routes',
  'patrol_route_checkpoints',
  'patrol_schedules',
  'patrols',
  'patrol_check_ins',
  'patrol_incidents',
  'patrol_photos',
] as const

export type PatrolsModuleTable = (typeof PATROLS_MODULE_RESTORE_ORDER)[number]

const EMPTY_PATROLS_PAYLOAD: Record<PatrolsModuleTable, unknown[]> = {
  patrol_family_config: [],
  patrol_checkpoints: [],
  patrol_routes: [],
  patrol_route_checkpoints: [],
  patrol_schedules: [],
  patrols: [],
  patrol_check_ins: [],
  patrol_incidents: [],
  patrol_photos: [],
}

/**
 * Exporta solo datos del módulo patrols (JSON). */
export async function exportPatrolsModuleData(): Promise<Record<PatrolsModuleTable, unknown[]>> {
  const [patrol_family_config, patrol_checkpoints, patrol_routes, patrol_schedules, patrols] =
    await Promise.all([
      prisma.patrol_family_config.findMany(),
      prisma.patrol_checkpoints.findMany(),
      prisma.patrol_routes.findMany(),
      prisma.patrol_schedules.findMany(),
      prisma.patrols.findMany(),
    ])

  const routeIds = patrol_routes.map(r => r.id)
  const scheduleIds = patrol_schedules.map(s => s.id)
  const patrolIds = patrols.map(p => p.id)

  const [patrol_route_checkpoints, patrol_check_ins, patrol_incidents, patrol_photos] =
    await Promise.all([
      routeIds.length > 0
        ? prisma.patrol_route_checkpoints.findMany({ where: { routeId: { in: routeIds } } })
        : [],
      patrolIds.length > 0
        ? prisma.patrol_check_ins.findMany({ where: { patrolId: { in: patrolIds } } })
        : [],
      patrolIds.length > 0
        ? prisma.patrol_incidents.findMany({ where: { patrolId: { in: patrolIds } } })
        : [],
      patrolIds.length > 0
        ? prisma.patrol_photos.findMany({ where: { patrolId: { in: patrolIds } } })
        : [],
    ])

  return {
    patrol_family_config,
    patrol_checkpoints,
    patrol_routes,
    patrol_route_checkpoints,
    patrol_schedules,
    patrols,
    patrol_check_ins,
    patrol_incidents,
    patrol_photos,
  } as Record<PatrolsModuleTable, unknown[]>
}

/** Orden de inserción respetando FKs del módulo families.
 *
 * technician_assignments FK: technicianId → users, categoryId → categories
 * Por eso va después de categories.
 */
export const FAMILIES_MODULE_RESTORE_ORDER = [
  'families',
  'departments',
  'categories',
  'technician_assignments',
] as const

export type FamiliesModuleTable = (typeof FAMILIES_MODULE_RESTORE_ORDER)[number]

const EMPTY_FAMILIES_PAYLOAD: Record<FamiliesModuleTable, unknown[]> = {
  families: [],
  departments: [],
  categories: [],
  technician_assignments: [],
}

export async function exportFamiliesModuleData(): Promise<Record<FamiliesModuleTable, unknown[]>> {
  const [families, departments, categories] = await Promise.all([
    prisma.families.findMany(),
    prisma.departments.findMany(),
    prisma.categories.findMany(),
  ])

  // Exportar las asignaciones de técnicos a categorías.
  // Sin esto, al restaurar el módulo families las categorías quedan sin técnicos
  // y la auto-asignación de tickets no funciona.
  const categoryIds = categories.map(c => c.id)
  const technician_assignments =
    categoryIds.length > 0
      ? await prisma.technician_assignments.findMany({
          where: { categoryId: { in: categoryIds } },
        })
      : []

  return {
    families: families as unknown[],
    departments: departments as unknown[],
    categories: categories as unknown[],
    technician_assignments: technician_assignments as unknown[],
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

/**
 * Orden de inserción respetando FKs del módulo configurations.
 *
 * NOTA: `landing_page_content`, `landing_page_services` y `landing_page_banners` (la página
 * pública: hero, servicios, banners) estuvieron ausentes de esta lista y de
 * exportConfigurationsModuleData durante un tiempo — un respaldo/restauración parcial de
 * "Configuraciones del Sistema" (JSON o selectivo desde .dump) perdía en silencio todo el
 * contenido del landing page público; solo un respaldo completo (dump entero o pgBackRest)
 * lo capturaba. Ninguna de las tres tiene FKs hacia otras tablas, así que el orden entre
 * ellas y el resto del módulo es indiferente.
 */
export const CONFIGURATIONS_MODULE_RESTORE_ORDER = [
  'system_settings',
  'system_modules',
  'site_config',
  'pages',
  'oauth_configs',
  'landing_page_content',
  'landing_page_services',
  'landing_page_banners',
] as const

export type ConfigurationsModuleTable = (typeof CONFIGURATIONS_MODULE_RESTORE_ORDER)[number]

const EMPTY_CONFIGURATIONS_PAYLOAD: Record<ConfigurationsModuleTable, unknown[]> = {
  system_settings: [],
  system_modules: [],
  site_config: [],
  pages: [],
  oauth_configs: [],
  landing_page_content: [],
  landing_page_services: [],
  landing_page_banners: [],
}

export async function exportConfigurationsModuleData(): Promise<
  Record<ConfigurationsModuleTable, unknown[]>
> {
  const [
    system_settings,
    system_modules,
    site_config,
    pages,
    oauth_configs,
    landing_page_content,
    landing_page_services,
    landing_page_banners,
  ] = await Promise.all([
    prisma.system_settings.findMany(),
    prisma.system_modules.findMany(),
    prisma.site_config.findMany(),
    prisma.pages.findMany(),
    prisma.oauth_configs.findMany(),
    prisma.landing_page_content.findMany(),
    prisma.landing_page_services.findMany(),
    prisma.landing_page_banners.findMany(),
  ])

  return {
    system_settings: system_settings as unknown[],
    system_modules: system_modules as unknown[],
    site_config: site_config as unknown[],
    pages: pages as unknown[],
    oauth_configs: oauth_configs as unknown[],
    landing_page_content: landing_page_content as unknown[],
    landing_page_services: landing_page_services as unknown[],
    landing_page_banners: landing_page_banners as unknown[],
  }
}

/** Orden de inserción respetando FKs del módulo usuarios. */
export const USERS_MODULE_RESTORE_ORDER = [
  'departments',
  'users',
  'user_settings',
  'notification_preferences',
  'notification_mutes',
  'notifications',
  'accounts',
  'sessions',
  'oauth_accounts',
  'password_reset_tokens',
  'verification_tokens',
  'technician_assignments',
  'user_family_access',
] as const

export type UsersModuleTable = (typeof USERS_MODULE_RESTORE_ORDER)[number]

const EMPTY_USERS_PAYLOAD: Record<UsersModuleTable, unknown[]> = {
  departments: [],
  users: [],
  user_settings: [],
  notification_preferences: [],
  notification_mutes: [],
  notifications: [],
  accounts: [],
  sessions: [],
  oauth_accounts: [],
  password_reset_tokens: [],
  verification_tokens: [],
  technician_assignments: [],
  user_family_access: [],
}

export async function exportUsersModuleData(): Promise<Record<UsersModuleTable, unknown[]>> {
  const users = await prisma.users.findMany()

  if (users.length === 0) {
    return { ...EMPTY_USERS_PAYLOAD }
  }

  const userIds = users.map(u => u.id)

  // Obtener los IDs de departamentos referenciados por los usuarios
  const departmentIds = [
    ...new Set(users.map((u: any) => u.departmentId).filter(Boolean) as string[]),
  ]

  const [
    departments,
    user_settings,
    notification_preferences,
    notification_mutes,
    notifications,
    accounts,
    sessions,
    oauth_accounts,
    password_reset_tokens,
    verification_tokens,
    technician_assignments,
    user_family_access,
  ] = await Promise.all([
    departmentIds.length > 0
      ? prisma.departments.findMany({ where: { id: { in: departmentIds } } })
      : prisma.departments.findMany(), // si no hay FKs explícitas, exportar todos
    prisma.user_settings.findMany({ where: { userId: { in: userIds } } }),
    prisma.notification_preferences.findMany({ where: { userId: { in: userIds } } }),
    prisma.notification_mutes.findMany({ where: { userId: { in: userIds } } }),
    // Todas las notificaciones del usuario, no solo las ligadas a tickets (el módulo
    // tickets solo exporta notifications con ticketId — noticias, documentos, rondas,
    // inventario y asignaciones de familia generan notificaciones con ticketId null que
    // antes no quedaban en ningún respaldo de módulo).
    prisma.notifications.findMany({ where: { userId: { in: userIds } } }),
    prisma.accounts.findMany({ where: { userId: { in: userIds } } }),
    prisma.sessions.findMany({ where: { userId: { in: userIds } } }),
    prisma.oauth_accounts.findMany({ where: { userId: { in: userIds } } }),
    prisma.password_reset_tokens.findMany({ where: { userId: { in: userIds } } }),
    prisma.verification_tokens.findMany(),
    prisma.technician_assignments.findMany({ where: { technicianId: { in: userIds } } }),
    typeof (prisma as any).user_family_access?.findMany === 'function'
      ? (prisma as any).user_family_access.findMany({ where: { userId: { in: userIds } } })
      : Promise.resolve([]),
  ])

  return {
    departments: departments as unknown[],
    users: users as unknown[],
    user_settings: user_settings as unknown[],
    notification_preferences: notification_preferences as unknown[],
    notification_mutes: notification_mutes as unknown[],
    notifications: notifications as unknown[],
    accounts: accounts as unknown[],
    sessions: sessions as unknown[],
    oauth_accounts: oauth_accounts as unknown[],
    password_reset_tokens: password_reset_tokens as unknown[],
    verification_tokens: verification_tokens as unknown[],
    technician_assignments: technician_assignments as unknown[],
    user_family_access: user_family_access as unknown[],
  }
}

// ── Módulo Inventario ─────────────────────────────────────────────────────────

/** Orden de inserción respetando FKs del módulo inventario. */
export const INVENTORY_MODULE_RESTORE_ORDER = [
  'inventory_family_config',
  'supplier_types',
  'suppliers',
  'units_of_measure',
  'equipment_types',
  'equipment_type_attributes',
  'consumable_types',
  'consumable_type_attributes',
  'license_types',
  'license_type_attributes',
  'equipment_models',
  'equipment_brands',
  'equipment_code_counters',
  'warehouses',
  'equipment',
  'equipment_custom_values',
  'equipment_attachments',
  'equipment_assignments',
  'equipment_sales',
  'equipment_batches',
  'equipment_invoices',
  'contract_service_types',
  'contracts',
  'contract_lines',
  'contract_attachments',
  'contract_payments',
  'contract_assignments',
  'contract_return_acts',
  'contract_amendments',
  'maintenance_records',
  'delivery_acts',
  'return_acts',
  'decommission_requests',
  'decommission_acts',
  'decommission_attachments',
  'software_licenses',
  'license_attachments',
  'consumables',
  'stock_movements',
  'asset_requests',
  'asset_request_sla_metrics',
  'inventory_saved_reports',
  'inventory_scheduled_reports',
] as const

export type InventoryModuleTable = (typeof INVENTORY_MODULE_RESTORE_ORDER)[number]

/**
 * Exporta datos del módulo inventario (JSON).
 * Incluye: equipos, licencias, consumibles, mantenimientos, proveedores, contratos, bodegas, etc.
 */
export async function exportInventoryModuleData(): Promise<Record<string, unknown[]>> {
  const data: Record<string, unknown[]> = {}

  const fetchTable = async (name: string, fetcher: () => Promise<any[]>) => {
    try {
      data[name] = await fetcher()
    } catch {
      data[name] = []
    }
  }

  // Config por área (paridad con patrol_family_config)
  await fetchTable('inventory_family_config', () => prisma.inventory_family_config.findMany())

  // Catálogos
  await fetchTable('supplier_types', () => prisma.supplier_types.findMany())
  await fetchTable('contract_service_types', () =>
    (prisma as any).contract_service_types.findMany()
  )
  // findMany sin select: incluye campos comerciales (crédito, banco, plazos).
  // Decimal → string para JSON de módulo estable en restore.
  await fetchTable('suppliers', async () => {
    const rows = await prisma.suppliers.findMany()
    return rows.map(s => ({
      ...s,
      creditLimit: s.creditLimit != null ? s.creditLimit.toString() : null,
    }))
  })
  await fetchTable('units_of_measure', () => prisma.units_of_measure.findMany())
  await fetchTable('equipment_types', () => prisma.equipment_types.findMany())
  await fetchTable('equipment_type_attributes', () => prisma.equipment_type_attributes.findMany())
  await fetchTable('consumable_types', () => prisma.consumable_types.findMany())
  await fetchTable('consumable_type_attributes', () => prisma.consumable_type_attributes.findMany())
  await fetchTable('license_types', () => prisma.license_types.findMany())
  await fetchTable('license_type_attributes', () => prisma.license_type_attributes.findMany())
  await fetchTable('equipment_models', () => prisma.equipment_models.findMany())
  await fetchTable('equipment_brands', () => prisma.equipment_brands.findMany())
  await fetchTable('equipment_code_counters', () => prisma.equipment_code_counters.findMany())
  await fetchTable('warehouses', () => prisma.warehouses.findMany())

  // Activos
  await fetchTable('equipment', () => prisma.equipment.findMany())
  await fetchTable('equipment_custom_values', () => prisma.equipment_custom_values.findMany())
  await fetchTable('equipment_attachments', () => prisma.equipment_attachments.findMany())
  await fetchTable('equipment_assignments', () => prisma.equipment_assignments.findMany())
  await fetchTable('equipment_sales', () => prisma.equipment_sales.findMany())
  await fetchTable('equipment_batches', () => prisma.equipment_batches.findMany())
  await fetchTable('equipment_invoices', () => prisma.equipment_invoices.findMany())

  // Contratos (antes de maintenance_records por FK contract_id)
  await fetchTable('contracts', () => prisma.contracts.findMany())
  await fetchTable('contract_lines', () => prisma.contract_lines.findMany())
  await fetchTable('contract_attachments', () => prisma.contract_attachments.findMany())
  await fetchTable('contract_payments', () => prisma.contract_payments.findMany())
  await fetchTable('contract_assignments', () => (prisma as any).contract_assignments.findMany())
  await fetchTable('contract_return_acts', () => prisma.contract_return_acts.findMany())
  await fetchTable('contract_amendments', () => (prisma as any).contract_amendments.findMany())

  await fetchTable('maintenance_records', () => prisma.maintenance_records.findMany())
  await fetchTable('delivery_acts', () => prisma.delivery_acts.findMany())
  await fetchTable('return_acts', () => prisma.return_acts.findMany())
  await fetchTable('decommission_requests', () => prisma.decommission_requests.findMany())
  await fetchTable('decommission_acts', () => prisma.decommission_acts.findMany())
  await fetchTable('decommission_attachments', () => prisma.decommission_attachments.findMany())
  await fetchTable('software_licenses', () => prisma.software_licenses.findMany())
  await fetchTable('license_attachments', () => prisma.license_attachments.findMany())
  await fetchTable('consumables', () => prisma.consumables.findMany())
  await fetchTable('stock_movements', () => prisma.stock_movements.findMany())

  // Lotes ya exportados arriba; solicitudes
  await fetchTable('asset_requests', () => prisma.asset_requests.findMany())
  await fetchTable('asset_request_sla_metrics', () => prisma.asset_request_sla_metrics.findMany())

  // Reportes guardados/programados del usuario (config, no datos derivados)
  await fetchTable('inventory_saved_reports', () => prisma.inventory_saved_reports.findMany())
  await fetchTable('inventory_scheduled_reports', () =>
    prisma.inventory_scheduled_reports.findMany()
  )

  return data
}

/**
 * Orden FK: bóvedas → entradas → shares.
 *
 * Seguridad: `secretEncrypted` ya es ciphertext AES-GCM. El respaldo (pgBackRest,
 * .dump o JSON de módulo) NO contiene contraseñas en texto plano. Quien descargue
 * el archivo aún necesita ENCRYPTION_KEY del entorno para descifrar al revelar.
 * Soft-delete sobrescribe el ciphertext; no reexportes secretos borrados como útiles.
 */
export const CREDENTIALS_MODULE_RESTORE_ORDER = [
  'credential_vaults',
  'credential_entries',
  'credential_shares',
] as const

export type CredentialsModuleTable = (typeof CREDENTIALS_MODULE_RESTORE_ORDER)[number]

export async function exportCredentialsModuleData(): Promise<
  Record<CredentialsModuleTable, unknown[]>
> {
  // Incluye secretEncrypted cifrado; no se descifra ni se transforma a plaintext.
  const [credential_vaults, credential_entries, credential_shares] = await Promise.all([
    prisma.credential_vaults.findMany(),
    prisma.credential_entries.findMany(),
    prisma.credential_shares.findMany(),
  ])

  return {
    credential_vaults,
    credential_entries,
    credential_shares,
  }
}

/** Orden FK: proceso → versión → diagramas/revisiones/eventos/adjuntos. */
export const PROCESSES_MODULE_RESTORE_ORDER = [
  'processes',
  'process_versions',
  'process_diagrams',
  'process_attachments',
  'process_approval_events',
  'process_external_reviews',
] as const

export type ProcessesModuleTable = (typeof PROCESSES_MODULE_RESTORE_ORDER)[number]

export async function exportProcessesModuleData(): Promise<
  Record<ProcessesModuleTable, unknown[]>
> {
  const processes = await (prisma as any).processes.findMany()
  const processIds = processes.map((row: { id: string }) => row.id)
  if (processIds.length === 0) {
    return {
      processes: [],
      process_versions: [],
      process_diagrams: [],
      process_attachments: [],
      process_approval_events: [],
      process_external_reviews: [],
    }
  }

  const [process_versions, process_attachments, process_approval_events] = await Promise.all([
    (prisma as any).process_versions.findMany({ where: { processId: { in: processIds } } }),
    (prisma as any).process_attachments.findMany({ where: { processId: { in: processIds } } }),
    (prisma as any).process_approval_events.findMany({ where: { processId: { in: processIds } } }),
  ])
  const versionIds = process_versions.map((row: { id: string }) => row.id)
  const [process_diagrams, process_external_reviews] = await Promise.all([
    versionIds.length
      ? (prisma as any).process_diagrams.findMany({ where: { versionId: { in: versionIds } } })
      : Promise.resolve([]),
    versionIds.length
      ? (prisma as any).process_external_reviews.findMany({
          where: { versionId: { in: versionIds } },
        })
      : Promise.resolve([]),
  ])

  return {
    processes,
    process_versions,
    process_diagrams,
    process_attachments,
    process_approval_events,
    process_external_reviews,
  }
}

/** Orden FK: organizaciones → sujeto → pase → eventos de verificación. */
export const ACCESS_MODULE_RESTORE_ORDER = [
  'access_organizations',
  'access_subjects',
  'access_passes',
  'access_scan_events',
] as const

export type AccessModuleTable = (typeof ACCESS_MODULE_RESTORE_ORDER)[number]

export async function exportAccessModuleData(): Promise<Record<AccessModuleTable, unknown[]>> {
  const [access_organizations, access_subjects, access_passes, access_scan_events] =
    await Promise.all([
      (prisma as any).access_organizations.findMany(),
      (prisma as any).access_subjects.findMany(),
      (prisma as any).access_passes.findMany(),
      (prisma as any).access_scan_events.findMany(),
    ])
  return { access_organizations, access_subjects, access_passes, access_scan_events }
}

/**
 * Orden de inserción respetando FKs del módulo forms (Documentos).
 *
 * NOTA: este módulo no existía en BackupModuleId ni en BACKUP_MODULE_REGISTRY — no había forma
 * de respaldarlo/restaurarlo de forma independiente (ni JSON de módulo ni restauración selectiva
 * desde .dump). Solo un .dump completo o pgBackRest capturaban estas 8 tablas, de forma
 * implícita. `form_categories` va primero (FK desde `forms`); el resto cuelga de `forms`.
 */
export const FORMS_MODULE_RESTORE_ORDER = [
  'form_categories',
  'forms',
  'form_roles',
  'form_users',
  'form_departments',
  'form_families',
  'form_downloads',
  'form_attachments',
] as const

export type FormsModuleTable = (typeof FORMS_MODULE_RESTORE_ORDER)[number]

const EMPTY_FORMS_PAYLOAD: Record<FormsModuleTable, unknown[]> = {
  form_categories: [],
  forms: [],
  form_roles: [],
  form_users: [],
  form_departments: [],
  form_families: [],
  form_downloads: [],
  form_attachments: [],
}

/**
 * Exporta solo datos del módulo forms/Documentos (JSON).
 * Los archivos en disco (forms.fileUrl y form_attachments.path) deben respaldarse aparte.
 */
export async function exportFormsModuleData(): Promise<Record<FormsModuleTable, unknown[]>> {
  const form_categories = await prisma.form_categories.findMany()
  const forms = await prisma.forms.findMany()
  const formIds = forms.map(f => f.id)

  if (formIds.length === 0) {
    return { ...EMPTY_FORMS_PAYLOAD, form_categories: form_categories as unknown[] }
  }

  const [
    form_roles,
    form_users,
    form_departments,
    form_families,
    form_downloads,
    form_attachments,
  ] = await Promise.all([
    prisma.form_roles.findMany({ where: { formId: { in: formIds } } }),
    prisma.form_users.findMany({ where: { formId: { in: formIds } } }),
    prisma.form_departments.findMany({ where: { formId: { in: formIds } } }),
    prisma.form_families.findMany({ where: { formId: { in: formIds } } }),
    prisma.form_downloads.findMany({ where: { formId: { in: formIds } } }),
    prisma.form_attachments.findMany({ where: { formId: { in: formIds } } }),
  ])

  return {
    form_categories: form_categories as unknown[],
    forms: forms as unknown[],
    form_roles: form_roles as unknown[],
    form_users: form_users as unknown[],
    form_departments: form_departments as unknown[],
    form_families: form_families as unknown[],
    form_downloads: form_downloads as unknown[],
    form_attachments: form_attachments as unknown[],
  } as Record<FormsModuleTable, unknown[]>
}
