import { randomUUID } from 'crypto'
import { readFile } from 'fs/promises'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type { RestoreMode } from './backup-restore'
import {
  MERGE_UPDATE_TABLES,
  NATURAL_KEY_MAP,
  COMPOUND_NATURAL_KEYS,
} from './backup-restore-merge-rules'
import {
  TICKETS_MODULE_RESTORE_ORDER,
  NEWS_MODULE_RESTORE_ORDER,
  PATROLS_MODULE_RESTORE_ORDER,
  FAMILIES_MODULE_RESTORE_ORDER,
  AUDITS_MODULE_RESTORE_ORDER,
  CONFIGURATIONS_MODULE_RESTORE_ORDER,
  USERS_MODULE_RESTORE_ORDER,
  CREDENTIALS_MODULE_RESTORE_ORDER,
  INVENTORY_MODULE_RESTORE_ORDER,
  PROCESSES_MODULE_RESTORE_ORDER,
  ACCESS_MODULE_RESTORE_ORDER,
  FORMS_MODULE_RESTORE_ORDER,
} from '../backup-modules'

/**
 * Tras restaurar con `session_replication_role = replica` (FKs desactivadas para toda
 * la transacción), pueden quedar filas que referencian IDs que ya no existen en la tabla
 * referenciada — p. ej. `technician_assignments.categoryId` apuntando a una categoría de
 * un backup viejo que no coincide con las categorías recién sembradas tras un `--clean` +
 * reseed (los IDs de `categories` no son estables entre reseeds), o `users.departmentId`
 * apuntando a un departamento renombrado entre el momento del backup y el reseed actual
 * (los IDs de `departments`/`families` SÍ son deterministas por nombre/código, pero un
 * rename real sí cambia el hash). Postgres no revalida esas filas al reactivar los
 * triggers, así que quedan huérfanas en silencio y luego rompen en runtime cualquier
 * consulta de Prisma que incluya la relación no-opcional ("Inconsistent query result:
 * Field X is required to return data, got null").
 *
 * Si la columna es NULLABLE (p. ej. `users.departmentId`), se pone en NULL en vez de
 * borrar la fila — el registro (la cuenta del técnico, el ticket, etc.) es el dato
 * valioso, no el vínculo roto; perderlo por completo silenciosamente (como ocurría
 * antes) dejaba, por ejemplo, técnicos restaurados sin aparecer nunca más como
 * resolutores disponibles en ninguna categoría. Solo se borra la fila cuando la columna
 * es NOT NULL — ahí sí es una fila de vínculo (p. ej. una asignación) sin sentido sin
 * su referencia. Se reporta cuántas filas se tocaron para que quede visible en los logs.
 */
async function cleanupOrphanedForeignKeys(tx: any, tableNames: string[]): Promise<void> {
  for (const tableName of tableNames) {
    let fks: {
      column_name: string
      foreign_table_name: string
      foreign_column_name: string
      is_nullable: string
    }[] = []
    try {
      fks = await tx.$queryRaw(Prisma.sql`
        SELECT kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name,
               c.is_nullable
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
        JOIN information_schema.columns c
          ON c.table_schema = tc.table_schema AND c.table_name = tc.table_name
             AND c.column_name = kcu.column_name
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = ${tableName}
      `)
    } catch {
      continue
    }
    for (const fk of fks) {
      try {
        if (fk.is_nullable === 'YES') {
          const cleared: number = await tx.$executeRaw(Prisma.sql`
            UPDATE ${Prisma.raw(`"${tableName}"`)}
            SET ${Prisma.raw(`"${fk.column_name}"`)} = NULL
            WHERE ${Prisma.raw(`"${fk.column_name}"`)} IS NOT NULL
              AND ${Prisma.raw(`"${fk.column_name}"`)} NOT IN (
                SELECT ${Prisma.raw(`"${fk.foreign_column_name}"`)} FROM ${Prisma.raw(`"${fk.foreign_table_name}"`)}
              )
          `)
          if (cleared > 0) {
            console.warn(
              `[RESTORE] ⚠ ${tableName}.${fk.column_name}: ${cleared} fila(s) con referencia huérfana a ${fk.foreign_table_name}.${fk.foreign_column_name} — columna puesta en NULL (fila conservada)`
            )
          }
          continue
        }

        const deleted: number = await tx.$executeRaw(Prisma.sql`
          DELETE FROM ${Prisma.raw(`"${tableName}"`)}
          WHERE ${Prisma.raw(`"${fk.column_name}"`)} IS NOT NULL
            AND ${Prisma.raw(`"${fk.column_name}"`)} NOT IN (
              SELECT ${Prisma.raw(`"${fk.foreign_column_name}"`)} FROM ${Prisma.raw(`"${fk.foreign_table_name}"`)}
            )
        `)
        if (deleted > 0) {
          console.warn(
            `[RESTORE] ⚠ ${tableName}.${fk.column_name}: ${deleted} fila(s) huérfana(s) eliminada(s) (referencia inexistente en ${fk.foreign_table_name}.${fk.foreign_column_name}, columna NOT NULL)`
          )
        }
      } catch (e) {
        console.warn(
          `[RESTORE] No se pudo verificar FK ${tableName}.${fk.column_name}: ${(e as Error).message?.slice(0, 150)}`
        )
      }
    }
  }
}

