import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Generar alertas basadas en el estado del sistema de backups
    const alerts = []

    try {
      // Verificar backups fallidos recientes
      const failedBackups = await prisma.backups.findMany({
        where: {
          status: 'failed',
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Últimas 24 horas
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      })

      failedBackups.forEach(backup => {
        alerts.push({
          id: `failed-${backup.id}`,
          type: 'error',
          title: 'Backup fallido',
          message: `El backup "${backup.filename}" falló durante su creación`,
          timestamp: backup.createdAt.toISOString(),
          resolved: false
        })
      })

      // Verificar último backup exitoso
      const lastSuccessfulBackup = await prisma.backups.findFirst({
        where: { status: 'completed' },
        orderBy: { createdAt: 'desc' }
      })

      if (lastSuccessfulBackup) {
        const hoursSinceLastBackup = (Date.now() - lastSuccessfulBackup.createdAt.getTime()) / (1000 * 60 * 60)
        
        if (hoursSinceLastBackup > 48) { // Más de 48 horas sin backup
          alerts.push({
            id: 'no-recent-backup',
            type: 'warning',
            title: 'Sin backups recientes',
            message: `El último backup exitoso fue hace ${Math.round(hoursSinceLastBackup)} horas`,
            timestamp: new Date().toISOString(),
            resolved: false
          })
        }
      } else {
        alerts.push({
          id: 'no-backups',
          type: 'error',
          title: 'Sin backups',
          message: 'No se han encontrado backups exitosos en el sistema',
          timestamp: new Date().toISOString(),
          resolved: false
        })
      }

      // Verificar espacio en disco (simulado)
      const totalBackups = await prisma.backups.count()
      const totalSize = await prisma.backups.aggregate({
        _sum: { size: true },
        where: { status: 'completed' }
      })

      const estimatedDiskUsage = (totalSize._sum.size || 0) / (1024 * 1024 * 1024) // GB
      
      if (estimatedDiskUsage > 10) { // Más de 10GB
        alerts.push({
          id: 'disk-usage',
          type: 'warning',
          title: 'Alto uso de disco',
          message: `Los backups están usando aproximadamente ${estimatedDiskUsage.toFixed(1)}GB de espacio`,
          timestamp: new Date().toISOString(),
          resolved: false
        })
      }

      // Agregar alerta de éxito si hay backups recientes exitosos
      if (lastSuccessfulBackup && (Date.now() - lastSuccessfulBackup.createdAt.getTime()) < 24 * 60 * 60 * 1000) {
        alerts.push({
          id: 'recent-success',
          type: 'info',
          title: 'Backup reciente exitoso',
          message: `Último backup completado: ${lastSuccessfulBackup.filename}`,
          timestamp: lastSuccessfulBackup.createdAt.toISOString(),
          resolved: true
        })
      }

    } catch (dbError) {
      console.error('Error querying backup data:', dbError)
      
      // Alerta de error de base de datos
      alerts.push({
        id: 'db-error',
        type: 'error',
        title: 'Error de base de datos',
        message: 'No se pudo acceder a la información de backups',
        timestamp: new Date().toISOString(),
        resolved: false
      })
    }

    return NextResponse.json(alerts)

  } catch (error) {
    console.error('Error generating backup alerts:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Error al generar alertas de backup',
      },
      { status: 500 }
    )
  }
}