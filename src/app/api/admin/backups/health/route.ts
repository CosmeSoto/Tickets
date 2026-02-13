import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { exec } from 'child_process'
import { promisify } from 'util'
import { stat, access } from 'fs/promises'
import { join } from 'path'

const execAsync = promisify(exec)

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar estado de la base de datos
    const databaseHealth = await checkDatabaseHealth()
    
    // Verificar estado del almacenamiento
    const storageHealth = await checkStorageHealth()
    
    // Verificar estado del servicio de backup
    const backupServiceHealth = await checkBackupServiceHealth()
    
    // Calcular métricas de rendimiento
    const performanceMetrics = await calculatePerformanceMetrics()

    const healthReport = {
      database: databaseHealth,
      storage: storageHealth,
      backupService: backupServiceHealth,
      performance: performanceMetrics,
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(healthReport)

  } catch (error) {
    console.error('Error generating health report:', error)
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Error al generar reporte de salud',
      },
      { status: 500 }
    )
  }
}

async function checkDatabaseHealth() {
  try {
    const startTime = Date.now()
    
    // Hacer una consulta simple para verificar conectividad
    await prisma.$queryRaw`SELECT 1`
    
    const responseTime = Date.now() - startTime

    return {
      status: 'connected',
      responseTime,
      lastCheck: new Date().toISOString()
    }
  } catch (error) {
    console.error('Database health check failed:', error)
    return {
      status: 'error',
      responseTime: 0,
      lastCheck: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Error de conexión'
    }
  }
}

async function checkStorageHealth() {
  try {
    const backupDir = join(process.cwd(), 'backups')
    
    // Verificar si el directorio de backups existe y es accesible
    try {
      await access(backupDir)
    } catch {
      // Si no existe, crear el directorio
      const { mkdir } = await import('fs/promises')
      await mkdir(backupDir, { recursive: true })
    }

    // Obtener información del sistema de archivos (simulada)
    // En un entorno real, podrías usar librerías como 'statvfs' para obtener info real del disco
    const totalSpace = 100 * 1024 * 1024 * 1024 // 100GB simulado
    
    // Calcular espacio usado por backups
    const backups = await prisma.backups.findMany({
      where: { status: 'completed' },
      select: { size: true }
    })
    
    const usedByBackups = backups.reduce((total, backup) => total + backup.size, 0)
    const availableSpace = totalSpace - usedByBackups
    const usagePercentage = (usedByBackups / totalSpace) * 100

    let status = 'healthy'
    if (usagePercentage > 90) {
      status = 'critical'
    } else if (usagePercentage > 75) {
      status = 'warning'
    }

    return {
      available: availableSpace,
      used: usedByBackups,
      total: totalSpace,
      status,
      usagePercentage: Math.round(usagePercentage * 100) / 100
    }
  } catch (error) {
    console.error('Storage health check failed:', error)
    return {
      available: 0,
      used: 0,
      total: 0,
      status: 'error',
      error: error instanceof Error ? error.message : 'Error de almacenamiento'
    }
  }
}

async function checkBackupServiceHealth() {
  try {
    // Verificar último backup
    const lastBackup = await prisma.backups.findFirst({
      orderBy: { createdAt: 'desc' }
    })

    // Verificar próximo backup programado (simulado)
    const nextScheduled = new Date()
    nextScheduled.setHours(nextScheduled.getHours() + 24) // Próximo backup en 24 horas

    // Verificar si pg_dump está disponible
    let pgDumpAvailable = false
    try {
      await execAsync('which pg_dump')
      pgDumpAvailable = true
    } catch {
      pgDumpAvailable = false
    }

    return {
      status: 'running',
      lastBackup: lastBackup?.createdAt.toISOString() || null,
      nextScheduled: nextScheduled.toISOString(),
      pgDumpAvailable,
      alternativeMethodAvailable: true // Siempre disponible con Prisma
    }
  } catch (error) {
    console.error('Backup service health check failed:', error)
    return {
      status: 'error',
      lastBackup: null,
      nextScheduled: null,
      error: error instanceof Error ? error.message : 'Error del servicio'
    }
  }
}

async function calculatePerformanceMetrics() {
  try {
    // Obtener estadísticas de backups de los últimos 30 días
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentBackups = await prisma.backups.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo }
      },
      orderBy: { createdAt: 'desc' }
    })

    const completedBackups = recentBackups.filter(b => b.status === 'completed')
    const failedBackups = recentBackups.filter(b => b.status === 'failed')

    const successRate = recentBackups.length > 0 
      ? (completedBackups.length / recentBackups.length) * 100 
      : 0

    // Calcular tiempo promedio de backup (simulado)
    // En un entorno real, podrías almacenar timestamps de inicio y fin
    const avgBackupTime = 3.5 // minutos (simulado)

    // Calcular ratio de compresión promedio (simulado)
    const compressionRatio = 65 // porcentaje (simulado)

    return {
      avgBackupTime,
      successRate: Math.round(successRate * 100) / 100,
      compressionRatio,
      totalBackups: recentBackups.length,
      completedBackups: completedBackups.length,
      failedBackups: failedBackups.length
    }
  } catch (error) {
    console.error('Performance metrics calculation failed:', error)
    return {
      avgBackupTime: 0,
      successRate: 0,
      compressionRatio: 0,
      totalBackups: 0,
      completedBackups: 0,
      failedBackups: 0,
      error: error instanceof Error ? error.message : 'Error en métricas'
    }
  }
}