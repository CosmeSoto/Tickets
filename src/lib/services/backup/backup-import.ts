import { writeFile, stat, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { BackupInfo } from './backup-types'
import { BACKUP_DIR } from './backup-utils'

async function ensureBackupDirectory() {
  try {
    await mkdir(BACKUP_DIR, { recursive: true, mode: 0o755 })
  } catch {
  }
}

export async function importBackupFromFile(
  fileBuffer: Buffer,
  originalFilename: string
): Promise<BackupInfo> {
  await ensureBackupDirectory()

  let filename = originalFilename
  let detectedModule: string | null = null
  let encrypted = false
  let compressed = false

  if (filename.endsWith('.enc')) {
    encrypted = true
  }

  if (filename.includes('.gz')) {
    compressed = true
  }

  const moduleNames = [
    'tickets',
    'news',
    'patrols',
    'families',
    'users',
    'audits',
    'configurations',
  ]

  for (const mod of moduleNames) {
    if (filename.includes(mod)) {
      detectedModule = mod
      break
    }
  }

  if (!encrypted && !compressed && filename.endsWith('.json')) {
    try {
      const content = fileBuffer.toString('utf-8').slice(0, 500)
      const partial = JSON.parse(
        content.includes('"data"') ? content.split('"data"')[0] + '"data":{}}' : content
      )
      if (partial?.metadata?.module) {
        detectedModule = partial.metadata.module
      }
    } catch {
    }
  }

  if (!filename.startsWith('backup-')) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const ext = filename.split('.').slice(1).join('.') || 'sql'
    filename = detectedModule
      ? `backup-${detectedModule}-imported-${timestamp}.${ext}`
      : `backup-imported-${timestamp}.${ext}`
  }

  const filepath = join(BACKUP_DIR, filename)
  await writeFile(filepath, fileBuffer)

  const fileStats = await stat(filepath)

  if (fileStats.size === 0) {
    throw new Error('El archivo de respaldo está vacío')
  }

  let backupMetadata: any = null

  try {
    if (filename.endsWith('.json')) {
      const content = fileBuffer.toString('utf-8')
      const data = JSON.parse(content)
      const tables = data.data || data.tables || {}
      const tableCounts: Record<string, number> = {}
      for (const [table, records] of Object.entries(tables)) {
        if (Array.isArray(records)) {
          tableCounts[table] = records.length
        }
      }
      backupMetadata = {
        version: '1.0',
        createdAt: new Date().toISOString(),
        importedFrom: originalFilename,
        tableCounts,
        totalRecords: Object.values(tableCounts).reduce((a, b) => a + b, 0),
        fileSize: fileStats.size,
      }
    } else if (filename.endsWith('.dump')) {
      try {
        const pgToolsAvailable = await hasPgTools()
        if (pgToolsAvailable) {
          backupMetadata = await extractMetadataFromDump(filepath)
          backupMetadata.importedFrom = originalFilename
        }
      } catch (err) {
        console.error('Error extrayendo metadata de dump:', err)
      }
    }

    if (!backupMetadata) {
      backupMetadata = {
        version: '1.0',
        createdAt: new Date().toISOString(),
        importedFrom: originalFilename,
        tableCounts: {},
        totalRecords: 0,
        fileSize: fileStats.size,
      }
    }

    const metadataPath = `${filepath}.meta.json`
    await writeFile(metadataPath, JSON.stringify(backupMetadata, null, 2))
    console.log(`[BACKUP] Metadata para importación guardada en ${metadataPath}`)
  } catch (metaErr) {
    console.warn('[BACKUP] No se pudo generar metadata para importación:', metaErr)
  }

  const backupRecord = await prisma.backups.create({
    data: {
      id: randomUUID(),
      filename,
      filepath,
      size: fileStats.size,
      type: 'manual',
      status: 'completed',
      module: detectedModule,
      compressed,
      encrypted,
      createdAt: new Date(),
      metadata: backupMetadata ? JSON.stringify(backupMetadata) : null,
    },
  })

  await prisma.audit_logs.create({
    data: {
      id: randomUUID(),
      action: 'backup_imported',
      entityType: 'System',
      entityId: backupRecord.id,
      createdAt: new Date(),
      details: {
        filename,
        originalFilename,
        size: fileStats.size,
        detectedModule,
        encrypted,
        compressed,
        importedAt: new Date(),
      },
    },
  })

  return {
    id: backupRecord.id,
    filename: backupRecord.filename,
    size: fileStats.size,
    createdAt: backupRecord.createdAt,
    type: 'manual',
    status: 'completed',
    module: detectedModule,
    compressed,
    encrypted,
  }
}
