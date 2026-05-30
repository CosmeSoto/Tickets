import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { readFile, stat } from 'fs/promises'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const backupId = (await params).id

    if (!backupId) {
      return NextResponse.json({ error: 'ID de backup requerido' }, { status: 400 })
    }

    // Buscar el backup en la base de datos
    const backup = await prisma.backups.findUnique({
      where: { id: backupId },
    })

    if (!backup) {
      return NextResponse.json({ error: 'Backup no encontrado' }, { status: 404 })
    }

    if (backup.status !== 'completed') {
      return NextResponse.json({ error: 'El backup no está completado' }, { status: 400 })
    }

    try {
      // Verificar que el archivo existe y obtener información
      const fileStats = await stat(backup.filepath)

      // Generar preview basado en el tipo de backup
      let preview

      if (backup.filepath.endsWith('.json')) {
        // Para backups JSON (método alternativo con Prisma o módulo)
        preview = await generateJsonBackupPreview(backup.filepath)
      } else {
        // Para backups SQL (método tradicional con pg_dump)
        preview = await generateSqlBackupPreview(backup, fileStats)
      }

      return NextResponse.json({
        success: true,
        data: preview,
      })
    } catch (fileError) {
      console.error('Error accessing backup file:', fileError)
      return NextResponse.json(
        { error: 'El archivo de backup no está disponible' },
        { status: 404 }
      )
    }
  } catch (error) {
    console.error('Error generating backup preview:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error al generar preview del backup',
      },
      { status: 500 }
    )
  }
}

async function generateJsonBackupPreview(filepath: string) {
  try {
    const content = await readFile(filepath, 'utf-8')
    const backupData = JSON.parse(content)

    const tables: Array<{ name: string; recordCount: number; size: string }> = []
    let totalRecords = 0

    const payloadTables =
      backupData.data && typeof backupData.data === 'object'
        ? backupData.data
        : backupData.tables && typeof backupData.tables === 'object'
          ? backupData.tables
          : null

    if (payloadTables) {
      for (const [tableName, tableData] of Object.entries(payloadTables)) {
        if (Array.isArray(tableData)) {
          const recordCount = tableData.length
          totalRecords += recordCount

          tables.push({
            name: tableName,
            recordCount,
            size: `${Math.max(1, Math.round(JSON.stringify(tableData).length / 1024))} KB`,
          })
        }
      }
    }

    const meta = backupData.metadata
    const moduleLabel =
      meta?.module === 'tickets'
        ? 'Módulo tickets'
        : meta?.module
          ? `Módulo ${meta.module}`
          : 'JSON (Prisma)'

    return {
      tables: tables.sort((a, b) => b.recordCount - a.recordCount),
      totalRecords,
      totalSize: `${Math.max(1, Math.round(JSON.stringify(backupData).length / 1024))} KB`,
      databaseVersion: meta?.version || backupData.version || 'JSON Export',
      createdAt: meta?.timestamp || backupData.timestamp || new Date().toISOString(),
      backupType: moduleLabel,
    }
  } catch (error) {
    console.error('Error parsing JSON backup:', error)
    throw new Error('Error al analizar el backup JSON')
  }
}

