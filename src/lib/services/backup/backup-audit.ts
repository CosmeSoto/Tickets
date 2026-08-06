import prisma from '@/lib/prisma'
import { getBackupConfig } from './backup-utils'
import { getBackupWorkerHealth, syncPgBackRestToDatabase } from './backup-engine'
import { computeSuccessRate } from './backup-health-utils'

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export type AuditCheckStatus = 'ok' | 'warn' | 'fail'

export interface AuditCheckItem {
  id: string
  label: string
  status: AuditCheckStatus
  detail: string
}

export interface BackupAuditSummary {
  generatedAt: string
  policy: {
    engines: string
    automaticEnabled: boolean
    frequency: string
    weeklyFullDay: string
    scheduleTime: string
    retentionFull: number
    retentionDiff: number
    compression: string
  }
  infrastructure: {
    pgbackrestAvailable: boolean
    stanza: string
    walArchivingActive: boolean
  }
  operations: {
    totalCompleted: number
    failedCount: number
    successRate: number
    lastFullBackup: string | null
    lastDiffBackup: string | null
    lastExportBackup: string | null
    lastAutomaticBackup: string | null
  }
  cron: {
    secretConfigured: boolean
    endpoint: string
    scheduleHint: string
    setupScript: string
  }
  checklist: AuditCheckItem[]
  verificationCommands: string[]
  recommendations: string[]
}

function hoursSince(date: Date | undefined | null): number | null {
  if (!date) return null
  return (Date.now() - date.getTime()) / (1000 * 60 * 60)
}

function iso(date: Date | undefined | null): string | null {
  return date ? date.toISOString() : null
}

