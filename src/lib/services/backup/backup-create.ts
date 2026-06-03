import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFile, stat, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { BackupInfo, BackupModuleId } from './backup-types'
import {
  BACKUP_DIR,
  hasPgTools,
  parseDatabaseUrl,
  getBackupConfig,
  sendBackupNotification,
  calculateChecksum,
  encryptFile,
} from './backup-utils'
import { generateAndSaveBackupMetadata } from './backup-metadata'
import { cleanOldBackups } from './backup-cleanup'
import { BackupCloudService, type CloudProvider } from '../backup-cloud-service'

const execAsync = promisify(exec)

async function ensureBackupDirectory() {
  try {
    await mkdir(BACKUP_DIR, { recursive: true, mode: 0o755 })
    console.log(`Directorio de respaldos asegurado: ${BACKUP_DIR}`)
  } catch (error) {
    console.error('Error al crear directorio de respaldos:', BACKUP_DIR, error)
    const altDir = join('/tmp', 'sistema-tickets-backups')
    console.log(`Intentando usar directorio alternativo: ${altDir}`)
    await mkdir(altDir, { recursive: true, mode: 0o755 })
    console.log(`Directorio alternativo asegurado: ${altDir}`)
  }
}

export async function createBackup(
  type: 'manual' | 'automatic' = 'manual',
  options?: { module?: BackupModuleId | null }
): Promise<BackupInfo> {
  if (type !== 'manual' && type !== 'automatic') {
    throw new Error('Tipo de respaldo inválido. Debe ser "manual" o "automatic"')
  }

  await ensureBackupDirectory()

  const moduleKey: BackupModuleId | null =
    options?.module != null &&
    ['tickets', 'news', 'patrols', 'families', 'audits', 'configurations', 'users'].includes(
      options.module
    )
      ? options.module
      : null

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const pgToolsAvailable = await hasPgTools()
  const filename = pgToolsAvailable ? `backup-${timestamp}.dump` : `backup-${timestamp}.json`
  const filepath = join(BACKUP_DIR, filename)

  const backupRecord = await prisma.backups.create({
    data: {
      id: randomUUID(),
      filename,
      filepath,
      size: 0,
      type,
      status: 'in_progress',
      module: moduleKey,
      createdAt: new Date(),
    },
  })

  try {
    const config = await getBackupConfig()
    const dbConfig = parseDatabaseUrl()
    console.log(
      `[BACKUP] Iniciando: ${filename} (método: ${pgToolsAvailable ? 'pg_dump' : 'prisma'})`
    )

    if (pgToolsAvailable) {
      const command = `PGPASSWORD="${dbConfig.password}" pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} -Fc --no-owner --no-privileges --verbose -f "${filepath}"`
      await execAsync(command, { timeout: 600000, maxBuffer: 1024 * 1024 * 50 })
      console.log('[BACKUP] pg_dump completado exitosamente')
    } else {
      console.warn('[BACKUP] pg_dump no disponible, usando fallback Prisma/JSON')
      await createBackupWithPrisma(filepath)
    }

    const fileStats = await stat(filepath)
    if (fileStats.size === 0) {
      throw new Error('El respaldo está vacío')
    }
    console.log(`[BACKUP] Archivo creado: ${fileStats.size} bytes`)

    const backupMetadata = await generateAndSaveBackupMetadata(filepath, fileStats.size)

    let checksum: string | undefined
    try {
      if (config.verifyIntegrity) {
        checksum = await calculateChecksum(filepath)
      }
    } catch (error) {
      console.warn('No se pudo calcular checksum:', error)
    }

    let finalFilepath = filepath
    let finalFilename = filename
    let encrypted = false

    if (config.encryption) {
      try {
        finalFilepath = await encryptFile(filepath)
        finalFilename = filename + '.enc'
        encrypted = true
        console.log('[BACKUP] Encriptado exitosamente')
      } catch (encryptionError) {
        console.warn('Error en encriptación, usando archivo sin encriptar:', encryptionError)
      }
    }

    const finalStats = await stat(finalFilepath)
    await prisma.backups.update({
      where: { id: backupRecord.id },
      data: {
        filename: finalFilename,
        filepath: finalFilepath,
        size: finalStats.size,
        status: 'completed',
        checksum: checksum ?? null,
        compressed: pgToolsAvailable,
        encrypted,
        metadata: backupMetadata ? JSON.stringify(backupMetadata) : null,
      },
    })

    await cleanOldBackups()

    if (config.cloudStorage && config.cloudProvider) {
      uploadToCloud(backupRecord.id, finalFilepath, config.cloudProvider as any).catch(err =>
        console.error('[CLOUD] Error subiendo respaldo:', err)
      )
    }

    try {
      if (config.notifications) {
        await sendBackupNotification('success', {
          filename: finalFilename,
          size: finalStats.size,
          type,
        })
      }
    } catch (error) {
      console.warn('No se pudo enviar notificación:', error)
    }

    try {
      await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          action: 'backup_created',
          entityType: 'System',
          entityId: backupRecord.id,
          createdAt: new Date(),
          details: {
            filename: finalFilename,
            size: finalStats.size,
            type,
            method: pgToolsAvailable ? 'pg_dump_custom' : 'prisma_json',
            checksum: checksum || null,
          },
        },
      })
    } catch (error) {
      console.warn('No se pudo registrar en auditoría:', error)
    }

    return {
      id: backupRecord.id,
      filename: finalFilename,
      size: finalStats.size,
      createdAt: backupRecord.createdAt,
      type: backupRecord.type as 'manual' | 'automatic',
      status: 'completed',
      checksum,
      compressed: pgToolsAvailable,
      encrypted,
      module: moduleKey,
    }
  } catch (error) {
    console.error('[BACKUP] Error:', error)
    await prisma.backups.update({
      where: { id: backupRecord.id },
      data: {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
    })
    try {
      const config = await getBackupConfig()
      if (config.notifications) {
        await sendBackupNotification('error', {
          filename,
          error: error instanceof Error ? error.message : 'Error desconocido',
          type,
        })
      }
    } catch {}
    throw error
  }
}

