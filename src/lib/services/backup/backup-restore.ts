import { exec } from 'child_process'
import { promisify } from 'util'
import { stat, unlink, readFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { hasPgTools, parseDatabaseUrl, decryptFile, calculateChecksum } from './backup-utils'
import {
  TICKETS_MODULE_RESTORE_ORDER,
  NEWS_MODULE_RESTORE_ORDER,
  PATROLS_MODULE_RESTORE_ORDER,
  FAMILIES_MODULE_RESTORE_ORDER,
  AUDITS_MODULE_RESTORE_ORDER,
  CONFIGURATIONS_MODULE_RESTORE_ORDER,
  USERS_MODULE_RESTORE_ORDER,
} from '../backup-modules'

const execAsync = promisify(exec)

export type RestoreMode = 'replace' | 'merge'

export async function restoreBackup(
  backupId: string,
  restoreModules?: string[],
  mode: RestoreMode = 'replace'
): Promise<void> {
  try {
    const backup = await prisma.backups.findUnique({ where: { id: backupId } })
    if (!backup) {
      throw new Error('Respaldo no encontrado')
    }
    if (backup.status !== 'completed') {
      throw new Error('El respaldo no está completo')
    }

    await stat(backup.filepath)
    try {
      const isValid = await verifyBackupIntegrity(backupId)
      if (!isValid) {
        console.warn('[RESTORE] Advertencia: integridad no verificada, continuando...')
      }
    } catch (error) {
      console.warn('[RESTORE] No se pudo verificar integridad:', error)
    }

    let workingFilepath = backup.filepath
    let decryptedTempPath: string | null = null
    if (backup.filepath.endsWith('.enc')) {
      console.log('[RESTORE] Descifrando respaldo...')
      try {
        workingFilepath = await decryptFile(backup.filepath)
        decryptedTempPath = workingFilepath
      } catch (decryptError) {
        throw new Error(
          `No se pudo descifrar el respaldo: ${
            decryptError instanceof Error ? decryptError.message : 'Error desconocido'
          }. Verifica que BACKUP_ENCRYPTION_KEY sea la misma que se usó al crear el respaldo.`
        )
      }
    }

    const isDumpFormat = workingFilepath.endsWith('.dump')
    let isJsonBackup = false
    let isSqlBackup = false

    if (!isDumpFormat) {
      let isGzipped = false
      try {
        const { stdout } = await execAsync(`file -b "${workingFilepath}"`)
        isGzipped = stdout.includes('gzip compressed')
      } catch {}

      if (isGzipped || workingFilepath.endsWith('.gz')) {
        console.log('[RESTORE] Descomprimiendo...')
        const decompressedPath = workingFilepath.replace(/\.gz$/, '') + '.temp'
        await execAsync(`gunzip -c "${workingFilepath}" > "${decompressedPath}"`)
        workingFilepath = decompressedPath
      }

      try {
        const { stdout: head } = await execAsync(`head -c 200 "${workingFilepath}"`)
        if (head.trim().startsWith('{')) {
          isJsonBackup = true
        } else {
          isSqlBackup = true
        }
      } catch {
        isSqlBackup = workingFilepath.endsWith('.sql')
        isJsonBackup = workingFilepath.endsWith('.json')
      }
    }

    const format = isDumpFormat ? 'pg_dump_custom' : isSqlBackup ? 'SQL' : 'JSON'
    console.log(
      `[RESTORE] Formato: ${format} | Modo: ${mode}` +
        (restoreModules?.length ? ` | Módulos: [${restoreModules.join(', ')}]` : ' | Completa')
    )

    const pgRestoreAvailable = await hasPgTools()
    const dbConfig = parseDatabaseUrl()

    if (isDumpFormat && pgRestoreAvailable) {
      await restoreWithPgRestore(workingFilepath, dbConfig, restoreModules, mode)
    } else if (isSqlBackup && pgRestoreAvailable) {
      if (restoreModules?.length) {
        throw new Error(
          'La restauración selectiva no está disponible para respaldos SQL plano. Crea un nuevo respaldo (formato .dump) para usar restauración selectiva.'
        )
      }
      await restoreFromSQL({ ...backup, filepath: workingFilepath })
    } else if (isJsonBackup) {
      await restoreFromJSON({ ...backup, filepath: workingFilepath }, restoreModules, mode)
    } else if (isDumpFormat && !pgRestoreAvailable) {
      throw new Error(
        'pg_restore no está disponible en el servidor. Instala postgresql-client para restaurar respaldos en formato .dump'
      )
    } else {
      throw new Error('No se pudo detectar el formato del respaldo')
    }

    if (decryptedTempPath) {
      try {
        await unlink(decryptedTempPath)
      } catch {}
    }

    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'backup_restored',
        entityType: 'System',
        entityId: 'backup',
        createdAt: new Date(),
        details: {
          backupId: backup.id,
          filename: backup.filename,
          method: format,
          mode,
          restoreModules: restoreModules?.join(', ') || 'full',
          restoredAt: new Date(),
        },
      },
    })

    console.log('[RESTORE] Restauración completada exitosamente')
  } catch (error) {
    console.error('[RESTORE] Error:', error)
    throw error
  }
}

