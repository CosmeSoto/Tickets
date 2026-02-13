import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { readFile, stat } from 'fs/promises'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
        // Para backups JSON (método alternativo con Prisma)
        preview = await generateJsonBackupPreview(backup.filepath)
      } else {
        // Para backups SQL (método tradicional con pg_dump)
        preview = await generateSqlBackupPreview(backup, fileStats)
      }

      return NextResponse.json({
        success: true,
        data: preview
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
    
    const tables = []
    let totalRecords = 0
    
    // Analizar las tablas en el backup JSON
    if (backupData.tables) {
      for (const [tableName, tableData] of Object.entries(backupData.tables)) {
        if (Array.isArray(tableData)) {
          const recordCount = tableData.length
          totalRecords += recordCount
          
          tables.push({
            name: tableName,
            recordCount,
            size: `${Math.round(JSON.stringify(tableData).length / 1024)} KB`
          })
        }
      }
    }
    
    return {
      tables: tables.sort((a, b) => b.recordCount - a.recordCount),
      totalRecords,
      totalSize: `${Math.round(JSON.stringify(backupData).length / 1024)} KB`,
      databaseVersion: backupData.version || 'JSON Export',
      createdAt: backupData.timestamp || new Date().toISOString(),
      backupType: 'JSON (Prisma Export)'
    }
    
  } catch (error) {
    console.error('Error parsing JSON backup:', error)
    throw new Error('Error al analizar el backup JSON')
  }
}

async function generateSqlBackupPreview(backup: any, fileStats: any) {
  try {
    // Para backups SQL, generar un preview basado en información conocida
    // y estadísticas de la base de datos actual
    
    // Obtener estadísticas actuales de las tablas principales
    const tableStats = await Promise.allSettled([
      prisma.users.count(),
      prisma.tickets.count(),
      prisma.comments.count(),
      prisma.categories.count(),
      prisma.attachments.count(),
      prisma.audit_logs.count(),
      prisma.system_settings.count(),
    ])

    const tables = [
      {
        name: 'users',
        recordCount: tableStats[0].status === 'fulfilled' ? tableStats[0].value : 0,
        size: 'Estimado'
      },
      {
        name: 'tickets',
        recordCount: tableStats[1].status === 'fulfilled' ? tableStats[1].value : 0,
        size: 'Estimado'
      },
      {
        name: 'comments',
        recordCount: tableStats[2].status === 'fulfilled' ? tableStats[2].value : 0,
        size: 'Estimado'
      },
      {
        name: 'categories',
        recordCount: tableStats[3].status === 'fulfilled' ? tableStats[3].value : 0,
        size: 'Estimado'
      },
      {
        name: 'attachments',
        recordCount: tableStats[4].status === 'fulfilled' ? tableStats[4].value : 0,
        size: 'Estimado'
      },
      {
        name: 'audit_logs',
        recordCount: tableStats[5].status === 'fulfilled' ? tableStats[5].value : 0,
        size: 'Estimado'
      },
      {
        name: 'system_settings',
        recordCount: tableStats[6].status === 'fulfilled' ? tableStats[6].value : 0,
        size: 'Estimado'
      },
    ].filter(table => table.recordCount > 0)

    const totalRecords = tables.reduce((sum, table) => sum + table.recordCount, 0)

    return {
      tables: tables.sort((a, b) => b.recordCount - a.recordCount),
      totalRecords,
      totalSize: formatFileSize(fileStats.size),
      databaseVersion: 'PostgreSQL (SQL Dump)',
      createdAt: backup.createdAt,
      backupType: 'SQL (pg_dump)'
    }
    
  } catch (error) {
    console.error('Error generating SQL backup preview:', error)
    
    // Fallback: preview básico
    return {
      tables: [
        { name: 'database_backup', recordCount: 1, size: 'Completo' }
      ],
      totalRecords: 1,
      totalSize: formatFileSize(fileStats.size),
      databaseVersion: 'PostgreSQL',
      createdAt: backup.createdAt,
      backupType: 'SQL (pg_dump)'
    }
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}