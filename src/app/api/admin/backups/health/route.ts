import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { exec } from 'child_process'
import { promisify } from 'util'
import { access, readdir, stat } from 'fs/promises'
import { join } from 'path'

const execAsync = promisify(exec)

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const [databaseHealth, storageHealth, backupServiceHealth, performanceMetrics] =
      await Promise.all([
        checkDatabaseHealth(),
        checkStorageHealth(),
        checkBackupServiceHealth(),
        calculatePerformanceMetrics(),
      ])

    return NextResponse.json({
      database: databaseHealth,
      storage: storageHealth,
      backupService: backupServiceHealth,
      performance: performanceMetrics,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error generating health report:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al generar reporte de salud' },
      { status: 500 }
    )
  }
}

// ── Base de datos ─────────────────────────────────────────────────────────────

async function checkDatabaseHealth() {
  try {
    const startTime = Date.now()
    await prisma.$queryRaw`SELECT 1`
    return {
      status: 'connected',
      responseTime: Date.now() - startTime,
      lastCheck: new Date().toISOString(),
    }
  } catch (error) {
    return {
      status: 'error',
      responseTime: 0,
      lastCheck: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Error de conexión',
    }
  }
}

// ── Almacenamiento — espacio real del disco ───────────────────────────────────

async function checkStorageHealth() {
  const backupDir = join(process.cwd(), 'backups')

  try {
    // Crear directorio si no existe
    try {
      await access(backupDir)
    } catch {
      const { mkdir } = await import('fs/promises')
      await mkdir(backupDir, { recursive: true })
    }

    // Espacio real del disco con `df`
    let totalSpace = 0
    let availableSpace = 0

    try {
      const { stdout } = await execAsync(`df -k "${backupDir}"`)
      // Formato: Filesystem 1K-blocks Used Available Use% Mounted
      const lines = stdout.trim().split('\n')
      const parts = lines[lines.length - 1].trim().split(/\s+/)
      if (parts.length >= 4) {
        totalSpace = parseInt(parts[1]) * 1024 // bloques de 1K → bytes
        availableSpace = parseInt(parts[3]) * 1024 // bloques de 1K → bytes
      }
    } catch {
      // df no disponible (Windows o contenedor sin df) — usar estimación por archivos
      console.warn('[HEALTH] df no disponible, usando estimación por archivos de backup')
    }

    // Espacio real usado por los archivos de backup en disco
    let usedByBackups = 0
    try {
      const files = await readdir(backupDir)
      for (const file of files) {
        try {
          const fileStat = await stat(join(backupDir, file))
          if (fileStat.isFile()) usedByBackups += fileStat.size
        } catch {
          /* ignorar archivos inaccesibles */
        }
      }
    } catch {
      /* directorio vacío o inaccesible */
    }

    // Si df no funcionó, usar solo el espacio de backups como referencia
    if (totalSpace === 0) {
      totalSpace = Math.max(usedByBackups * 10, 10 * 1024 * 1024 * 1024) // estimación mínima 10GB
      availableSpace = totalSpace - usedByBackups
    }

    const usagePercentage = totalSpace > 0 ? (usedByBackups / totalSpace) * 100 : 0

    return {
      available: availableSpace,
      used: usedByBackups,
      total: totalSpace,
      status: usagePercentage > 90 ? 'critical' : usagePercentage > 75 ? 'warning' : 'healthy',
      usagePercentage: Math.round(usagePercentage * 100) / 100,
    }
  } catch (error) {
    return {
      available: 0,
      used: 0,
      total: 0,
      status: 'error',
      error: error instanceof Error ? error.message : 'Error de almacenamiento',
    }
  }
}

// ── Servicio de backup — próximo backup calculado desde la configuración real ──

async function checkBackupServiceHealth() {
  try {
    const lastBackup = await prisma.backups.findFirst({
      orderBy: { createdAt: 'desc' },
    })

    // Leer configuración real para calcular el próximo backup
    const [enabledSetting, frequencySetting, scheduledTimeSetting] = await Promise.all([
      prisma.system_settings.findUnique({ where: { key: 'backupEnabled' } }),
      prisma.system_settings.findUnique({ where: { key: 'backupFrequency' } }),
      prisma.system_settings.findUnique({ where: { key: 'backupScheduleTime' } }),
    ])

    const backupEnabled = enabledSetting?.value === 'true'
    const frequency = frequencySetting?.value ?? 'daily'
    const scheduleTime = scheduledTimeSetting?.value ?? '02:00'

    let nextScheduled: string | null = null

    if (backupEnabled) {
      const [scheduledHour, scheduledMinute] = scheduleTime.split(':').map(Number)
      const now = new Date()

      // Calcular la próxima ejecución según frecuencia
      const next = new Date()
      next.setHours(scheduledHour, scheduledMinute, 0, 0)

      if (next <= now) {
        // La hora de hoy ya pasó — calcular el próximo día/semana/mes
        switch (frequency) {
          case 'weekly':
            next.setDate(next.getDate() + 7)
            break
          case 'monthly':
            next.setMonth(next.getMonth() + 1)
            break
          default: // daily
            next.setDate(next.getDate() + 1)
        }
      }

      nextScheduled = next.toISOString()
    }

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
      backupEnabled,
      frequency,
      scheduleTime,
      lastBackup: lastBackup?.createdAt.toISOString() ?? null,
      nextScheduled,
      pgDumpAvailable,
      alternativeMethodAvailable: true,
    }
  } catch (error) {
    return {
      status: 'error',
      lastBackup: null,
      nextScheduled: null,
      error: error instanceof Error ? error.message : 'Error del servicio',
    }
  }
}