async function verifyBackupIntegrity(backupId: string): Promise<boolean> {
  try {
    const backup = await prisma.backups.findUnique({ where: { id: backupId } })
    if (!backup || backup.status !== 'completed') {
      return false
    }
    try {
      await stat(backup.filepath)
    } catch {
      return false
    }
    if (backup.checksum) {
      const currentChecksum = await calculateChecksum(backup.filepath)
      return currentChecksum === backup.checksum
    }
    const stats = await stat(backup.filepath)
    return stats.size > 0
  } catch (error) {
    console.error('Error al verificar integridad del respaldo:', error)
    return false
  }
}

async function restoreWithPgRestore(
  filepath: string,
  dbConfig: { host: string; port: string; database: string; username: string; password: string },
  restoreModules?: string[],
  mode: RestoreMode = 'replace'
): Promise<void> {
  if (restoreModules?.length) {
    const tables = getTablesForModules(restoreModules)
    console.log(
      `[RESTORE] Restauración selectiva (${mode}): ${tables.length} tablas de módulo(s) [${restoreModules.join(', ')}]`
    )

    if (mode === 'replace') {
      // Modo reemplazo: TRUNCATE + insertar todo del backup
      const truncateSQL = tables.map(t => `TRUNCATE TABLE "${t}" CASCADE;`).join(' ')
      const truncateCmd = `PGPASSWORD="${dbConfig.password}" psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} -c "SET session_replication_role = replica; ${truncateSQL} SET session_replication_role = DEFAULT;" 2>&1`

      try {
        await execAsync(truncateCmd, { timeout: 60000, maxBuffer: 1024 * 1024 * 10 })
        console.log('[RESTORE] Tablas truncadas correctamente')
      } catch (truncErr) {
        console.warn(
          '[RESTORE] Advertencia al truncar:',
          (truncErr as Error).message?.slice(0, 200)
        )
      }

      const tableFlags = tables.map(t => `--table="${t}"`).join(' ')
      const command =
        `PGPASSWORD="${dbConfig.password}" pg_restore ` +
        `-h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} ` +
        `--data-only --no-owner --no-privileges --disable-triggers ` +
        `${tableFlags} ` +
        `"${filepath}" 2>&1 || true`
      const { stdout } = await execAsync(command, {
        timeout: 600000,
        maxBuffer: 1024 * 1024 * 50,
      })
      if (stdout && stdout.includes('ERROR')) {
        const errors = stdout.split('\n').filter(l => l.includes('ERROR'))
        const criticalErrors = errors.filter(
          e =>
            !e.includes('does not exist') &&
            !e.includes('already exists') &&
            !e.includes('duplicate key')
        )
        if (criticalErrors.length > 0) {
          console.warn('[RESTORE] Errores:', criticalErrors.slice(0, 5).join('\n'))
        }
      }
    } else {
      // Modo merge: insertar solo registros nuevos, ignorar duplicados (ON CONFLICT DO NOTHING)
      // Estrategia: volcar el SQL a stdout (sin conectarse), modificar los INSERTs, luego ejecutar
      const tempSqlPath = `${filepath}.merge_temp.sql`
      const tableFlags = tables.map(t => `--table="${t}"`).join(' ')

      try {
        // 1. Volcar SQL a stdout — SIN flags de conexión, solo extrae el SQL del .dump
        // -f - redirige la salida a stdout en lugar de ejecutar contra una BD
        const dumpSqlCmd =
          `pg_restore --data-only --no-owner --no-privileges -f - ` + `${tableFlags} "${filepath}"`

        let sqlContent: string
        try {
          const { stdout } = await execAsync(dumpSqlCmd, {
            timeout: 300000,
            maxBuffer: 1024 * 1024 * 200,
          })
          sqlContent = stdout
        } catch (dumpErr: any) {
          // pg_restore retorna exit code != 0 si hay warnings — usar stdout de todas formas
          if (dumpErr.stdout && dumpErr.stdout.length > 0) {
            sqlContent = dumpErr.stdout
          } else {
            throw new Error(
              `No se pudo extraer SQL del dump: ${(dumpErr as Error).message?.slice(0, 200)}`
            )
          }
        }

        if (!sqlContent || sqlContent.trim().length === 0) {
          throw new Error('El dump no generó contenido SQL para las tablas seleccionadas')
        }

        // 2. Reescribir cada INSERT para agregar ON CONFLICT DO NOTHING
        const mergedSql = sqlContent
          .split('\n')
          .map(line => {
            const trimmed = line.trim()
            if (/^INSERT INTO /i.test(trimmed) && !line.includes('ON CONFLICT')) {
              return line.replace(/;(\s*)$/, ' ON CONFLICT DO NOTHING;$1')
            }
            return line
          })
          .join('\n')

        const { writeFile: writeF } = await import('fs/promises')
        await writeF(tempSqlPath, mergedSql, 'utf-8')

        // 3. Ejecutar el SQL modificado desactivando FK constraints temporalmente
        const mergeCmd =
          `PGPASSWORD="${dbConfig.password}" psql ` +
          `-h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} ` +
          `-v ON_ERROR_STOP=0 ` +
          `-c "SET session_replication_role = replica;" ` +
          `-f "${tempSqlPath}" ` +
          `-c "SET session_replication_role = DEFAULT;" 2>&1 || true`

        const { stdout: mergeOut } = await execAsync(mergeCmd, {
          timeout: 600000,
          maxBuffer: 1024 * 1024 * 50,
        })

        if (mergeOut) {
          const errors = mergeOut.split('\n').filter(l => l.includes('ERROR'))
          const criticalErrors = errors.filter(
            e =>
              !e.includes('does not exist') &&
              !e.includes('already exists') &&
              !e.includes('duplicate key') &&
              !e.includes('ON CONFLICT')
          )
          if (criticalErrors.length > 0) {
            console.warn('[RESTORE] Errores en merge:', criticalErrors.slice(0, 5).join('\n'))
          }
        }

        console.log(`[RESTORE] Merge completado para tablas: ${tables.join(', ')}`)
      } finally {
        try {
          await unlink(tempSqlPath)
        } catch {}
      }
    }

    console.log(`[RESTORE] Restauración selectiva (${mode}) completada: ${tables.length} tablas`)
  } else {
    // Restauración completa — el modo merge no aplica a nivel completo (demasiado riesgo de inconsistencias)
    const command =
      `PGPASSWORD="${dbConfig.password}" pg_restore ` +
      `-h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} ` +
      `--clean --if-exists --no-owner --no-privileges --single-transaction ` +
      `"${filepath}" 2>&1 || true`
    console.log('[RESTORE] Ejecutando restauración completa con pg_restore...')
    const { stdout } = await execAsync(command, {
      timeout: 600000,
      maxBuffer: 1024 * 1024 * 50,
    })
    if (stdout && stdout.includes('ERROR')) {
      const errors = stdout.split('\n').filter(l => l.includes('ERROR'))
      const criticalErrors = errors.filter(
        e => !e.includes('does not exist') && !e.includes('already exists')
      )
      if (criticalErrors.length > 0) {
        console.warn('[RESTORE] Errores durante pg_restore:', criticalErrors.slice(0, 5).join('\n'))
      }
    }
    console.log('[RESTORE] Restauración completa finalizada')
  }
}

