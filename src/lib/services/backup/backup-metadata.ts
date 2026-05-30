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
  const tableCounts: Record<string, number> = {}

  try {
    const { stdout } = await execAsync(`pg_restore --list "${filepath}" 2>/dev/null`)
    const lines = stdout.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith(';')) continue

      // pg_restore --list format examples:
      // "3456; 0 0 TABLE DATA public users tickets_user"
      // "3457; 2200 16384 TABLE public users tickets_user"
      const tableDataMatch = trimmed.match(/TABLE DATA\s+(\w+)\s+(\w+)/)
      if (tableDataMatch) {
        const schema = tableDataMatch[1]
        const tableName = tableDataMatch[2]
        if (schema === 'public' && !tableName.startsWith('pg_')) {
          tableCounts[tableName] = 0
        }
      }
    }

    // Si encontramos tablas, contar registros consultando la BD actual
    // (el dump fue creado de esta misma BD, así que los conteos son una buena referencia)
    if (Object.keys(tableCounts).length > 0) {
      for (const table of Object.keys(tableCounts)) {
        try {
          const result = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
            `SELECT COUNT(*) as count FROM "${table}"`
          )
          tableCounts[table] = Number(result[0]?.count ?? 0)
        } catch {
          // Tabla puede no existir, dejar en 0
        }
      }
    }
  } catch (err) {
    console.warn('[METADATA] pg_restore --list falló, intentando conteo directo de BD')

    // Fallback: contar directamente de la BD (asumimos que el dump tiene lo mismo)
    try {
      const result = await prisma.$queryRaw`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
      `
      const tables = (result as Array<{ tablename: string }>).map(row => row.tablename)

      for (const table of tables) {
        try {
          const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
            `SELECT COUNT(*) as count FROM "${table}"`
          )
          tableCounts[table] = Number(countResult[0]?.count ?? 0)
        } catch {
          continue
        }
      }
    } catch (dbErr) {
      console.warn('[METADATA] No se pudo contar registros:', dbErr)
    }
  }

  const fileStats = await stat(filepath)
  const totalRecords = Object.values(tableCounts).reduce((a, b) => a + b, 0)

  return {
    version: '1.0',
    createdAt: new Date().toISOString(),
    tableCounts,
    totalRecords,
    fileSize: fileStats.size,
  }
}