async function generateSqlBackupPreview(backup: any, fileStats: any) {
  try {
    // Primero intentar leer el archivo de metadata
    const metadataPath = `${backup.filepath}.meta.json`
    try {
      const metadataContent = await readFile(metadataPath, 'utf-8')
      const metadata = JSON.parse(metadataContent)

      if (metadata.tableCounts) {
        const tables = Object.entries(metadata.tableCounts)
          .map(([name, recordCount]) => ({
            name,
            recordCount: Number(recordCount),
            size: 'Desde backup',
          }))
          .filter(t => t.recordCount > 0)

        return {
          tables: tables.sort((a, b) => b.recordCount - a.recordCount),
          totalRecords: metadata.totalRecords || 0,
          totalSize: formatFileSize(fileStats.size),
          databaseVersion: 'PostgreSQL (SQL Dump)',
          createdAt: metadata.createdAt || backup.createdAt,
          backupType: 'SQL (pg_dump)',
        }
      }
    } catch (metaErr) {
      console.warn('No se pudo leer metadata del backup:', metaErr)
    }

    // Fallback: intentar usar pg_restore para obtener la información REAL del backup
    const hasPgRestore = await checkPgRestoreAvailable()

    if (hasPgRestore) {
      const tableCounts = await getTableCountsFromBackup(backup.filepath)

      if (Object.keys(tableCounts).length > 0) {
        const tables = Object.entries(tableCounts)
          .map(([name, recordCount]) => ({
            name,
            recordCount,
            size: 'Desde backup',
          }))
          .filter(t => t.recordCount > 0)

        const totalRecords = tables.reduce((sum, t) => sum + t.recordCount, 0)

        return {
          tables: tables.sort((a, b) => b.recordCount - a.recordCount),
          totalRecords,
          totalSize: formatFileSize(fileStats.size),
          databaseVersion: 'PostgreSQL (SQL Dump)',
          createdAt: backup.createdAt,
          backupType: 'SQL (pg_dump)',
        }
      }
    }

    // Fallback final: info básica
    return {
      tables: [{ name: 'backup_completo', recordCount: 1, size: formatFileSize(fileStats.size) }],
      totalRecords: 1,
      totalSize: formatFileSize(fileStats.size),
      databaseVersion: 'PostgreSQL',
      createdAt: backup.createdAt,
      backupType: 'SQL (pg_dump)',
    }
  } catch (error) {
    console.error('Error generating SQL backup preview:', error)

    // Fallback: preview básico
    return {
      tables: [{ name: 'database_backup', recordCount: 1, size: 'Completo' }],
      totalRecords: 1,
      totalSize: formatFileSize(fileStats.size),
      databaseVersion: 'PostgreSQL',
      createdAt: backup.createdAt,
      backupType: 'SQL (pg_dump)',
    }
  }
}

async function checkPgRestoreAvailable(): Promise<boolean> {
  try {
    await execAsync('pg_restore --version')
    return true
  } catch {
    return false
  }
}

async function getTableCountsFromBackup(filepath: string): Promise<Record<string, number>> {
  try {
    const { stdout } = await execAsync(`pg_restore --list "${filepath}"`)

    // Parsear la salida de pg_restore --list para encontrar las tablas
    // El formato tiene líneas como: 2216; 0 1259 16873 TABLE public users postgres
    const tableCounts: Record<string, number> = {}

    // Primero listamos todas las tablas
    const lines = stdout.split('\n')
    const tableNames: string[] = []

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith(';')) continue

      const parts = trimmed.split(/\s+/)
      if (parts.length >= 6 && parts[4] === 'TABLE') {
        const tableName = parts[5]
        if (tableName && !tableNames.includes(tableName)) {
          tableNames.push(tableName)
        }
      }
    }

    // Ahora para cada tabla, intentamos obtener el conteo de registros usando pg_restore
    // Esto requiere restaurar solo los datos y contar, pero para simplificar,
    // primero usamos una estrategia: intentar extraer el número de filas del TOC
    // Si no funciona, usamos pg_restore con una consulta COUNT

    // Estrategia 1: Intentar extraer información del TOC
    for (const tableName of tableNames) {
      try {
        // Intentamos usar pg_restore para obtener el número de filas
        // Otra opción: usar pg_restore con --schema-only y luego un script,
        // pero para simplificar, primero intentamos con una aproximación

        // Estrategia simple: usar pg_restore para contar COPY statements
        const { stdout: dataStdout } = await execAsync(
          `pg_restore -a --data-only "${filepath}" 2>/dev/null | grep -c "^COPY ${tableName}" || true`
        )
        const copyCount = parseInt(dataStdout.trim(), 10)

        if (copyCount > 0) {
          // Ahora contamos las filas reales en el COPY
          try {
            const { stdout: countStdout } = await execAsync(
              `pg_restore -a --data-only -t "${tableName}" "${filepath}" 2>/dev/null | awk '/^\\./ {exit} /^COPY/ {next} {c++} END {print c}'`
            )
            const rowCount = parseInt(countStdout.trim(), 10)
            if (!isNaN(rowCount)) {
              tableCounts[tableName] = rowCount
            }
          } catch {
            // Si falla, al menos registramos que existe la tabla
            tableCounts[tableName] = 0
          }
        }
      } catch (err) {
        console.warn(`Error counting rows for table ${tableName}:`, err)
      }
    }

    return tableCounts
  } catch (error) {
    console.error('Error extracting table counts from backup:', error)
    return {}
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