/**
 * Restauración por módulo, formato JSON (completa o selectiva por módulo — ver
 * restoreFromJSON). El motor real: para cada tabla del módulo, decide entre
 * DELETE+reinsertar (replace), upsert con sobrescritura forzada por clave
 * natural (merge sobre MERGE_UPDATE_TABLES, ver backup-restore-merge-rules.ts),
 * o createMany con skipDuplicates (merge normal, datos de uso real).
 */
async function restoreModuleFromJSON(
  moduleId: string,
  mappedData: Record<string, any[]>,
  restoreOrder: readonly string[],
  mode: RestoreMode = 'replace'
): Promise<void> {
  // credential_vaults: las bóvedas de área se auto-crean solas (ensureDefaultAreaVault)
  // con id aleatorio pero nombre fijo por familia (@@unique([familyId, kind, name])).
  // En una restauración por fusión, si el entorno ya tiene una bóveda con esa misma
  // identidad (muy probable: se recrea sola en cuanto alguien abre Credenciales), el
  // INSERT del backup choca contra esa constraint y createMany con skipDuplicates lo
  // descarta en silencio — la bóveda original del backup (y todo lo que dependía de su
  // id: sus entradas y compartidos) nunca vuelve. Se resuelve remapeando: en vez de
  // insertar una bóveda duplicada, las entradas que apuntaban al id del backup se
  // reescriben para apuntar a la bóveda que ya existe con esa misma identidad.
  const vaultIdRemap = new Map<string, string>()

  await prisma.$transaction(
    async tx => {
      await tx.$executeRaw(Prisma.sql`SET session_replication_role = replica;`)

      for (const tableName of restoreOrder) {
        const tableData = mappedData[tableName]
        if (!tableData?.length) continue
        const processed = tableData.map((r: any) => processRecordForRestore(r))
        console.log(
          `[módulo ${moduleId}/${mode}] Restaurando ${processed.length} registros → ${tableName}`
        )

        if (
          moduleId === 'credentials' &&
          mode === 'merge' &&
          tableName === 'credential_vaults' &&
          processed.length > 0
        ) {
          // Solo bóvedas de área (familyId no nulo) pueden colisionar: Postgres nunca
          // considera iguales dos filas con familyId NULL en un índice único compuesto,
          // así que las personales (kind=PERSONAL, familyId nulo) no necesitan remapeo.
          const withFamily = processed.filter((v: any) => v.familyId)
          if (withFamily.length > 0) {
            const existingVaults = await tx.credential_vaults.findMany({
              where: {
                OR: withFamily.map((v: any) => ({
                  familyId: v.familyId,
                  kind: v.kind,
                  name: v.name,
                })),
              },
              select: { id: true, familyId: true, kind: true, name: true },
            })
            const existingByKey = new Map(
              existingVaults.map(v => [`${v.familyId}::${v.kind}::${v.name}`, v.id])
            )
            for (let i = processed.length - 1; i >= 0; i--) {
              const v = processed[i]
              if (!v.familyId) continue
              const existingId = existingByKey.get(`${v.familyId}::${v.kind}::${v.name}`)
              if (existingId && existingId !== v.id) {
                vaultIdRemap.set(v.id, existingId)
                processed.splice(i, 1)
              }
            }
            if (vaultIdRemap.size > 0) {
              console.log(
                `[módulo ${moduleId}] ${vaultIdRemap.size} bóveda(s) del backup ya existían con otra identidad — se remapean en vez de duplicarse`
              )
            }
          }
        }

        if (
          moduleId === 'credentials' &&
          tableName === 'credential_entries' &&
          vaultIdRemap.size > 0
        ) {
          for (const entry of processed) {
            const remapped = vaultIdRemap.get(entry.vaultId)
            if (remapped) entry.vaultId = remapped
          }
        }

        if (mode === 'replace') {
          // Eliminar los registros del backup (por ID) antes de reinsertar
          const ids = processed.map((r: any) => r.id).filter(Boolean)
          if (ids.length > 0) {
            try {
              const idList = ids.map((id: string) => `'${id.replace(/'/g, "''")}'`).join(',')
              await tx.$executeRaw(
                Prisma.sql`DELETE FROM ${Prisma.raw(`"${tableName}"`)} WHERE id IN (${Prisma.raw(idList)});`
              )
            } catch (delErr) {
              console.warn(
                `[módulo ${moduleId}] ⚠ No se pudo limpiar IDs de ${tableName}: ${(delErr as Error).message?.slice(0, 100)}`
              )
            }
          }
        }
        // En modo 'merge' no borramos — hacemos upsert directamente

        // Tablas de configuración con fila(s) de ID fijo creadas por el seed o
        // recreadas solas en tiempo de ejecución (site_config, landing_page_content,
        // patrol_family_config, etc.): en modo fusión el backup SIEMPRE debe ganar
        // sobre lo que ya exista, igual que en el camino de restauración desde .dump
        // (ver MERGE_UPDATE_TABLES en backup-restore-merge-rules.ts). createMany con
        // skipDuplicates no sirve aquí: si la fila ya existe (la creó el seed o la
        // regeneró la app) createMany la salta SIN lanzar error, así que nunca se
        // llega al fallback de upsert de abajo — la restauración "funciona" pero deja
        // el contenido de fábrica en vez del respaldo.
        const forceOverwriteOnMerge = mode === 'merge' && MERGE_UPDATE_TABLES.has(tableName)

        if (forceOverwriteOnMerge) {
          let updatedCount = 0
          // Para las tablas de MERGE_UPDATE_TABLES cuya PK ("id") no es
          // determinista entre entornos, la identidad real está en otra
          // columna (ver NATURAL_KEY_MAP/COMPOUND_NATURAL_KEYS) — upsert por
          // id no encuentra la fila existente (id distinto) e intenta un
          // create que choca contra esa constraint real; Prisma lo reporta
          // como P2002, capturado más abajo y descartado en silencio si no
          // se corrige el "where" del upsert.
          const naturalKeyField = NATURAL_KEY_MAP[tableName] ?? null
          const compoundKey = COMPOUND_NATURAL_KEYS[tableName] ?? null
          for (let i = 0; i < processed.length; i++) {
            try {
              await tx.$executeRaw(Prisma.sql`SAVEPOINT restore_record;`)
              if (
                compoundKey &&
                compoundKey.fields.every(
                  f => processed[i][f] !== undefined && processed[i][f] !== null
                )
              ) {
                const whereValue: Record<string, unknown> = {}
                for (const field of compoundKey.fields) whereValue[field] = processed[i][field]
                await (tx as any)[tableName].upsert({
                  where: { [compoundKey.prismaWhereKey]: whereValue },
                  update: processed[i],
                  create: processed[i],
                })
              } else if (naturalKeyField && processed[i][naturalKeyField]) {
                await (tx as any)[tableName].upsert({
                  where: { [naturalKeyField]: processed[i][naturalKeyField] },
                  update: processed[i],
                  create: processed[i],
                })
              } else if (processed[i].id) {
                await (tx as any)[tableName].upsert({
                  where: { id: processed[i].id },
                  update: processed[i],
                  create: processed[i],
                })
              } else {
                await (tx as any)[tableName].create({ data: processed[i] })
              }
              await tx.$executeRaw(Prisma.sql`RELEASE SAVEPOINT restore_record;`)
              updatedCount++
            } catch (recordErr) {
              await tx.$executeRaw(Prisma.sql`ROLLBACK TO SAVEPOINT restore_record;`)
              if (i < 3) {
                console.warn(
                  `[módulo ${moduleId}] ⚠ ${tableName}[${i}] error: ${(recordErr as Error).message?.slice(0, 150)}`
                )
              }
            }
          }
          console.log(
            `[módulo ${moduleId}] ${tableName}: ${updatedCount}/${processed.length} registros restaurados (fusión con sobrescritura)`
          )
          continue
        }

        // Intentar createMany primero (más eficiente)
        try {
          await tx.$executeRaw(Prisma.sql`SAVEPOINT restore_table;`)
          // skipDuplicates ignora conflictos → solo inserta los que no existen todavía
          // (correcto para datos reales como tickets/noticias/equipos: en fusión se
          // agregan registros nuevos sin tocar los existentes).
          await (tx as any)[tableName].createMany({ data: processed, skipDuplicates: true })
          await tx.$executeRaw(Prisma.sql`RELEASE SAVEPOINT restore_table;`)
        } catch (bulkErr) {
          await tx.$executeRaw(Prisma.sql`ROLLBACK TO SAVEPOINT restore_table;`)
          console.warn(
            `[módulo ${moduleId}] createMany falló para ${tableName}: ${(bulkErr as Error).message?.slice(0, 150)}`
          )
          console.warn(`[módulo ${moduleId}] Intentando upsert individual para ${tableName}...`)
          let insertedCount = 0
          for (let i = 0; i < processed.length; i++) {
            try {
              await tx.$executeRaw(Prisma.sql`SAVEPOINT restore_record;`)
              if (processed[i].id) {
                if (mode === 'merge') {
                  // merge: solo insertar si no existe (no actualizar el existente)
                  await (tx as any)[tableName].upsert({
                    where: { id: processed[i].id },
                    update: {}, // no sobreescribir el existente
                    create: processed[i],
                  })
                } else {
                  // replace: actualizar si existe
                  await (tx as any)[tableName].upsert({
                    where: { id: processed[i].id },
                    update: processed[i],
                    create: processed[i],
                  })
                }
              } else {
                await (tx as any)[tableName].create({ data: processed[i] })
              }
              await tx.$executeRaw(Prisma.sql`RELEASE SAVEPOINT restore_record;`)
              insertedCount++
            } catch (recordErr) {
              await tx.$executeRaw(Prisma.sql`ROLLBACK TO SAVEPOINT restore_record;`)
              if (i < 3) {
                console.warn(
                  `[módulo ${moduleId}] ⚠ ${tableName}[${i}] error: ${(recordErr as Error).message?.slice(0, 150)}`
                )
              }
            }
          }
          console.log(
            `[módulo ${moduleId}] ${tableName}: ${insertedCount}/${processed.length} registros restaurados`
          )
        }
      }

      await tx.$executeRaw(Prisma.sql`SET session_replication_role = DEFAULT;`)
      await cleanupOrphanedForeignKeys(
        tx,
        restoreOrder.filter(t => mappedData[t]?.length > 0)
      )
    },
    { timeout: 600000 }
  )
  console.log(`Restauración JSON módulo ${moduleId} (${mode}) completada`)
}

