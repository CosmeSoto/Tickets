import { exec } from 'child_process'
import { promisify } from 'util'
import { stat, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { BackupInfo, BackupCreateMode, BackupKind } from './backup-types'
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
import {
  isPgBackRestAvailable,
  runPgBackRestBackup,
  buildPgBackRestFileRef,
  syncPgBackRestToDatabase,
} from './backup-engine'

const execAsync = promisify(exec)

async function ensureBackupDirectory() {
  await mkdir(BACKUP_DIR, { recursive: true, mode: 0o755 })
}

function resolveInfrastructureKind(
  mode: BackupCreateMode,
  type: 'manual' | 'automatic'
): BackupKind {
  if (mode === 'export') return 'export'
  // Manual infrastructure backup defaults to full; cron handles diff/full logic externally
  if (type === 'manual') return 'full'
  return 'diff'
}

export async function createBackup(
  type: 'manual' | 'automatic' = 'manual',
  options?: { mode?: BackupCreateMode; backupKind?: BackupKind }
): Promise<BackupInfo> {
  if (type !== 'manual' && type !== 'automatic') {
    throw new Error('Tipo de respaldo inválido. Debe ser "manual" o "automatic"')
  }

  const mode: BackupCreateMode = options?.mode ?? 'infrastructure'
  const backupKind = options?.backupKind ?? resolveInfrastructureKind(mode, type)

  if (mode === 'export') {
    return createExportBackup(type)
  }

  return createInfrastructureBackup(type, backupKind)
}

async function createInfrastructureBackup(
  type: 'manual' | 'automatic',
  backupKind: BackupKind
): Promise<BackupInfo> {
  if (!(await isPgBackRestAvailable())) {
    throw new Error(
      'pgBackRest no está disponible. En el servidor ejecuta: ./docker/scripts/fix-pgbackrest.sh — o revisa logs de backup-worker y postgres.'
    )
  }

  const placeholderId = randomUUID()
  const placeholderLabel = `pending-${Date.now()}`
  const backupRecord = await prisma.backups.create({
    data: {
      id: placeholderId,
      filename: `${placeholderLabel}.pgbackrest`,
      filepath: buildPgBackRestFileRef(placeholderLabel),
      size: 0,
      type,
      status: 'in_progress',
      engine: 'pgbackrest',
      backupKind,
      label: null,
      createdAt: new Date(),
    },
  })

  try {
    const config = await getBackupConfig()
    console.log(`[BACKUP] pgBackRest ${backupKind} (${type})`)

    const result = await runPgBackRestBackup(
      backupKind === 'export' ? 'full' : (backupKind as 'full' | 'diff' | 'incr')
    )

    if (!result.label) {
      throw new Error('pgBackRest no devolvió etiqueta de respaldo')
    }

    let checksum: string | undefined
    if (config.verifyIntegrity) {
      try {
        await import('./backup-engine').then(m => m.verifyPgBackRestRepo())
        checksum = `pgbackrest:${result.label}`
      } catch (error) {
        console.warn('[BACKUP] verify pgBackRest:', error)
      }
    }

    const metadata = {
      version: '3.0',
      createdAt: new Date().toISOString(),
      tableCounts: {},
      totalRecords: 0,
      fileSize: result.size,
      ...result.metadata,
    }

    await prisma.backups.update({
      where: { id: backupRecord.id },
      data: {
        filename: `${result.label}.pgbackrest`,
        filepath: buildPgBackRestFileRef(result.label),
        size: result.size,
        status: 'completed',
        checksum: checksum ?? null,
        compressed: true,
        encrypted: false,
        label: result.label,
        metadata: JSON.stringify(metadata),
        error: null,
      },
    })

    await syncPgBackRestToDatabase()
    await cleanOldBackups()

    if (config.notifications) {
      await sendBackupNotification('success', {
        filename: `${result.label}.pgbackrest`,
        size: result.size,
        type,
      }).catch(() => {})
    }

    await prisma.audit_logs
      .create({
        data: {
          id: randomUUID(),
          action: 'backup_created',
          entityType: 'System',
          entityId: backupRecord.id,
          createdAt: new Date(),
          details: {
            engine: 'pgbackrest',
            backupKind,
            label: result.label,
            size: result.size,
            type,
          },
        },
      })
      .catch(() => {})

    return {
      id: backupRecord.id,
      filename: `${result.label}.pgbackrest`,
      size: result.size,
      createdAt: backupRecord.createdAt,
      type,
      status: 'completed',
      checksum,
      compressed: true,
      encrypted: false,
      engine: 'pgbackrest',
      backupKind,
      label: result.label,
    }
  } catch (error) {
    console.error('[BACKUP] pgBackRest error:', error)
    await prisma.backups.update({
      where: { id: backupRecord.id },
      data: {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
    })
    const config = await getBackupConfig().catch(() => null)
    if (config?.notifications) {
      await sendBackupNotification('error', {
        filename: backupRecord.filename,
        error: error instanceof Error ? error.message : 'Error desconocido',
        type,
      }).catch(() => {})
    }
    throw error
  }
}

async function createExportBackup(type: 'manual' | 'automatic'): Promise<BackupInfo> {
  await ensureBackupDirectory()

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const pgToolsAvailable = await hasPgTools()
  if (!pgToolsAvailable) {
    throw new Error(
      'Exportación requiere pg_dump (postgresql-client). Usa Docker o instala postgresql-client.'
    )
  }

  const filename = `export-${timestamp}.dump`
  const filepath = join(BACKUP_DIR, filename)

  const backupRecord = await prisma.backups.create({
    data: {
      id: randomUUID(),
      filename,
      filepath,
      size: 0,
      type,
      status: 'in_progress',
      engine: 'export',
      backupKind: 'export',
      createdAt: new Date(),
    },
  })

  try {
    const config = await getBackupConfig()
    const dbConfig = parseDatabaseUrl()
    const command = `PGPASSWORD="${dbConfig.password}" pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} -Fc --no-owner --no-privileges -f "${filepath}"`
    await execAsync(command, { timeout: 600_000, maxBuffer: 50 * 1024 * 1024 })

    const fileStats = await stat(filepath)
    if (fileStats.size === 0) throw new Error('La exportación está vacía')

    const backupMetadata = await generateAndSaveBackupMetadata(filepath, fileStats.size)
    let checksum: string | undefined
    if (config.verifyIntegrity) {
      checksum = await calculateChecksum(filepath).catch(() => undefined)
    }

    let finalFilepath = filepath
    let finalFilename = filename
    let encrypted = false

    if (config.encryption) {
      finalFilepath = await encryptFile(filepath)
      finalFilename = `${filename}.enc`
      encrypted = true
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
        compressed: true,
        encrypted,
        metadata: backupMetadata ? JSON.stringify(backupMetadata) : null,
      },
    })

    await cleanOldBackups()

    if (config.cloudStorage && config.cloudProvider) {
      uploadToCloud(backupRecord.id, finalFilepath, config.cloudProvider as CloudProvider).catch(
        err => console.error('[CLOUD]', err)
      )
    }

    if (config.notifications) {
      await sendBackupNotification('success', {
        filename: finalFilename,
        size: finalStats.size,
        type,
      }).catch(() => {})
    }

    return {
      id: backupRecord.id,
      filename: finalFilename,
      size: finalStats.size,
      createdAt: backupRecord.createdAt,
      type,
      status: 'completed',
      checksum,
      compressed: true,
      encrypted,
      engine: 'export',
      backupKind: 'export',
    }
  } catch (error) {
    await prisma.backups.update({
      where: { id: backupRecord.id },
      data: {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
    })
    throw error
  }
}

async function uploadToCloud(
  backupId: string,
  filepath: string,
  provider: CloudProvider
): Promise<void> {
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
}
