'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Database,
  HardDrive,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Zap,
} from 'lucide-react'

interface BackupDashboardProps {
  backups: any[]
  stats: any
  loading: boolean
}

export function BackupDashboard({ backups, stats, loading }: BackupDashboardProps) {
  const analysis = useMemo(() => {
    if (!backups.length) return null

    const completedBackups = backups.filter(b => b.status === 'completed')
    const failedBackups = backups.filter(b => b.status === 'failed')
    const manualBackups = backups.filter(b => b.type === 'manual')
    const automaticBackups = backups.filter(b => b.type === 'automatic')

    const successRate = backups.length > 0 ? (completedBackups.length / backups.length) * 100 : 0

    const last7Days = new Date()
    last7Days.setDate(last7Days.getDate() - 7)
    const recentBackups = backups.filter(b => new Date(b.createdAt) >= last7Days)

    const avgSize =
      completedBackups.length > 0
        ? completedBackups.reduce((sum, b) => sum + b.size, 0) / completedBackups.length
        : 0

    const lastBackup = completedBackups[0]
    const timeSinceLastBackup = lastBackup
      ? Date.now() - new Date(lastBackup.createdAt).getTime()
      : null

    return {
      successRate,
      failedCount: failedBackups.length,
      manualCount: manualBackups.length,
      automaticCount: automaticBackups.length,
      recentCount: recentBackups.length,
      avgSize,
      timeSinceLastBackup,
      lastBackup,
    }
  }, [backups])

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatTimeSince = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    if (days > 0) return `${days} día${days > 1 ? 's' : ''}`
    if (hours > 0) return `${hours} hora${hours > 1 ? 's' : ''}`
    return 'Hace poco'
  }

  const getHealthStatus = () => {
    if (stats?.pgbackrestAvailable === false) {
      return { status: 'warning', message: 'pgBackRest no disponible' }
    }
    if (!analysis) return { status: 'unknown', message: 'Sin datos' }

    const { successRate, timeSinceLastBackup } = analysis
    const hoursAgo = timeSinceLastBackup ? timeSinceLastBackup / (1000 * 60 * 60) : Infinity

    if (successRate >= 95 && hoursAgo <= 48) {
      return { status: 'excellent', message: 'Excelente' }
    }
    if (successRate >= 80 && hoursAgo <= 72) {
      return { status: 'good', message: 'Bueno' }
    }
    if (successRate >= 60) {
      return { status: 'warning', message: 'Atención' }
    }
    return { status: 'critical', message: 'Crítico' }
  }

  const healthStatus = getHealthStatus()

  return (
    <div className='space-y-6'>
      <div className='flex flex-wrap items-center gap-2'>
        <Badge
          variant={healthStatus.status === 'excellent' ? 'default' : 'secondary'}
          className='text-xs'
        >
          Estado: {healthStatus.message}
        </Badge>
        {stats?.pgbackrestAvailable === false && (
          <Badge variant='outline' className='text-xs text-amber-600 border-amber-500/40'>
            pgBackRest pendiente — ve a Config
          </Badge>
        )}
        {stats?.pgbackrestAvailable && (
          <Badge variant='outline' className='text-xs text-primary border-primary/30'>
            pgBackRest activo
          </Badge>
        )}
        {loading && (
          <Badge variant='outline' className='text-xs'>
            Actualizando…
          </Badge>
        )}
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6'>
        <Card className='relative overflow-hidden'>
          <CardContent className='p-6'>
            <div className='flex items-center justify-between mb-4'>
              <div className='p-3 rounded-lg bg-primary/10 border border-primary/20'>
                <Database className='h-6 w-6 text-primary' />
              </div>
              <div className='text-right'>
                <div className='text-2xl font-bold text-foreground'>{stats?.totalBackups || 0}</div>
                <div className='text-sm text-muted-foreground'>Total respaldos</div>
              </div>
            </div>
            {analysis && (
              <div className='space-y-2'>
                <div className='flex justify-between text-xs text-muted-foreground'>
                  <span>Tasa de éxito</span>
                  <span>{analysis.successRate.toFixed(1)}%</span>
                </div>
                <Progress value={analysis.successRate} className='h-2' />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className='relative overflow-hidden'>
          <CardContent className='p-6'>
            <div className='flex items-center justify-between mb-4'>
              <div className='p-3 rounded-lg bg-muted border border-border'>
                <HardDrive className='h-6 w-6 text-muted-foreground' />
              </div>
              <div className='text-right'>
                <div className='text-2xl font-bold text-foreground'>
                  {formatFileSize(stats?.totalSize || 0)}
                </div>
                <div className='text-sm text-muted-foreground'>Espacio total</div>
              </div>
            </div>
            {analysis && (
              <div className='text-xs text-muted-foreground'>
                <div>Promedio: {formatFileSize(analysis.avgSize)}</div>
                <div className='mt-1'>
                  {analysis.manualCount} manuales · {analysis.automaticCount} automáticos
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className='relative overflow-hidden'>
          <CardContent className='p-6'>
            <div className='flex items-center justify-between mb-4'>
              <div className='p-3 rounded-lg bg-muted border border-border'>
                <Clock className='h-6 w-6 text-muted-foreground' />
              </div>
              <div className='text-right'>
                <div className='text-lg font-bold text-foreground'>
                  {analysis?.timeSinceLastBackup
                    ? formatTimeSince(analysis.timeSinceLastBackup)
                    : 'Nunca'}
                </div>
                <div className='text-sm text-muted-foreground'>Último respaldo</div>
              </div>
            </div>
            {analysis?.lastBackup && (
              <div className='text-xs text-muted-foreground truncate'>
                {analysis.lastBackup.filename}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className='relative overflow-hidden'>
          <CardContent className='p-6'>
            <div className='flex items-center justify-between mb-4'>
              <div className='p-3 rounded-lg bg-muted border border-border'>
                <TrendingUp className='h-6 w-6 text-muted-foreground' />
              </div>
              <div className='text-right'>
                <div className='text-2xl font-bold text-foreground'>
                  {analysis?.recentCount || 0}
                </div>
                <div className='text-sm text-muted-foreground'>Últimos 7 días</div>
              </div>
            </div>
            {analysis && analysis.failedCount > 0 && (
              <div className='flex items-center space-x-1 text-xs text-destructive'>
                <AlertTriangle className='h-3 w-3' />
                <span>{analysis.failedCount} fallidos</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        <Card className='lg:col-span-2'>
          <CardHeader>
            <CardTitle className='flex items-center space-x-2'>
              <TrendingUp className='h-5 w-5 text-primary' />
              <span>Rendimiento</span>
            </CardTitle>
            <CardDescription>Métricas de los respaldos registrados</CardDescription>
          </CardHeader>
          <CardContent>
            {analysis ? (
              <div className='grid grid-cols-2 gap-6'>
                <div className='space-y-3'>
                  <div className='flex justify-between items-center'>
                    <span className='text-sm font-medium'>Tasa de éxito</span>
                    <span className='text-sm font-bold text-primary'>
                      {analysis.successRate.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={analysis.successRate} className='h-3' />
                </div>
                <div className='flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20'>
                  <div className='flex items-center space-x-2'>
                    <CheckCircle className='h-4 w-4 text-primary' />
                    <span className='text-sm font-medium'>Completados</span>
                  </div>
                  <span className='text-lg font-bold'>
                    {backups.filter(b => b.status === 'completed').length}
                  </span>
                </div>
              </div>
            ) : (
              <div className='text-center py-8 text-muted-foreground text-sm'>
                Sin datos suficientes
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center space-x-2'>
              <Zap className='h-5 w-5 text-primary' />
              <span>Infraestructura</span>
            </CardTitle>
            <CardDescription>Estado pgBackRest</CardDescription>
          </CardHeader>
          <CardContent className='space-y-3 text-sm'>
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>pgBackRest</span>
              <Badge variant={stats?.pgbackrestAvailable ? 'default' : 'destructive'}>
                {stats?.pgbackrestAvailable ? 'Disponible' : 'No disponible'}
              </Badge>
            </div>
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Último FULL</span>
              <span className='text-xs font-medium'>
                {stats?.lastFullBackup
                  ? new Date(stats.lastFullBackup).toLocaleDateString('es-EC')
                  : '—'}
              </span>
            </div>
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>Último DIFF</span>
              <span className='text-xs font-medium'>
                {stats?.lastDiffBackup
                  ? new Date(stats.lastDiffBackup).toLocaleDateString('es-EC')
                  : '—'}
              </span>
            </div>
            <p className='text-xs text-muted-foreground pt-2'>
              Detalle en vivo en la pestaña Monitoreo.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
