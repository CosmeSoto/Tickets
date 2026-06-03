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

    const isDump = filepath.endsWith('.dump')

    const metadata: BackupMetadata = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      tableCounts,
      totalRecords: Object.values(tableCounts).reduce((a, b) => a + b, 0),
      fileSize,
      dumpFormat: isDump ? 'pg_dump_custom' : 'json',
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
  let dbVersion: string | undefined

  try {
    const { stdout } = await execAsync(`pg_restore --list "${filepath}" 2>/dev/null`)
    const lines = stdout.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith(';')) continue

      // Capturar versión de PostgreSQL del dump si está en los comentarios
      const versionMatch = trimmed.match(/PostgreSQL\s+([\d.]+)/)
      if (versionMatch && !dbVersion) {
        dbVersion = versionMatch[1]
      }

      // pg_restore --list format: "3456; 0 0 TABLE DATA public users tickets_user"
      const tableDataMatch = trimmed.match(/TABLE DATA\s+(\w+)\s+(\S+)/)
      if (tableDataMatch) {
        const schema = tableDataMatch[1]
        const tableName = tableDataMatch[2]
        if (schema === 'public' && !tableName.startsWith('pg_')) {
          // Inicializar en 0 — luego contaremos filas reales del dump
          tableCounts[tableName] = 0
        }
      }
    }

    // Contar filas reales extrayendo el dump y parseando los bloques COPY
    // Esto es más lento pero da los conteos correctos del backup, no de la BD actual
    if (Object.keys(tableCounts).length > 0) {
      try {
        const tableFlags = Object.keys(tableCounts)
          .map(t => `--table="${t}"`)
          .join(' ')
        const { stdout: dumpSql } = await execAsync(
          `pg_restore --data-only --no-owner --no-privileges -f - ${tableFlags} "${filepath}" 2>/dev/null`,
          { timeout: 120000, maxBuffer: 1024 * 1024 * 200 }
        ).catch((err: any) => ({ stdout: err.stdout || '' }))

        if (dumpSql) {
          // Parsear bloques COPY para contar filas por tabla
          const copyRegex = /^COPY\s+(?:public\.)?("?[\w]+"?)\s*\([^)]+\)\s+FROM\s+stdin\s*;/im
          let currentTable: string | null = null
          let rowCount = 0

          for (const line of dumpSql.split('\n')) {
            const match = line.match(
              /^COPY\s+(?:public\.)?("?[\w]+"?)\s*\([^)]+\)\s+FROM\s+stdin\s*;/i
            )
            if (match) {
              if (currentTable !== null) {
                tableCounts[currentTable.replace(/"/g, '')] = rowCount
              }
              currentTable = match[1].replace(/"/g, '')
              rowCount = 0
            } else if (line === '\\.') {
              if (currentTable !== null) {
                tableCounts[currentTable] = rowCount
                currentTable = null
                rowCount = 0
              }
            } else if (currentTable !== null && line.trim()) {
              rowCount++
            }
          }
          // Cerrar último bloque si no terminó con \.
          if (currentTable !== null) {
            tableCounts[currentTable] = rowCount
          }
        }
      } catch {
        // Si falla el conteo real, dejar en 0 — es mejor que contar la BD actual
        console.warn('[METADATA] No se pudo contar filas del dump, usando 0')
      }
    }
  } catch (err) {
    console.warn('[METADATA] pg_restore --list falló:', err)
    // Fallback mínimo sin consultar la BD actual
  }

  const fileStats = await stat(filepath)
  const totalRecords = Object.values(tableCounts).reduce((a, b) => a + b, 0)

  return {
    version: '1.0',
    createdAt: new Date().toISOString(),
    tableCounts,
    totalRecords,
    fileSize: fileStats.size,
    dumpFormat: 'pg_dump_custom',
    ...(dbVersion && { dbVersion }),
  }
}