export async function buildBackupAuditSummary(): Promise<BackupAuditSummary> {
  await syncPgBackRestToDatabase().catch(() => {})

  const workerHealth = await getBackupWorkerHealth()
  const config = await getBackupConfig()

  const stats = await prisma.backups.aggregate({
    _count: { id: true },
    where: { status: 'completed' },
  })
  const completed = stats._count.id || 0
  const failedCount = await prisma.backups.count({ where: { status: 'failed' } })
  const successRate = computeSuccessRate(completed, failedCount) ?? 0

  const lastFull = await prisma.backups.findFirst({
    where: { engine: 'pgbackrest', backupKind: 'full', status: 'completed' },
    orderBy: { createdAt: 'desc' },
  })
  const lastDiff = await prisma.backups.findFirst({
    where: { engine: 'pgbackrest', backupKind: 'diff', status: 'completed' },
    orderBy: { createdAt: 'desc' },
  })

  const lastExport = await prisma.backups.findFirst({
    where: { engine: 'export', status: 'completed' },
    orderBy: { createdAt: 'desc' },
  })
  const lastAutomatic = await prisma.backups.findFirst({
    where: { type: 'automatic', status: 'completed', engine: 'pgbackrest' },
    orderBy: { createdAt: 'desc' },
  })

  const fullHours = hoursSince(lastFull?.createdAt)
  const diffHours = hoursSince(lastDiff?.createdAt)
  const cronConfigured = Boolean(process.env.CRON_SECRET?.trim())

  const checklist: AuditCheckItem[] = [
    {
      id: 'pgbackrest',
      label: 'Infraestructura pgBackRest operativa',
      status: workerHealth.stanzaOk ? 'ok' : workerHealth.pgbackrestOk ? 'warn' : 'fail',
      detail: workerHealth.stanzaOk
        ? `Stanza ${workerHealth.stanza} — repositorio y WAL OK`
        : 'Revisa Admin → Backups → Config o ejecuta init-pgbackrest.sh',
    },
    {
      id: 'automatic',
      label: 'Backups automáticos habilitados',
      status: config.enabled ? 'ok' : 'warn',
      detail: config.enabled
        ? `FULL los ${WEEKDAYS[config.weeklyFullDay ?? 0] ?? 'domingos'}, DIFF resto de días`
        : 'Activa en Config → Backups automáticos',
    },
    {
      id: 'cron',
      label: 'Cron del servidor configurado (CRON_SECRET)',
      status: cronConfigured ? 'ok' : 'fail',
      detail: cronConfigured
        ? 'El endpoint /api/admin/cron/backup puede ejecutarse de forma segura'
        : 'Ejecuta ./docker/scripts/setup-backup-cron.sh en el servidor Debian',
    },
    {
      id: 'full-recent',
      label: 'Último respaldo FULL reciente',
      status: fullHours == null ? 'warn' : fullHours <= 24 * 8 ? 'ok' : 'warn',
      detail:
        fullHours == null
          ? 'Aún no hay FULL registrado en el historial'
          : `Hace ${Math.round(fullHours)} h — objetivo: ≤ 8 días`,
    },
    {
      id: 'diff-recent',
      label: 'Último respaldo DIFF reciente',
      status:
        !config.enabled || config.frequency !== 'daily'
          ? 'ok'
          : diffHours == null
            ? 'warn'
            : diffHours <= 26
              ? 'ok'
              : 'warn',
      detail:
        diffHours == null
          ? 'Sin DIFF en historial (normal tras primer FULL)'
          : `Hace ${Math.round(diffHours)} h — objetivo diario: ≤ 26 h`,
    },
    {
      id: 'failed',
      label: 'Sin respaldos fallidos pendientes',
      status: failedCount === 0 ? 'ok' : 'warn',
      detail:
        failedCount === 0
          ? 'Historial limpio'
          : `${failedCount} registro(s) fallido(s) — usa Limpiar fallidos si ya no aplican`,
    },
    {
      id: 'export-monthly',
      label: 'Exportación portable (.dump) para auditoría',
      status: lastExport ? 'ok' : 'warn',
      detail: lastExport
        ? `Último export: ${lastExport.createdAt.toLocaleString('es-EC')}`
        : 'Recomendado: 1 export mensual descargable para evidencia externa',
    },
  ]

  const recommendations: string[] = [
    'Nuevos módulos: se incluyen automáticamente en pgBackRest (cluster completo). Para restore selectivo, registrar el módulo en src/lib/services/backup-modules.ts.',
    'Credenciales: en backups/exports los secretos van cifrados (AES-GCM). Protege ENCRYPTION_KEY fuera del dump; sin esa clave no se pueden revelar tras restaurar.',
    'Mensual: crear Export .dump, descargarlo y guardarlo fuera del servidor.',
    'Mensual: ejecutar ./docker/scripts/disaster-recovery.sh check y archivar la salida.',
    'Trimestral: prueba de restauración del .dump en entorno de prueba.',
    'Continuo: copia off-site del volumen Docker pgbackrest_repo (rsync/NAS/nube).',
  ]

  if (!cronConfigured) {
    recommendations.unshift(
      'Urgente: configurar cron con ./docker/scripts/setup-backup-cron.sh para backups automáticos reales.'
    )
  }

  return {
    generatedAt: new Date().toISOString(),
    policy: {
      engines: 'pgBackRest (infraestructura) + pg_dump (.dump portable)',
      automaticEnabled: config.enabled,
      frequency: config.frequency,
      weeklyFullDay: WEEKDAYS[config.weeklyFullDay ?? 0] ?? 'Domingo',
      scheduleTime: config.scheduleTime,
      retentionFull: 2,
      retentionDiff: 7,
      compression: 'zstd nivel 3',
    },
    infrastructure: {
      pgbackrestAvailable: workerHealth.status === 'healthy' && workerHealth.stanzaOk,
      stanza: workerHealth.stanza,
      walArchivingActive: workerHealth.stanzaOk,
    },
    operations: {
      totalCompleted: completed,
      failedCount,
      successRate: Math.round(successRate),
      lastFullBackup: iso(lastFull?.createdAt),
      lastDiffBackup: iso(lastDiff?.createdAt),
      lastExportBackup: iso(lastExport?.createdAt),
      lastAutomaticBackup: iso(lastAutomatic?.createdAt),
    },
    cron: {
      secretConfigured: cronConfigured,
      endpoint: '/api/admin/cron/backup',
      scheduleHint: '0 * * * * (cada hora; el scheduler aplica ventana ±30 min y día FULL/DIFF)',
      setupScript: './docker/scripts/setup-backup-cron.sh',
    },
    checklist,
    verificationCommands: [
      './docker/scripts/disaster-recovery.sh check',
      './docker/scripts/disaster-recovery.sh info',
      'docker compose -f docker-compose.prod.yml --env-file .env.production logs backup-worker --tail 20',
    ],
    recommendations,
  }
}