function getTablesForModules(modules: string[]): string[] {
  const moduleTableMap: Record<string, readonly string[]> = {
    tickets: TICKETS_MODULE_RESTORE_ORDER,
    news: NEWS_MODULE_RESTORE_ORDER,
    patrols: PATROLS_MODULE_RESTORE_ORDER,
    families: FAMILIES_MODULE_RESTORE_ORDER,
    audits: AUDITS_MODULE_RESTORE_ORDER,
    configurations: CONFIGURATIONS_MODULE_RESTORE_ORDER,
    users: USERS_MODULE_RESTORE_ORDER,
  }

  const tables: string[] = []
  for (const mod of modules) {
    const modTables = moduleTableMap[mod]
    if (modTables) {
      tables.push(...modTables)
    }
  }
  return [...new Set(tables)]
}

async function restoreFromSQL(backup: {
  id: string
  filename: string
  filepath: string
}): Promise<void> {
  console.log('[RESTORE] Iniciando restauración SQL...')

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL no configurada')

  const url = new URL(databaseUrl)
  const dbConfig = {
    host: url.hostname,
    port: url.port || '5432',
    database: url.pathname.slice(1),
    username: url.username,
    password: url.password,
  }

  let sourceFile = backup.filepath

  if (backup.filepath.endsWith('.gz')) {
    console.log('[RESTORE] Descomprimiendo respaldo...')
    const decompressedPath = backup.filepath.replace('.gz', '')
    await execAsync(`gunzip -c "${backup.filepath}" > "${decompressedPath}"`)
    sourceFile = decompressedPath
  }

  console.log(`[RESTORE] Archivo de respaldo: ${sourceFile}`)
  console.log(`[RESTORE] Conectando a ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`)

  try {
    await execAsync('which psql')
    console.log('[RESTORE] psql está disponible')
    const command = `PGPASSWORD="${dbConfig.password}" psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} -f "${sourceFile}" --single-transaction`
    const { stderr, stdout } = await execAsync(command, {
      timeout: 600000,
      maxBuffer: 1024 * 1024 * 100,
    })
    if (stdout) console.log('[RESTORE] Salida:', stdout)
    if (stderr && !stderr.includes('NOTICE') && !stderr.includes('WARNING')) {
      console.warn('[RESTORE] Advertencias:', stderr)
    }
    console.log('[RESTORE] Restauración SQL completada exitosamente!')
  } catch (psqlError) {
    console.error('[RESTORE] Error con psql:', psqlError)
    throw new Error(
      'No se pudo restaurar el respaldo. Asegúrate de que el contenedor de la app tenga postgresql-client instalado. Si usas Docker, reconstruye el contenedor con: docker compose -f docker-compose.dev.yml up --build'
    )
  } finally {
    if (sourceFile !== backup.filepath) {
      try {
        await unlink(sourceFile)
      } catch {}
    }
  }
}

