import { writeFile, readFile, stat } from 'fs/promises'
import { exec } from 'child_process'
import { promisify } from 'util'
import prisma from '@/lib/prisma'
import { BackupMetadata } from './backup-types'

const execAsync = promisify(exec)

export async function generateAndSaveBackupMetadata(
  filepath: string,
  fileSize: number
): Promise<BackupMetadata | null> {
  try {
    const tableCounts: Record<string, number> = {}

    const result = await prisma.$queryRaw`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `

    const tables = (result as Array<{ tablename: string }>).map(row => row.tablename)

    for (const table of tables) {
      try {
        const countResult = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${table}"`)
        const count = Number((countResult as Array<{ count: number }>)[0].count)
        tableCounts[table] = count
      } catch {
        continue
      }
    }

    const metadata: BackupMetadata = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      tableCounts,
      totalRecords: Object.values(tableCounts).reduce((a, b) => a + b, 0),
      fileSize,
    }

    const metadataPath = `${filepath}.meta.json`
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2))
    console.log(`Metadata guardada en ${metadataPath}`)
    return metadata
  } catch (error) {
    console.warn('No se pudo generar metadata:', error)
    return null
  }
}

export async function loadBackupMetadata(
  filepath: string,
  metadataFromDb?: string | null
): Promise<BackupMetadata | null> {
  if (metadataFromDb) {
    try {
      return JSON.parse(metadataFromDb) as BackupMetadata
    } catch {
      console.warn('Error parsing metadata from DB')
    }
  }

  try {
    const metadataPath = `${filepath}.meta.json`
    const content = await readFile(metadataPath, 'utf-8')
    return JSON.parse(content) as BackupMetadata
  } catch {
    console.warn('No metadata file found')
    return null
  }
}

export async function extractMetadataFromDump(filepath: string): Promise<BackupMetadata> {
  let tableNames: string[] = []
  let tableCounts: Record<string, number> = {}

  try {
    const { stdout } = await execAsync(`pg_restore --list "${filepath}"`)
    const lines = stdout.split('\n')
    for (const line of lines) {
      const parts = line.trim().split(/\s+/)
      if (parts.length >= 3 && parts[1] === 'TABLE') {
        const tableName = parts[2]
        if (tableName && !tableName.startsWith('pg_') && !tableName.startsWith('sql_')) {
          tableNames.push(tableName)
        }
      }
    }
  } catch {
    console.warn('Could not extract table names from dump')
  }

  for (const table of tableNames) {
    try {
      let count = 0
      try {
        const { stdout: dataOutput } = await execAsync(
          `pg_restore -a --data-only -t "${table}" "${filepath}" 2>&1`
        )

        let insideCopy = false
        for (const line of dataOutput.split('\n')) {
          const trimmed = line.trim()
          if (trimmed.startsWith('COPY ')) {
            insideCopy = true
            continue
          }
          if (trimmed === '\\.' || trimmed === '') {
            insideCopy = false
            continue
          }
          if (insideCopy && trimmed.length > 0 && !trimmed.startsWith('--')) {
            count++
          }
        }
      } catch {
        count = 0
      }

      tableCounts[table] = count
    } catch {
      tableCounts[table] = 0
    }
  }

  const fileStats = await stat(filepath)

  return {
    version: '1.0',
    createdAt: new Date().toISOString(),
    tableCounts,
    totalRecords: Object.values(tableCounts).reduce((a, b) => a + b, 0),
    fileSize: fileStats.size,
  }
}