/**
 * Backups antiguos pueden traer *_family_assignments / inventory_manager_families.
 * Se convierten a user_family_access y se eliminan las claves legacy del payload.
 */
function foldLegacyFamilyAssignmentsIntoUnified(mappedData: Record<string, any[]>): void {
  const existing = Array.isArray(mappedData.user_family_access) ? mappedData.user_family_access : []
  const byKey = new Map<string, any>()
  for (const row of existing) {
    const userId = row.userId ?? row.user_id
    const familyId = row.familyId ?? row.family_id
    const moduleKey = row.module
    if (userId && familyId && moduleKey) {
      byKey.set(`${userId}|${familyId}|${moduleKey}`, row)
    }
  }

  const push = (row: {
    userId: string
    familyId: string
    module: string
    canConsume: boolean
    canOperate: boolean
    canView: boolean
    isActive: boolean
    createdAt?: unknown
    updatedAt?: unknown
    id?: string
  }) => {
    if (!row.userId || !row.familyId) return
    const k = `${row.userId}|${row.familyId}|${row.module}`
    if (byKey.has(k)) return
    byKey.set(k, {
      id: row.id ?? randomUUID(),
      userId: row.userId,
      familyId: row.familyId,
      module: row.module,
      canConsume: row.canConsume,
      canOperate: row.canOperate,
      canView: row.canView,
      isActive: row.isActive,
      createdAt: row.createdAt ?? new Date().toISOString(),
      updatedAt: row.updatedAt ?? new Date().toISOString(),
    })
  }

  for (const r of mappedData.technician_family_assignments ?? []) {
    push({
      id: r.id,
      userId: r.technicianId ?? r.technician_id,
      familyId: r.familyId ?? r.family_id,
      module: 'tickets',
      canConsume: true,
      canOperate: false,
      canView: false,
      isActive: r.isActive ?? r.is_active ?? true,
      createdAt: r.createdAt ?? r.created_at,
      updatedAt: r.updatedAt ?? r.updated_at,
    })
  }
  for (const r of mappedData.admin_family_assignments ?? []) {
    push({
      id: r.id,
      userId: r.adminId ?? r.admin_id,
      familyId: r.familyId ?? r.family_id,
      module: 'tickets',
      canConsume: true,
      canOperate: false,
      canView: false,
      isActive: r.isActive ?? r.is_active ?? true,
      createdAt: r.createdAt ?? r.created_at,
      updatedAt: r.updatedAt ?? r.updated_at,
    })
  }
  for (const r of mappedData.client_family_assignments ?? []) {
    push({
      id: r.id,
      userId: r.clientId ?? r.client_id,
      familyId: r.familyId ?? r.family_id,
      module: 'tickets',
      canConsume: true,
      canOperate: false,
      canView: true,
      isActive: r.isActive ?? r.is_active ?? true,
      createdAt: r.createdAt ?? r.created_at,
      updatedAt: r.updatedAt ?? r.updated_at,
    })
  }
  for (const r of mappedData.inventory_manager_families ?? []) {
    push({
      id: r.id,
      userId: r.managerId ?? r.manager_id,
      familyId: r.familyId ?? r.family_id,
      module: 'inventory',
      canConsume: false,
      canOperate: true,
      canView: true,
      isActive: true,
      createdAt: r.createdAt ?? r.created_at,
      updatedAt: r.updatedAt ?? r.updated_at,
    })
  }
  for (const r of mappedData.patrol_family_assignments ?? []) {
    push({
      id: r.id,
      userId: r.userId ?? r.user_id,
      familyId: r.familyId ?? r.family_id,
      module: 'patrols',
      canConsume: false,
      canOperate: true,
      canView: true,
      isActive: r.isActive ?? r.is_active ?? true,
      createdAt: r.createdAt ?? r.created_at,
      updatedAt: r.updatedAt ?? r.updated_at,
    })
  }

  mappedData.user_family_access = [...byKey.values()]
  delete mappedData.technician_family_assignments
  delete mappedData.admin_family_assignments
  delete mappedData.client_family_assignments
  delete mappedData.inventory_manager_families
  delete mappedData.patrol_family_assignments
}