async function restoreFromJSON(
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
    adminFamilyAssignments: 'admin_family_assignments',
    admin_family_assignments: 'admin_family_assignments',
    clientFamilyAssignments: 'client_family_assignments',
    client_family_assignments: 'client_family_assignments',
    technicianFamilyAssignments: 'technician_family_assignments',
    technician_family_assignments: 'technician_family_assignments',
    inventoryManagerFamilies: 'inventory_manager_families',
    inventory_manager_families: 'inventory_manager_families',
  }

  const mappedData: Record<string, any[]> = {}
  for (const [oldName, data] of Object.entries(normalizedData)) {
    const realName = tableMapping[oldName] ?? oldName
    mappedData[realName] = Array.isArray(data) ? data : []
  }

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
    'admin_family_assignments',
    'technician_family_assignments',
    'client_family_assignments',
    'inventory_manager_families',
    'user_settings',
    'notification_preferences',
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
    'contracts',
    'contract_lines',
    'contract_attachments',
    'resolution_plans',
    'resolution_tasks',
    'webhooks',
    'webhook_logs',
    'landing_page_content',
    'landing_page_services',
    'landing_page_banners',
    'email_queue',
    'category_analytics',
    'backups',
    'verification_tokens',
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
    },
    { timeout: 600000 }
  )
  console.log('Restauración JSON completada exitosamente')
}

async function restoreModuleFromJSON(
  moduleId: string,
  mappedData: Record<string, any[]>,
  restoreOrder: readonly string[],
  mode: RestoreMode = 'replace'
): Promise<void> {
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

        // Intentar createMany primero (más eficiente)
        try {
          await tx.$executeRaw(Prisma.sql`SAVEPOINT restore_table;`)
          if (mode === 'merge') {
            // skipDuplicates ignora conflictos → solo inserta los que no existen
            await (tx as any)[tableName].createMany({ data: processed, skipDuplicates: true })
          } else {
            await (tx as any)[tableName].createMany({ data: processed, skipDuplicates: true })
          }
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
    },
    { timeout: 600000 }
  )
  console.log(`Restauración JSON módulo ${moduleId} (${mode}) completada`)
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
