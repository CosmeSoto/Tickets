/**
 * Reglas de "restauración por fusión" compartidas por los dos motores de
 * restore (`.dump` en backup-restore-dump.ts, JSON en backup-restore-json.ts).
 *
 * ESTE ES EL ÚNICO LUGAR A TOCAR cuando se agrega una tabla nueva que se crea
 * de forma perezosa en tiempo de ejecución (`ensureDefault*`/`getOrCreate*`,
 * típicamente un `upsert` con `id: randomUUID()`) pero cuya identidad real es
 * una columna de negocio (`@unique`/`@@unique`) distinta de `id`.
 *
 * Por qué importa: en modo fusión, si esa tabla NO está aquí, `id` distinto
 * entre entornos hace que "ON CONFLICT (id)" (o el `upsert({ where: { id } })`
 * de Prisma) nunca encuentre la fila ya existente — intenta un INSERT/create
 * que choca contra la unique constraint real, Postgres lanza "duplicate key",
 * y ese texto está en la lista de "errores esperados" de ambos motores → el
 * valor del backup se pierde EN SILENCIO, sin que la restauración reporte
 * ningún problema. Así se perdió `system_settings` primero, y luego
 * `site_config` (misma forma, mismo bug, sin corregir porque cada motor tenía
 * su propia lista suelta y solo se actualizó una).
 *
 * Caso más grave — tablas con hijas por FK (ver `credential_vaults` en
 * backup-restore-json.ts): si la tabla del backup se descarta por conflicto
 * pero sus hijas (p. ej. `credential_entries.vaultId`) siguen apuntando al
 * `id` viejo del backup, esas hijas también se pierden o quedan huérfanas —
 * hace falta además un remapeo de id viejo→id existente, no solo el fix de
 * `ON CONFLICT`. Antes de agregar una tabla nueva aquí, revisa si algo tiene
 * FK hacia su `id`; si la respuesta es sí, probablemente necesite ese mismo
 * tratamiento ad-hoc, no solo una entrada en estos mapas.
 */

/**
 * Tablas donde el merge debe ACTUALIZAR si ya existe el registro (en vez de
 * ignorarlo). Usado por ambos motores.
 *
 * Por qué DO UPDATE en vez de DO NOTHING para estas tablas:
 * - Son config/catálogo que la app o el seed recrean solas con valores por
 *   defecto apenas el sistema arranca o alguien visita la pantalla — un
 *   backup real trae la config verdadera, y debe ganar sobre ese default.
 * - DO NOTHING ignoraría el backup porque el registro "ya existe" (recreado).
 *
 * Tablas con DO NOTHING (el default fuera de esta lista — datos de uso real,
 * no config; el existente en la base gana sobre un backup viejo):
 * tickets, comments, attachments, notifications, ratings, news, patrols,
 * equipment, credential_vaults/entries/shares (ver el remapeo dedicado para
 * credential_vaults), equipment_code_counters, ticket_sla_metrics — ninguna
 * de estas necesita entrar aquí.
 */
export const MERGE_UPDATE_TABLES = new Set([
  // Usuarios y auth
  'users',
  '"users"',
  'user_settings',
  '"user_settings"',
  'notification_preferences',
  '"notification_preferences"',
  'notification_mutes',
  '"notification_mutes"',
  'accounts',
  '"accounts"',
  'sessions',
  '"sessions"',
  'oauth_accounts',
  '"oauth_accounts"',
  // Estructura organizacional (creada por seed)
  'families',
  '"families"',
  'departments',
  '"departments"',
  'categories',
  '"categories"',
  // Configuraciones (creadas por seed o por ensureDefault*/getOrCreate* perezoso)
  'ticket_family_config',
  '"ticket_family_config"',
  'inventory_family_config',
  '"inventory_family_config"',
  'patrol_family_config',
  '"patrol_family_config"',
  'sla_policies',
  '"sla_policies"',
  'system_settings',
  '"system_settings"',
  'system_modules',
  '"system_modules"',
  'site_config',
  '"site_config"',
  // Config OAuth por proveedor (getOrCreate perezoso vía upsert por "provider",
  // ver src/app/api/admin/oauth-config/route.ts) — id no determinista, mismo
  // criterio que system_settings/site_config.
  'oauth_configs',
  '"oauth_configs"',
  // Página pública (landing): creada por el seed con ID fijo 'default'
  // (landing_page_content) y IDs fijos 'service-1'... (landing_page_services).
  // Sin esto, favicon/logos/nombre de empresa/SEO configurados por el admin
  // se pierden en cada restauración en modo fusión: la fila ya existe (la
  // creó el seed al levantar el sistema) y DO NOTHING conserva ese contenido
  // de fábrica en vez del respaldo real.
  'landing_page_content',
  '"landing_page_content"',
  'landing_page_services',
  '"landing_page_services"',
  'landing_page_banners',
  '"landing_page_banners"',
  // Asignaciones de familias por usuario (unificado)
  'user_family_access',
  '"user_family_access"',
  'technician_assignments',
  '"technician_assignments"',
])

/**
 * Tablas cuya PK no es "id" — necesitan ON CONFLICT con la columna correcta
 * en el motor `.dump` (backup-restore-dump.ts, `convertCopyToInsertOnConflict`).
 * Para tablas no listadas aquí se asume PK = "id".
 *
 * OJO: estos son nombres de COLUMNA DE BASE DE DATOS (el dump trae los
 * nombres reales, post `@map`), no nombres de campo de Prisma — a diferencia
 * de NATURAL_KEY_MAP más abajo, que sí es para el motor JSON (Prisma). Por
 * ejemplo `ticket_family_config.familyId` tiene `@map("family_id")`: la
 * columna real es `family_id`, no `familyId`.
 */
export const TABLE_PK_MAP: Record<string, string> = {
  notification_preferences: '"userId"', // sin @map — la columna real sí es camelCase aquí
  verification_tokens: 'identifier',
  folio_counters: '"year", type',
  ticket_code_counters: '"family_id", year',
  system_settings: '"key"',
  site_config: '"key"',
  oauth_configs: 'provider',
  patrol_family_config: '"family_id"',
  inventory_family_config: '"family_id"',
  ticket_family_config: '"family_id"',
  user_family_access: '"user_id", "family_id", module',
}

/**
 * Columna de negocio real para las tablas de MERGE_UPDATE_TABLES cuya PK
 * ("id") no es determinista entre entornos, usada por el motor JSON
 * (backup-restore-json.ts, `upsert({ where: { [naturalKey]: ... } })`).
 * Nombres de CAMPO de Prisma (camelCase), no de columna de BD — a diferencia
 * de TABLE_PK_MAP, que es SQL crudo.
 */
export const NATURAL_KEY_MAP: Record<string, string> = {
  system_settings: 'key',
  site_config: 'key',
  oauth_configs: 'provider',
  patrol_family_config: 'familyId',
  inventory_family_config: 'familyId',
  ticket_family_config: 'familyId',
}

/**
 * Tablas con clave de negocio COMPUESTA (no cabe en NATURAL_KEY_MAP, que es
 * de un solo campo). `prismaWhereKey` es el nombre que Prisma le da al índice
 * único compuesto en el tipo `where` del upsert (por defecto, los campos
 * declarados en @@unique([...]) unidos con "_", en ese orden — sin `name:`
 * custom en el schema).
 */
export const COMPOUND_NATURAL_KEYS: Record<
  string,
  { prismaWhereKey: string; fields: readonly string[] }
> = {
  user_family_access: {
    prismaWhereKey: 'userId_familyId_module',
    fields: ['userId', 'familyId', 'module'],
  },
}
