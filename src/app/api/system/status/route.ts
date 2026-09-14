import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { redis } from '@/lib/redis'
import os from 'os'

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Obtener estado real del sistema
    const systemStatus = await getSystemStatus()

    return NextResponse.json(systemStatus)
  } catch (error) {
    console.error('Error fetching system status:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

async function getSystemStatus() {
  const status = {
    database: await getDatabaseStatus(),
    cache: await getCacheStatus(),
    email: await getEmailStatus(),
    backup: await getBackupStatus(),
    server: await getServerStatus(),
    lastUpdated: new Date().toISOString(),
  }

  return status
}

// Estado real de la base de datos
async function getDatabaseStatus() {
  try {
    const startTime = Date.now()
    await prisma.$queryRaw`SELECT 1`
    const responseTime = Date.now() - startTime

    // Conexiones activas y tamaño reales — vía catálogo de Postgres, no
    // estimados a partir de actividad de tickets como antes.
    const [connStats, sizeStats] = await Promise.all([
      prisma.$queryRaw<{ active: bigint; max_conn: number }[]>`
        SELECT
          (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) AS active,
          (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS max_conn
      `,
      prisma.$queryRaw<{ size_bytes: bigint }[]>`
        SELECT pg_database_size(current_database()) AS size_bytes
      `,
    ])

    const active = Number(connStats[0]?.active ?? 0)
    const maxConn = Number(connStats[0]?.max_conn ?? 100)
    const sizeMB = Math.round(Number(sizeStats[0]?.size_bytes ?? 0) / (1024 * 1024))

    return {
      status: 'active',
      type: 'PostgreSQL',
      responseTime: `${responseTime}ms`,
      connections: {
        active,
        max: maxConn,
        percentage: maxConn > 0 ? Math.round((active / maxConn) * 100) : 0,
      },
      size: `${sizeMB}MB`,
      lastCheck: new Date().toISOString(),
    }
  } catch (error) {
    console.error('Database status error:', error)
    return {
      status: 'error',
      type: 'PostgreSQL',
      error: 'Connection failed',
      lastCheck: new Date().toISOString(),
    }
  }
}

// Estado real de Redis (el cache efectivamente usado por la app vía @/lib/api-cache)
async function getCacheStatus() {
  try {
    const pong = await redis.ping().catch(() => null)
    if (pong !== 'PONG') {
      return {
        status: 'unavailable',
        type: 'Redis',
        note: 'Redis no configurado o inalcanzable — la app sigue funcionando sin caché.',
        lastCheck: new Date().toISOString(),
      }
    }

    const keys = await redis.dbsize().catch(() => null)

    return {
      status: 'active',
      type: 'Redis',
      keys: typeof keys === 'number' ? keys : null,
      lastCheck: new Date().toISOString(),
    }
  } catch (error) {
    return {
      status: 'unknown',
      type: 'Redis',
      error: 'Unable to check cache status',
      lastCheck: new Date().toISOString(),
    }
  }
}

// Estado real de la cola de emails (tabla email_queue)
async function getEmailStatus() {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const [pending, sentToday, sentThisWeek, sentThisMonth, lastSent, failedRecent] =
      await Promise.all([
        prisma.email_queue.count({ where: { status: 'pending' } }),
        prisma.email_queue.count({ where: { status: 'sent', sentAt: { gte: today } } }),
        prisma.email_queue.count({ where: { status: 'sent', sentAt: { gte: weekAgo } } }),
        prisma.email_queue.count({ where: { status: 'sent', sentAt: { gte: monthAgo } } }),
        prisma.email_queue.findFirst({
          where: { status: 'sent' },
          orderBy: { sentAt: 'desc' },
          select: { sentAt: true },
        }),
        prisma.email_queue.count({ where: { status: 'failed', createdAt: { gte: weekAgo } } }),
      ])

    return {
      status: 'active',
      type: 'SMTP',
      emailsSent: {
        today: sentToday,
        thisWeek: sentThisWeek,
        thisMonth: sentThisMonth,
      },
      queue: pending,
      failedThisWeek: failedRecent,
      lastSent: lastSent?.sentAt?.toISOString() ?? null,
      provider: 'SMTP Server',
      lastCheck: new Date().toISOString(),
    }
  } catch (error) {
    return {
      status: 'error',
      type: 'SMTP',
      error: 'Unable to check email service',
      lastCheck: new Date().toISOString(),
    }
  }
}

// Estado real del backup (tabla backups, la misma que administra el módulo de Backups)
async function getBackupStatus() {
  try {
    const lastCompleted = await prisma.backups.findFirst({
      where: { status: 'completed' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, size: true, backupKind: true },
    })

    if (!lastCompleted) {
      return {
        status: 'no_backups',
        type: 'Automated Backup',
        lastBackup: null,
        lastCheck: new Date().toISOString(),
      }
    }

    const hoursAgo = Math.floor((Date.now() - lastCompleted.createdAt.getTime()) / (1000 * 60 * 60))

    return {
      status: hoursAgo < 24 ? 'scheduled' : 'overdue',
      type: 'Automated Backup',
      lastBackup: {
        time: lastCompleted.createdAt.toISOString(),
        timeAgo: `hace ${hoursAgo}h`,
        size: `${Math.round(lastCompleted.size / (1024 * 1024))}MB`,
        kind: lastCompleted.backupKind,
      },
      lastCheck: new Date().toISOString(),
    }
  } catch (error) {
    return {
      status: 'error',
      type: 'Automated Backup',
      error: 'Unable to check backup status',
      lastCheck: new Date().toISOString(),
    }
  }
}

// Estado del servidor
async function getServerStatus() {
  try {
    const memoryUsage = process.memoryUsage()
    const uptime = process.uptime()
    const cores = os.cpus().length
    // Load average (1 min) como proxy real de uso de CPU — no es un porcentaje
    // exacto de CPU, pero es una medición real del sistema, no un valor
    // aleatorio. No disponible en Windows (loadavg devuelve [0,0,0] ahí).
    const load1m = os.loadavg()[0]

    return {
      status: 'running',
      uptime: {
        seconds: Math.floor(uptime),
        formatted: formatUptime(uptime),
      },
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
      },
      cpu: {
        loadAverage1m: Math.round(load1m * 100) / 100,
        usagePercentEstimate: cores > 0 ? Math.min(100, Math.round((load1m / cores) * 100)) : null,
        cores,
      },
      nodeVersion: process.version,
      platform: process.platform,
      lastCheck: new Date().toISOString(),
    }
  } catch (error) {
    return {
      status: 'error',
      error: 'Unable to get server status',
      lastCheck: new Date().toISOString(),
    }
  }
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / (24 * 60 * 60))
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60))
  const minutes = Math.floor((seconds % (60 * 60)) / 60)

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}