function processRecordForRestore(record: any): any {
  const processed = { ...record }
  for (const [key, value] of Object.entries(processed)) {
    if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
      if (Array.isArray(value) || (typeof value === 'object' && !ArrayBuffer.isView(value))) {
        const jsonFields = [
          'details',
          'metadata',
          'config',
          'settings',
          'preferences',
          'data',
          'content',
          'options',
          'filters',
          'headers',
          'payload',
          'response',
          'context',
        ]
        if (!jsonFields.includes(key)) {
          delete processed[key]
        }
      }
    }
  }
  const dateFields = [
    'createdAt',
    'updatedAt',
    'lastLogin',
    'dueDate',
    'resolvedAt',
    'closedAt',
    'firstResponseAt',
    'slaDeadline',
    'startDate',
    'targetDate',
    'completedDate',
    'completedAt',
    'notifiedAt',
    'expectedAt',
    'actualAt',
  ]
  for (const field of dateFields) {
    if (processed[field] && typeof processed[field] === 'string') {
      processed[field] = new Date(processed[field])
    }
  }
  return processed
}

/**
 * Motor de restauración para respaldos en formato JSON. Completa (sin
 * `restoreModules` ni `metadata.module`) o selectiva por módulo — en la
 * práctica, todo backup JSON creado hoy (`createModuleJsonBackup`) es de un
 * solo módulo, así que la rama "completa" de abajo solo se ejercita
 * restaurando un archivo JSON legado de antes de que existiera esa
 * convención (no respeta `mode`: siempre hace DELETE+reinsertar).
 */
