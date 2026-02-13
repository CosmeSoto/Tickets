import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { unlink, access } from 'fs/promises'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Buscar backups fallidos
    const failedBackups = await prisma.backups.findMany({
      where: {
        status: 'failed'
      }
    })

    let cleanedCount = 0
    let errors: string[] = []

    for (const backup of failedBackups) {
      try {
        // Intentar eliminar archivo físico si existe
        try {
          await access(backup.filepath)
          await unlink(backup.filepath)
          console.log(`Archivo eliminado: ${backup.filepath}`)
        } catch (fileError) {
          console.warn(`Archivo no encontrado o ya eliminado: ${backup.filepath}`)
        }

        // Eliminar registro de base de datos
        await prisma.backups.delete({
          where: { id: backup.id }
        })

        cleanedCount++
        console.log(`Backup fallido eliminado: ${backup.id}`)

      } catch (error) {
        const errorMsg = `Error eliminando backup ${backup.id}: ${error instanceof Error ? error.message : 'Error desconocido'}`
        console.error(errorMsg)
        errors.push(errorMsg)
      }
    }

    // Registrar limpieza en auditoría
    try {
      await prisma.audit_logs.create({
        data: {
          id: randomUUID(),
          action: 'backups_cleanup',
          entityType: 'System',
          entityId: 'cleanup',
          details: {
            cleanedCount,
            totalFailed: failedBackups.length,
            errors: errors.length > 0 ? errors : undefined,
            cleanedAt: new Date(),
          },
          createdAt: new Date(),
        },
      })
    } catch (auditError) {
      console.warn('No se pudo registrar limpieza en auditoría:', auditError)
    }

    return NextResponse.json({
      success: true,
      message: `Limpieza completada: ${cleanedCount} backups fallidos eliminados`,
      data: {
        cleanedCount,
        totalFailed: failedBackups.length,
        errors: errors.length > 0 ? errors : undefined
      }
    })

  } catch (error) {
    console.error('Error en limpieza de backups:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Error en limpieza de backups',
      },
      { status: 500 }
    )
  }
}