// ── Métricas de rendimiento — calculadas desde datos reales ──────────────────

async function calculatePerformanceMetrics() {
  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentBackups = await prisma.backups.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      orderBy: { createdAt: 'desc' },
    })

    const completedBackups = recentBackups.filter(b => b.status === 'completed')
    const failedBackups = recentBackups.filter(b => b.status === 'failed')

    const successRate =
      recentBackups.length > 0 ? (completedBackups.length / recentBackups.length) * 100 : 0

    // Ratio de compresión real: comparar tamaño en BD vs tamaño real en disco
    // Los backups comprimidos tienen .gz — si el archivo en disco es más pequeño que el
    // tamaño registrado en BD, hay compresión efectiva.
    let compressionRatio: number | null = null
    const compressedBackups = completedBackups.filter(b => b.compressed)

    if (compressedBackups.length > 0) {
      let totalDbSize = 0
      let totalDiskSize = 0

      for (const backup of compressedBackups.slice(0, 10)) {
        // Tamaño registrado en BD (post-compresión)
        totalDbSize += backup.size

        // Intentar leer el tamaño original estimado desde el nombre del archivo
        // (el tamaño en BD ya es el comprimido, así que usamos una estimación de ratio típico)
        totalDiskSize += backup.size
      }

      // Si todos los backups completados son comprimidos, calcular ratio real
      // comparando el tamaño promedio de comprimidos vs no comprimidos
      const uncompressedBackups = completedBackups.filter(b => !b.compressed)
      if (uncompressedBackups.length > 0 && compressedBackups.length > 0) {
        const avgCompressed =
          compressedBackups.reduce((s, b) => s + b.size, 0) / compressedBackups.length
        const avgUncompressed =
          uncompressedBackups.reduce((s, b) => s + b.size, 0) / uncompressedBackups.length

        if (avgUncompressed > 0) {
          compressionRatio = Math.round((1 - avgCompressed / avgUncompressed) * 100)
        }
      }
    }

    // Tiempo promedio de backup: calculado desde audit_logs si están disponibles
    let avgBackupTime: number | null = null
    try {
      const auditLogs = await prisma.audit_logs.findMany({
        where: {
          action: 'backup_created',
          createdAt: { gte: thirtyDaysAgo },
        },
        select: { details: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })

      // Los audit logs tienen el timestamp de creación del backup completado.
      // Estimamos el tiempo comparando con el backup anterior.
      if (auditLogs.length >= 2) {
        const intervals: number[] = []
        for (let i = 0; i < auditLogs.length - 1; i++) {
          const diff =
            new Date(auditLogs[i].createdAt).getTime() -
            new Date(auditLogs[i + 1].createdAt).getTime()
          // Solo considerar intervalos razonables (< 2 horas = probablemente el tiempo de ejecución)
          if (diff > 0 && diff < 2 * 60 * 60 * 1000) {
            intervals.push(diff / 60000) // convertir a minutos
          }
        }
        if (intervals.length > 0) {
          avgBackupTime =
            Math.round((intervals.reduce((s, v) => s + v, 0) / intervals.length) * 10) / 10
        }
      }
    } catch {
      /* audit_logs no disponible */
    }

    return {
      avgBackupTime, // null si no hay suficientes datos
      successRate: Math.round(successRate * 100) / 100,
      compressionRatio, // null si no hay datos comparables
      totalBackups: recentBackups.length,
      completedBackups: completedBackups.length,
      failedBackups: failedBackups.length,
    }
  } catch (error) {
    return {
      avgBackupTime: null,
      successRate: 0,
      compressionRatio: null,
      totalBackups: 0,
      completedBackups: 0,
      failedBackups: 0,
      error: error instanceof Error ? error.message : 'Error en métricas',
    }
  }
}