export async function restoreFromJSON(
  backup: {
    id: string
    filename: string
    filepath: string
  },
  restoreModules?: string[],
  mode: RestoreMode = 'replace'
): Promise<void> {
  const backupContent = await readFile(backup.filepath, 'utf-8')
  let backupData: any
  try {
    backupData = JSON.parse(backupContent)
  } catch (error) {
    throw new Error(
      'El archivo de respaldo no tiene un formato JSON válido. Si es un respaldo SQL (.sql), asegúrate de que psql esté instalado.'
    )
  }

  let normalizedData: any
  if (backupData.metadata && backupData.data) {
    console.log('Detectado formato de respaldo v2 (Prisma completo)')
    normalizedData = backupData.data
  } else if (backupData.tables) {
    console.log('Detectado formato de respaldo v1 (Prisma básico)')
    normalizedData = backupData.tables
  } else {
    throw new Error(
      'El archivo de respaldo no tiene una estructura reconocida. Claves encontradas: ' +
        Object.keys(backupData).join(', ')
    )
  }

  console.log('Iniciando restauración JSON:', backup.filename)
  console.log('Tablas disponibles:', Object.keys(normalizedData))

  const tableMapping: Record<string, string> = {
    users: 'users',
    categories: 'categories',
    tickets: 'tickets',
    ticketComments: 'comments',
    comments: 'comments',
    notifications: 'notifications',
    auditLogs: 'audit_logs',
    technician_assignments: 'technician_assignments',
    ticketRatings: 'ticket_ratings',
    ticket_ratings: 'ticket_ratings',
    ticketHistory: 'ticket_history',
    ticket_history: 'ticket_history',
    attachments: 'attachments',
    notificationPreferences: 'notification_preferences',
    notification_preferences: 'notification_preferences',
    notificationMutes: 'notification_mutes',
    notification_mutes: 'notification_mutes',
    oauthAccounts: 'oauth_accounts',
    oauth_accounts: 'oauth_accounts',
    accounts: 'accounts',
    sessions: 'sessions',
    pages: 'pages',
    siteConfig: 'site_config',
    site_config: 'site_config',
    systemSettings: 'system_settings',
    system_settings: 'system_settings',
    systemModules: 'system_modules',
    system_modules: 'system_modules',
    backups: 'backups',
    verificationTokens: 'verification_tokens',
    verification_tokens: 'verification_tokens',
    passwordResetTokens: 'password_reset_tokens',
    password_reset_tokens: 'password_reset_tokens',
    userSettings: 'user_settings',
    user_settings: 'user_settings',
    // Tablas legacy de asignación → se pliegan a user_family_access abajo
    adminFamilyAssignments: 'admin_family_assignments',
    admin_family_assignments: 'admin_family_assignments',
    clientFamilyAssignments: 'client_family_assignments',
    client_family_assignments: 'client_family_assignments',
    technicianFamilyAssignments: 'technician_family_assignments',
    technician_family_assignments: 'technician_family_assignments',
    inventoryManagerFamilies: 'inventory_manager_families',
    inventory_manager_families: 'inventory_manager_families',
    patrolFamilyAssignments: 'patrol_family_assignments',
    patrol_family_assignments: 'patrol_family_assignments',
    userFamilyAccess: 'user_family_access',
    user_family_access: 'user_family_access',
  }

  const mappedData: Record<string, any[]> = {}
  for (const [oldName, data] of Object.entries(normalizedData)) {
    const realName = tableMapping[oldName] ?? oldName
    mappedData[realName] = Array.isArray(data) ? data : []
  }

  foldLegacyFamilyAssignmentsIntoUnified(mappedData)

  console.log('Tablas a restaurar:', Object.keys(mappedData))

  const backupModule = backupData.metadata?.module as string | undefined
  const effectiveModules: string[] = restoreModules?.length
    ? restoreModules
    : backupModule
      ? [backupModule]
      : []

  if (effectiveModules.length > 0) {
    for (const effectiveModule of effectiveModules) {
      let restoreOrder: readonly string[] = []
      switch (effectiveModule) {
        case 'tickets':
          restoreOrder = TICKETS_MODULE_RESTORE_ORDER
          break
        case 'news':
          restoreOrder = NEWS_MODULE_RESTORE_ORDER
          break
        case 'patrols':
          restoreOrder = PATROLS_MODULE_RESTORE_ORDER
          break
        case 'families':
          restoreOrder = FAMILIES_MODULE_RESTORE_ORDER
          break
        case 'audits':
          restoreOrder = AUDITS_MODULE_RESTORE_ORDER
          break
        case 'configurations':
          restoreOrder = CONFIGURATIONS_MODULE_RESTORE_ORDER
          break
        case 'users':
          restoreOrder = USERS_MODULE_RESTORE_ORDER
          break
        case 'inventory':
          restoreOrder = INVENTORY_MODULE_RESTORE_ORDER
          break
        case 'credentials':
          // Restaura ciphertext AES-GCM tal cual; revelar requiere ENCRYPTION_KEY del origen.
          restoreOrder = CREDENTIALS_MODULE_RESTORE_ORDER
          break
        case 'processes':
          restoreOrder = PROCESSES_MODULE_RESTORE_ORDER
          break
        case 'access':
          restoreOrder = ACCESS_MODULE_RESTORE_ORDER
          break
        case 'forms':
          restoreOrder = FORMS_MODULE_RESTORE_ORDER
          break
        default:
          throw new Error(`Módulo no soportado para restauración: ${effectiveModule}`)
      }
      const scoped: Record<string, any[]> = {}
      for (const key of restoreOrder) {
        scoped[key] = mappedData[key] ?? []
      }
      const hasData = Object.values(scoped).some(arr => arr.length > 0)
      if (!hasData) {
        console.warn(
          `[RESTORE] El respaldo no contiene datos para el módulo "${effectiveModule}", omitiendo.`
        )
        continue
      }
      console.log(`[RESTORE] Restauración selectiva: módulo "${effectiveModule}" (modo: ${mode})`)
      await restoreModuleFromJSON(effectiveModule, scoped, restoreOrder, mode)
    }
    return
  }

  const restoreOrder = [
    'users',
    'departments',
    'families',
    'categories',
    'system_settings',
    'system_modules',
    'site_config',
    'pages',
    'oauth_configs',
    'equipment_types',
    'suppliers',
    'warehouses',
    'user_family_access',
    'user_settings',
    'notification_preferences',
    'notification_mutes',
    'technician_assignments',
    'oauth_accounts',
    'sessions',
    'accounts',
    'password_reset_tokens',
    'tickets',
    'comments',
    'attachments',
    'ticket_history',
    'ticket_ratings',
    'ticket_collaborators',
    'notifications',
    'audit_logs',
    'sla_policies',
    'sla_violations',
    'ticket_sla_metrics',
    'ticket_email_digest_items',
    'knowledge_articles',
    'article_votes',
    'ticket_knowledge_articles',
    'equipment',
    'equipment_assignments',
    'equipment_attachments',
    'maintenance_records',
    'software_licenses',
    'license_attachments',
    'consumables',
    'stock_movements',
    'delivery_acts',
    'return_acts',
    'decommission_requests',
    'decommission_acts',
    'decommission_attachments',
    'contract_service_types',
    'contracts',
    'contract_lines',
    'contract_attachments',
    'contract_amendments',
    'contract_payments',
    'contract_assignments',
    'contract_return_acts',
    'resolution_plans',
    'resolution_tasks',
    'webhooks',
    'webhook_logs',
    'landing_page_content',
    'landing_page_services',
    'landing_page_banners',
    'email_queue',
    'telegram_queue',
    'category_analytics',
    'backups',
    'verification_tokens',
    'processes',
    'process_versions',
    'process_diagrams',
    'process_attachments',
    'process_approval_events',
    'process_external_reviews',
    'access_organizations',
    'access_subjects',
    'access_passes',
    'access_scan_events',
  ]

  await prisma.$transaction(
    async tx => {
      await tx.$executeRaw(Prisma.sql`SET session_replication_role = replica;`)
      for (const tableName of [...restoreOrder].reverse()) {
        if (mappedData[tableName]?.length > 0) {
          try {
            await tx.$executeRaw(Prisma.sql`DELETE FROM ${Prisma.raw(`"${tableName}"`)};`)
          } catch (err) {
            console.warn(`⚠ No se pudo limpiar tabla ${tableName}:`, (err as Error).message)
          }
        }
      }
      await tx.$executeRaw(Prisma.sql`SET session_replication_role = DEFAULT;`)
      for (const tableName of restoreOrder) {
        const tableData = mappedData[tableName]
        if (!tableData?.length) continue
        console.log(`Restaurando ${tableData.length} registros → ${tableName}`)
        const processed = tableData.map(r => processRecordForRestore(r))
        try {
          await tx.$executeRaw(Prisma.sql`SAVEPOINT restore_table;`)
          await (tx as any)[tableName].createMany({ data: processed, skipDuplicates: true })
          await tx.$executeRaw(Prisma.sql`RELEASE SAVEPOINT restore_table;`)
        } catch (bulkErr) {
          await tx.$executeRaw(Prisma.sql`ROLLBACK TO SAVEPOINT restore_table;`)
          console.warn(
            `createMany falló para ${tableName}: ${(bulkErr as Error).message?.slice(0, 150)}`
          )
          console.warn(`Intentando inserción individual para ${tableName}...`)
          let insertedCount = 0
          for (let i = 0; i < processed.length; i++) {
            try {
              await tx.$executeRaw(Prisma.sql`SAVEPOINT restore_record;`)
              await (tx as any)[tableName].create({ data: processed[i] })
              await tx.$executeRaw(Prisma.sql`RELEASE SAVEPOINT restore_record;`)
              insertedCount++
            } catch (recordErr) {
              await tx.$executeRaw(Prisma.sql`ROLLBACK TO SAVEPOINT restore_record;`)
              if (i === 0) {
                console.warn(
                  `⚠ ${tableName} registro ${i + 1} omitido: ${(recordErr as Error).message?.slice(
                    0,
                    120
                  )}`
                )
              }
            }
          }
          console.log(`${tableName}: ${insertedCount}/${processed.length} registros insertados`)
        }
      }
      await cleanupOrphanedForeignKeys(
        tx,
        restoreOrder.filter(t => mappedData[t]?.length > 0)
      )
    },
    { timeout: 600000 }
  )
  console.log('Restauración JSON completada exitosamente')
}
