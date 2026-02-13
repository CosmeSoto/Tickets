import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { readFile, stat } from 'fs/promises'
import { randomUUID } from 'crypto'

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
      // Verificar que el archivo existe
      const fileStats = await stat(backup.filepath)
      
      // Leer el archivo
      const fileBuffer = await readFile(backup.filepath)
      
      // Determinar el tipo de contenido
      const contentType = backup.filepath.endsWith('.json') 
        ? 'application/json'
        : backup.filepath.endsWith('.sql')
        ? 'application/sql'
        : 'application/octet-stream'

      // Registrar descarga en auditoría
      try {
        await prisma.audit_logs.create({
          data: {
            id: randomUUID(),
            action: 'backup_downloaded',
            entityType: 'System',
            entityId: backup.id,
            userId: session.user.id,
            details: {
              filename: backup.filename,
              size: fileStats.size,
              downloadedAt: new Date(),
              userEmail: session.user.email,
            },
            createdAt: new Date(),
          },
        })
      } catch (auditError) {
        console.warn('No se pudo registrar descarga en auditoría:', auditError)
      }

      // Crear respuesta con el archivo
      const response = new NextResponse(fileBuffer)
      
      response.headers.set('Content-Type', contentType)
      response.headers.set('Content-Disposition', `attachment; filename="${backup.filename}"`)
      response.headers.set('Content-Length', fileStats.size.toString())
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
      response.headers.set('Pragma', 'no-cache')
      response.headers.set('Expires', '0')

      return response

    } catch (fileError) {
      console.error('Error accessing backup file:', fileError)
      return NextResponse.json(
        { error: 'El archivo de backup no está disponible' },
        { status: 404 }
      )
    }

  } catch (error) {
    console.error('Error downloading backup:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Error al descargar backup',
      },
      { status: 500 }
    )
  }
}