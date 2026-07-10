'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ClipboardCheck,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
} from 'lucide-react'
import type { AuditCheckItem, BackupAuditSummary } from '@/lib/services/backup/backup-audit'

function StatusIcon({ status }: { status: AuditCheckItem['status'] }) {
  if (status === 'ok') return <CheckCircle2 className='h-4 w-4 text-emerald-600 shrink-0' />
  if (status === 'warn') return <AlertTriangle className='h-4 w-4 text-amber-600 shrink-0' />
  return <XCircle className='h-4 w-4 text-destructive shrink-0' />
}

export function BackupAuditGuideCard() {
  const [summary, setSummary] = useState<BackupAuditSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/backups/audit-summary')
      if (res.ok) setSummary(await res.json())
    } catch {
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const downloadReport = () => {
    if (!summary) return
    const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `backup-audit-${summary.generatedAt.slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const okCount = summary?.checklist.filter(c => c.status === 'ok').length ?? 0
  const totalChecks = summary?.checklist.length ?? 0

  return (
    <Card className='border-emerald-500/25 bg-emerald-500/5'>
      <CardHeader className='pb-3'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <CardTitle className='text-base flex items-center gap-2'>
              <ClipboardCheck className='h-5 w-5 text-emerald-600' />
              Guía de auditoría y cumplimiento
            </CardTitle>
            <CardDescription className='mt-1'>
              Política de respaldos, checklist operativo y evidencias para auditorías
            </CardDescription>
          </div>
          <div className='flex gap-2'>
            <Button variant='outline' size='sm' onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
            <Button size='sm' onClick={downloadReport} disabled={!summary}>
              <Download className='h-4 w-4 mr-2' />
              Exportar informe
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-5 text-sm'>
        {loading && !summary ? (
          <div className='flex items-center gap-2 text-muted-foreground py-4'>
            <Loader2 className='h-4 w-4 animate-spin' />
            Generando resumen de auditoría…
          </div>
        ) : summary ? (
          <>
            <div className='flex flex-wrap gap-2 items-center'>
              <Badge variant='secondary'>
                Checklist: {okCount}/{totalChecks} OK
              </Badge>
              <Badge
                variant={summary.infrastructure.pgbackrestAvailable ? 'default' : 'destructive'}
              >
                pgBackRest {summary.infrastructure.pgbackrestAvailable ? 'activo' : 'pendiente'}
              </Badge>
              <Badge variant={summary.cron.secretConfigured ? 'outline' : 'destructive'}>
                Cron {summary.cron.secretConfigured ? 'configurado' : 'sin CRON_SECRET'}
              </Badge>
            </div>

            <div className='grid gap-4 md:grid-cols-2'>
              <div className='rounded-lg border bg-background p-4 space-y-2'>
                <p className='font-medium text-xs uppercase tracking-wide text-muted-foreground'>
                  Política activa
                </p>
                <ul className='text-xs text-muted-foreground space-y-1'>
                  <li>
                    <strong className='text-foreground'>Motores:</strong> {summary.policy.engines}
                  </li>
                  <li>
                    <strong className='text-foreground'>Automático:</strong>{' '}
                    {summary.policy.automaticEnabled ? 'Sí' : 'No'} — {summary.policy.frequency},{' '}
                    FULL los {summary.policy.weeklyFullDay} a las {summary.policy.scheduleTime}
                  </li>
                  <li>
                    <strong className='text-foreground'>Retención:</strong>{' '}
                    {summary.policy.retentionFull} FULL + {summary.policy.retentionDiff} DIFF (
                    {summary.policy.compression})
                  </li>
                  <li>
                    <strong className='text-foreground'>RPO orientativo:</strong> ~24 h (DIFF diario
                    + WAL)
                  </li>
                  <li>
                    <strong className='text-foreground'>Restauración parcial:</strong> solo Export
                    .dump (UI → Restaurar)
                  </li>
                  <li>
                    <strong className='text-foreground'>DR cluster completo:</strong> pgBackRest (UI
                    o CLI)
                  </li>
                </ul>
              </div>

              <div className='rounded-lg border bg-background p-4 space-y-2'>
                <p className='font-medium text-xs uppercase tracking-wide text-muted-foreground'>
                  Operación reciente
                </p>
                <ul className='text-xs text-muted-foreground space-y-1'>
                  <li>
                    Completados: {summary.operations.totalCompleted} · Éxito:{' '}
                    {summary.operations.successRate}% · Fallidos: {summary.operations.failedCount}
                  </li>
                  <li>
                    Último FULL:{' '}
                    {summary.operations.lastFullBackup
                      ? new Date(summary.operations.lastFullBackup).toLocaleString('es-EC')
                      : '—'}
                  </li>
                  <li>
                    Último DIFF:{' '}
                    {summary.operations.lastDiffBackup
                      ? new Date(summary.operations.lastDiffBackup).toLocaleString('es-EC')
                      : '—'}
                  </li>
                  <li>
                    Último automático:{' '}
                    {summary.operations.lastAutomaticBackup
                      ? new Date(summary.operations.lastAutomaticBackup).toLocaleString('es-EC')
                      : '— (configura cron en servidor)'}
                  </li>
                  <li>
                    Último export:{' '}
                    {summary.operations.lastExportBackup
                      ? new Date(summary.operations.lastExportBackup).toLocaleString('es-EC')
                      : '—'}
                  </li>
                </ul>
              </div>
            </div>

            <div className='space-y-2'>
              <p className='font-medium text-xs uppercase tracking-wide text-muted-foreground'>
                Checklist de auditoría
              </p>
              <ul className='space-y-2'>
                {summary.checklist.map(item => (
                  <li
                    key={item.id}
                    className='flex gap-2 items-start rounded-md border bg-background px-3 py-2 text-xs'
                  >
                    <StatusIcon status={item.status} />
                    <div>
                      <p className='font-medium text-foreground'>{item.label}</p>
                      <p className='text-muted-foreground mt-0.5'>{item.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className='space-y-2'>
              <p className='font-medium text-xs uppercase tracking-wide text-muted-foreground'>
                Recomendaciones expertas
              </p>
              <ul className='list-disc pl-5 text-xs text-muted-foreground space-y-1'>
                {summary.recommendations.map(rec => (
                  <li key={rec}>{rec}</li>
                ))}
              </ul>
            </div>

            {!summary.cron.secretConfigured && (
              <div className='rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs'>
                <strong className='text-foreground'>Cron en el servidor:</strong> en Debian ejecuta{' '}
                <code className='text-[11px]'>{summary.cron.setupScript}</code> — registra una tarea
                horaria que llama <code className='text-[11px]'>{summary.cron.endpoint}</code> con
                tu <code className='text-[11px]'>CRON_SECRET</code>.
              </div>
            )}
          </>
        ) : (
          <p className='text-muted-foreground text-xs'>
            No se pudo cargar el resumen de auditoría.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
