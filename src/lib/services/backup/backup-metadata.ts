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
  const tableNames: string[] = []
  const tableCounts: Record<string, number> = {}

  try {
    const { stdout } = await execAsync(`pg_restore --list "${filepath}"`)
    console.log('pg_restore --list output:', stdout.substring(0, 500))
    const lines = stdout.split('\n')
    for (const line of lines) {
      const parts = line.trim().split(/\s+/)
      // pg_restore --list format: Archive ID, TOC entry type, object name
      if (parts.length >= 3 && (parts[1] === 'TABLE' || parts[1] === 'TABLE DATA')) {
        let tableName: string | undefined
        if (parts[1] === 'TABLE') {
          tableName = parts[2]
        } else if (parts[1] === 'TABLE DATA') {
          tableName = parts[2]
        }

        if (tableName && !tableName.startsWith('pg_') && !tableName.startsWith('sql_')) {
          if (!tableNames.includes(tableName)) {
            tableNames.push(tableName)
          }
        }
      }
    }
    console.log('Extracted table names:', tableNames)
  } catch (err) {
    console.warn('Could not extract table names from dump:', err)
  }

  for (const table of tableNames) {
    try {
      let count = 0
      try {
        const { stdout: dataOutput, stderr } = await execAsync(
          `pg_restore -a --data-only -t "${table}" "${filepath}" 2>&1`
        )

        console.log(`Table ${table} data output first 300 chars:`, dataOutput.substring(0, 300))
        if (stderr) {
          console.warn(`Table ${table} stderr:`, stderr)
        }

        let insideCopy = false
        for (const line of dataOutput.split('\n')) {
          const trimmed = line.trim()
          if (trimmed.startsWith('COPY ')) {
            insideCopy = true
            continue
          }
          if (trimmed === '\\.') {
            insideCopy = false
            continue
          }
          if (insideCopy && trimmed.length > 0 && !trimmed.startsWith('--')) {
            count++
          }
        }
      } catch (err) {
        console.warn(`Error getting data for table ${table}:`, err)
        count = 0
      }

      tableCounts[table] = count
      console.log(`Table ${table} count: ${count}`)
    } catch (err) {
      console.warn(`Error processing table ${table}:`, err)
      tableCounts[table] = 0
    }
  }

  const fileStats = await stat(filepath)
  const totalRecords = Object.values(tableCounts).reduce((a, b) => a + b, 0)

  console.log('Total records:', totalRecords)
  console.log('Table counts:', tableCounts)

  return {
    version: '1.0',
    createdAt: new Date().toISOString(),
    tableCounts,
    totalRecords,
    fileSize: fileStats.size,
  }
}