async function createBackupWithPrisma(filepath: string): Promise<void> {
  try {
    console.log('Creando respaldo usando método alternativo con Prisma')

    const backupData: Record<string, any[]> = {}

    const fetchTable = async (name: string, fetcher: () => Promise<any[]>) => {
      try {
        backupData[name] = await fetcher()
        console.log(`  ✓ ${name}: ${backupData[name].length} registros`)
      } catch (err) {
        console.warn(`  ⚠ ${name}: no se pudo exportar —`, (err as Error).message)
        backupData[name] = []
      }
    }

    await fetchTable('users', () => prisma.users.findMany())
    await fetchTable('departments', () => prisma.departments.findMany())
    await fetchTable('families', () => prisma.families.findMany())
    await fetchTable('categories', () => prisma.categories.findMany())
    await fetchTable('system_settings', () => prisma.system_settings.findMany())
    await fetchTable('system_modules', () => prisma.system_modules.findMany())
    await fetchTable('site_config', () => prisma.site_config.findMany())
    await fetchTable('pages', () => prisma.pages.findMany())
    await fetchTable('oauth_configs', () => prisma.oauth_configs.findMany())
    await fetchTable('equipment_types', () => prisma.equipment_types.findMany())
    await fetchTable('suppliers', () => prisma.suppliers.findMany())
    await fetchTable('warehouses', () => prisma.warehouses.findMany())

    await fetchTable('admin_family_assignments', () => prisma.admin_family_assignments.findMany())
    await fetchTable('technician_family_assignments', () =>
      prisma.technician_family_assignments.findMany()
    )
    await fetchTable('client_family_assignments', () => prisma.client_family_assignments.findMany())
    await fetchTable('inventory_manager_families', () =>
      prisma.inventory_manager_families.findMany()
    )

    await fetchTable('user_settings', () => prisma.user_settings.findMany())
    await fetchTable('notification_preferences', () => prisma.notification_preferences.findMany())
    await fetchTable('technician_assignments', () => prisma.technician_assignments.findMany())
    await fetchTable('oauth_accounts', () => prisma.oauth_accounts.findMany())
    await fetchTable('sessions', () => prisma.sessions.findMany())
    await fetchTable('accounts', () => prisma.accounts.findMany())
    await fetchTable('password_reset_tokens', () => prisma.password_reset_tokens.findMany())

    await fetchTable('tickets', () => prisma.tickets.findMany())
    await fetchTable('comments', () => prisma.comments.findMany())
    await fetchTable('attachments', () => prisma.attachments.findMany())
    await fetchTable('ticket_history', () => prisma.ticket_history.findMany())
    await fetchTable('ticket_ratings', () => prisma.ticket_ratings.findMany())
    await fetchTable('ticket_collaborators', () => prisma.ticket_collaborators.findMany())
    await fetchTable('notifications', () => prisma.notifications.findMany())
    await fetchTable('audit_logs', () => prisma.audit_logs.findMany())

    await fetchTable('sla_policies', () => prisma.sla_policies.findMany())
    await fetchTable('sla_violations', () => prisma.sla_violations.findMany())
    await fetchTable('ticket_sla_metrics', () => prisma.ticket_sla_metrics.findMany())

    await fetchTable('knowledge_articles', () => prisma.knowledge_articles.findMany())
    await fetchTable('article_votes', () => prisma.article_votes.findMany())
    await fetchTable('ticket_knowledge_articles', () => prisma.ticket_knowledge_articles.findMany())

    await fetchTable('equipment', () => prisma.equipment.findMany())
    await fetchTable('equipment_assignments', () => prisma.equipment_assignments.findMany())
    await fetchTable('equipment_attachments', () => prisma.equipment_attachments.findMany())
    await fetchTable('maintenance_records', () => prisma.maintenance_records.findMany())
    await fetchTable('software_licenses', () => prisma.software_licenses.findMany())
    await fetchTable('license_attachments', () => prisma.license_attachments.findMany())
    await fetchTable('consumables', () => prisma.consumables.findMany())
    await fetchTable('stock_movements', () => prisma.stock_movements.findMany())
    await fetchTable('delivery_acts', () => prisma.delivery_acts.findMany())
    await fetchTable('return_acts', () => prisma.return_acts.findMany())
    await fetchTable('decommission_requests', () => prisma.decommission_requests.findMany())
    await fetchTable('decommission_acts', () => prisma.decommission_acts.findMany())
    await fetchTable('decommission_attachments', () => prisma.decommission_attachments.findMany())

    await fetchTable('contracts', () => prisma.contracts.findMany())
    await fetchTable('contract_lines', () => prisma.contract_lines.findMany())
    await fetchTable('contract_attachments', () => prisma.contract_attachments.findMany())

    await fetchTable('resolution_plans', () => prisma.resolution_plans.findMany())
    await fetchTable('resolution_tasks', () => prisma.resolution_tasks.findMany())

    await fetchTable('webhooks', () => prisma.webhooks.findMany())
    await fetchTable('webhook_logs', () => prisma.webhook_logs.findMany())

    await fetchTable('landing_page_content', () => prisma.landing_page_content.findMany())
    await fetchTable('landing_page_services', () => prisma.landing_page_services.findMany())
    await fetchTable('landing_page_banners', () => prisma.landing_page_banners.findMany())

    await fetchTable('email_queue', () => prisma.email_queue.findMany())
    await fetchTable('category_analytics', () => prisma.category_analytics.findMany())
    await fetchTable('backups', () => prisma.backups.findMany())
    await fetchTable('verification_tokens', () => prisma.verification_tokens.findMany())

    const output = JSON.stringify(
      {
        metadata: {
          version: '2.0',
          timestamp: new Date().toISOString(),
          method: 'prisma',
          tables: Object.keys(backupData),
          totalRecords: Object.values(backupData).reduce((s, t) => s + t.length, 0),
        },
        data: backupData,
      },
      null,
      2
    )
    await writeFile(filepath, output, 'utf-8')
    console.log(
      `Backup Prisma creado: ${Object.keys(backupData).length} tablas, ${output.length} bytes`
    )
  } catch (error) {
    console.error('Error en backup alternativo:', error)
    throw error
  }
}

async function uploadToCloud(
  backupId: string,
  filepath: string,
  provider: CloudProvider
): Promise<void> {
  try {
    console.log(`[CLOUD] Iniciando subida a ${provider}: ${filepath}`)
    const result = await BackupCloudService.uploadBackup(backupId, filepath, provider)
    await prisma.audit_logs
      .create({
        data: {
          id: randomUUID(),
          action: 'backup_uploaded_cloud',
          entityType: 'System',
          entityId: backupId,
          createdAt: new Date(),
          details: {
            provider: result.provider,
            fileId: result.fileId,
            fileName: result.fileName,
            webViewLink: result.webViewLink ?? null,
            size: result.size,
          },
        },
      })
      .catch(() => {})
    console.log(`[CLOUD] Backup subido exitosamente a ${provider}: ${result.fileId}`)
  } catch (error) {
    console.error(`[CLOUD] Error subiendo respaldo a ${provider}:`, error)
  }
}
