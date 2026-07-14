import type { BackupAuditSummary } from './backup-audit'

export type AuditExportRow = {
  section: string
  item: string
  value: string
}

export function buildAuditExportRows(summary: BackupAuditSummary): AuditExportRow[] {
  const rows: AuditExportRow[] = [
    { section: 'Política', item: 'Motores', value: summary.policy.engines },
    {
      section: 'Política',
      item: 'Automático',
      value: summary.policy.automaticEnabled
        ? `Sí — ${summary.policy.frequency}, FULL ${summary.policy.weeklyFullDay} ${summary.policy.scheduleTime}`
        : 'No',
    },
    {
      section: 'Política',
      item: 'Retención pgBackRest',
      value: `${summary.policy.retentionFull} FULL + ${summary.policy.retentionDiff} DIFF (${summary.policy.compression})`,
    },
    {
      section: 'Operación',
      item: 'Completados / éxito / fallidos',
      value: `${summary.operations.totalCompleted} / ${summary.operations.successRate}% / ${summary.operations.failedCount}`,
    },
    {
      section: 'Operación',
      item: 'Último FULL',
      value: summary.operations.lastFullBackup
        ? new Date(summary.operations.lastFullBackup).toLocaleString('es-EC')
        : '—',
    },
    {
      section: 'Operación',
      item: 'Último automático',
      value: summary.operations.lastAutomaticBackup
        ? new Date(summary.operations.lastAutomaticBackup).toLocaleString('es-EC')
        : '—',
    },
    {
      section: 'Infraestructura',
      item: 'pgBackRest',
      value: summary.infrastructure.pgbackrestAvailable ? 'Activo' : 'Pendiente',
    },
    {
      section: 'Cron',
      item: 'CRON_SECRET',
      value: summary.cron.secretConfigured ? 'Configurado' : 'Sin configurar',
    },
  ]

  for (const item of summary.checklist) {
    rows.push({
      section: 'Checklist',
      item: item.label,
      value: `${item.status.toUpperCase()} — ${item.detail}`,
    })
  }

  for (const rec of summary.recommendations) {
    rows.push({ section: 'Recomendación', item: '—', value: rec })
  }

  return rows
}
