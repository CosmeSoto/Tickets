import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { readFile, stat, access } from 'fs/promises'
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
      await access(backup.filepath)
      const fileStats = await stat(backup.filepath)

      // Generar preview basado en el tipo de backup
      let preview

      if (backup.filepath.endsWith('.json')) {
        // Para backups JSON (método alternativo con Prisma o módulo)
        preview = await generateJsonBackupPreview(backup.filepath, fileStats)
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

async function generateJsonBackupPreview(filepath: string, fileStats: any) {
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

    // Si no tenemos tablas, al menos mostrar una entrada genérica
    if (tables.length === 0) {
      tables.push({
        name: 'backup_completo',
        recordCount: 1,
        size: formatFileSize(fileStats.size),
      })
      totalRecords = 1
    }

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
    // Fallback a info básica
    return {
      tables: [{ name: 'backup_completo', recordCount: 1, size: formatFileSize(fileStats.size) }],
      totalRecords: 1,
      totalSize: formatFileSize(fileStats.size),
      databaseVersion: 'JSON Export',
      createdAt: new Date().toISOString(),
      backupType: 'JSON',
    }
  }
}

async function generateSqlBackupPreview(backup: any, fileStats: any) {
  const tables: Array<{ name: string; recordCount: number; size: string }> = []
  let totalRecords = 0

  try {
    // Primero intentar leer metadata desde la base de datos
    if (backup.metadata) {
      try {
        const metadata = JSON.parse(backup.metadata)

        if (metadata.tableCounts) {
          for (const [name, count] of Object.entries(metadata.tableCounts)) {
            const recordCount = Number(count)
            if (recordCount > 0) {
              tables.push({
                name,
                recordCount,
                size: 'Desde backup',
              })
              totalRecords += recordCount
            }
          }

          if (tables.length > 0) {
            return {
              tables: tables.sort((a, b) => b.recordCount - a.recordCount),
              totalRecords,
              totalSize: formatFileSize(fileStats.size),
              databaseVersion: 'PostgreSQL (SQL Dump)',
              createdAt: metadata.createdAt || backup.createdAt,
              backupType: 'SQL (pg_dump)',
            }
          }
        }
      } catch (dbMetaErr) {
        console.warn('No se pudo leer metadata desde la DB:', dbMetaErr)
      }
    }

    // Luego intentar leer el archivo de metadata
    const metadataPath = `${backup.filepath}.meta.json`
    try {
      const metadataContent = await readFile(metadataPath, 'utf-8')
      const metadata = JSON.parse(metadataContent)

      if (metadata.tableCounts) {
        for (const [name, count] of Object.entries(metadata.tableCounts)) {
          const recordCount = Number(count)
          if (recordCount > 0) {
            tables.push({
              name,
              recordCount,
              size: 'Desde backup',
            })
            totalRecords += recordCount
          }
        }

        if (tables.length > 0) {
          return {
            tables: tables.sort((a, b) => b.recordCount - a.recordCount),
            totalRecords,
            totalSize: formatFileSize(fileStats.size),
            databaseVersion: 'PostgreSQL (SQL Dump)',
            createdAt: metadata.createdAt || backup.createdAt,
            backupType: 'SQL (pg_dump)',
          }
        }
      }
    } catch (metaErr) {
      console.warn('No se pudo leer metadata del backup:', metaErr)
    }

    // Fallback 1: Intentar extraer nombres de tablas con pg_restore
    try {
      const tableNames = await getTableNamesFromBackup(backup.filepath)
      for (const name of tableNames) {
        tables.push({
          name,
          recordCount: 0, // No podemos contar fácilmente sin restaurar, pero al menos mostramos el nombre
          size: 'Tabla',
        })
      }

      if (tables.length > 0) {
        return {
          tables,
          totalRecords: tables.length, // Cantidad de tablas como fallback
          totalSize: formatFileSize(fileStats.size),
          databaseVersion: 'PostgreSQL (SQL Dump)',
          createdAt: backup.createdAt,
          backupType: 'SQL (pg_dump)',
        }
      }
    } catch (pgErr) {
      console.warn('Error al extraer tablas con pg_restore:', pgErr)
    }
  } catch (error) {
    console.error('Error generating SQL backup preview:', error)
  }

  // Fallback final: siempre mostramos información básica
  return {
    tables: [{ name: 'backup_completo', recordCount: 1, size: formatFileSize(fileStats.size) }],
    totalRecords: 1,
    totalSize: formatFileSize(fileStats.size),
    databaseVersion: 'PostgreSQL',
    createdAt: backup.createdAt,
    backupType: 'SQL (pg_dump)',
  }
}

async function getTableNamesFromBackup(filepath: string): Promise<string[]> {
  try {
    const { stdout } = await execAsync(`pg_restore --list "${filepath}" 2>/dev/null`)

    const tableNames: string[] = []
    const lines = stdout.split('\n')

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

    return tableNames
  } catch (error) {
    console.error('Error getting table names from backup:', error)
    return []
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
