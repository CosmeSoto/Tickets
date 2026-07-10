import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  ensureBackupCatalogSynced,
  countPgBackRestBackups,
  isPgBackRestInfrastructureOk,
} from '@/lib/services/backup/backup-health-utils'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    await ensureBackupCatalogSynced()

    const alerts: Array<{
      id: string
      type: 'info' | 'warning' | 'error'
      title: string
      message: string
      timestamp: string
      resolved: boolean
    }> = []

    const pgInfraOk = await isPgBackRestInfrastructureOk()
    const pgRepoCount = pgInfraOk ? await countPgBackRestBackups() : 0

    const failedBackups = await prisma.backups.findMany({
      where: {
        status: 'failed',
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    })

    const lastSuccessfulBackup = await prisma.backups.findFirst({
      where: { status: 'completed' },
      orderBy: { createdAt: 'desc' },
    })

    const hasSuccessfulData = Boolean(lastSuccessfulBackup) || pgRepoCount > 0

    for (const backup of failedBackups) {
      const superseded = lastSuccessfulBackup && lastSuccessfulBackup.createdAt > backup.createdAt

      if (superseded) continue

      alerts.push({
        id: `failed-${backup.id}`,
        type: 'warning',
        title: 'Intento de respaldo fallido',
        message: `"${backup.filename}" — usa Limpiar fallidos si ya no aplica`,
        timestamp: backup.createdAt.toISOString(),
        resolved: false,
      })
    }

    if (lastSuccessfulBackup) {
      const hoursSinceLastBackup =
        (Date.now() - lastSuccessfulBackup.createdAt.getTime()) / (1000 * 60 * 60)

      if (hoursSinceLastBackup > 48) {
        alerts.push({
          id: 'no-recent-backup',
          type: 'warning',
          title: 'Sin respaldos recientes en historial',
          message: `Último exitoso hace ${Math.round(hoursSinceLastBackup)} h — verifica cron automático`,
          timestamp: new Date().toISOString(),
          resolved: false,
        })
      }
    } else if (pgRepoCount > 0) {
      alerts.push({
        id: 'pgbr-repo-only',
        type: 'info',
        title: 'Repositorio pgBackRest activo',
        message: `${pgRepoCount} respaldo(s) en infraestructura — historial UI sincronizado`,
        timestamp: new Date().toISOString(),
        resolved: true,
      })
    } else if (!pgInfraOk) {
      alerts.push({
        id: 'no-backups',
        type: 'error',
        title: 'Sin respaldos',
        message: 'No hay respaldos exitosos — revisa Config → pgBackRest o crea un export .dump',
        timestamp: new Date().toISOString(),
        resolved: false,
      })
    } else {
      alerts.push({
        id: 'no-backups-yet',
        type: 'warning',
        title: 'Sin respaldos completados aún',
        message: 'Infraestructura lista — espera el cron o crea un respaldo manual',
        timestamp: new Date().toISOString(),
        resolved: false,
      })
    }

    if (!pgInfraOk && pgRepoCount === 0) {
      alerts.push({
        id: 'pgbr-down',
        type: 'error',
        title: 'pgBackRest no disponible',
        message: 'Admin → Backups → Config — inicializa o ejecuta init-pgbackrest.sh',
        timestamp: new Date().toISOString(),
        resolved: false,
      })
    }

    const cronConfigured = Boolean(process.env.CRON_SECRET?.trim())
    const autoEnabled = await prisma.system_settings.findUnique({
      where: { key: 'backupEnabled' },
    })
    if (autoEnabled?.value === 'true' && !cronConfigured) {
      alerts.push({
        id: 'cron-missing',
        type: 'warning',
        title: 'Cron del servidor no configurado',
        message: 'Ejecuta ./docker/scripts/setup-backup-cron.sh en Debian para backups automáticos',
        timestamp: new Date().toISOString(),
        resolved: false,
      })
    }

    if (
      hasSuccessfulData &&
      lastSuccessfulBackup &&
      Date.now() - lastSuccessfulBackup.createdAt.getTime() < 24 * 60 * 60 * 1000
    ) {
      alerts.push({
        id: 'recent-success',
        type: 'info',
        title: 'Respaldo reciente OK',
        message: lastSuccessfulBackup.filename,
        timestamp: lastSuccessfulBackup.createdAt.toISOString(),
        resolved: true,
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
