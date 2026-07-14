'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  Server,
  HardDrive,
  Database,
  Zap,
  TrendingUp,
  Bell,
} from 'lucide-react'

interface SystemHealth {
  database: {
    status: 'connected' | 'disconnected' | 'error'
    responseTime: number
    lastCheck: string
  }
  storage: {
    available: number
    used: number
    total: number
    status: 'healthy' | 'warning' | 'critical'
  }
  diskUsage?: {
    repoPath: string
    repoUsedBytes: number
    availableBytes: number
    totalBytes: number
    usagePercent: number
    status: 'healthy' | 'warning' | 'critical'
  } | null
  backupService: {
    status: 'running' | 'stopped' | 'error' | 'degraded'
    backupEnabled?: boolean
    frequency?: string
    scheduleTime?: string
    lastBackup: string | null
    nextScheduled: string | null
    pgBackRestAvailable?: boolean
    pgBackRestStanza?: string
    allowRestore?: boolean
    exportAvailable?: boolean
  }
  performance: {
    avgBackupTime: number | null
    successRate: number
    compressionRatio: number | null
    totalBackups: number
    completedBackups: number
    failedBackups: number
  }
}

interface BackupAlert {
  id: string
  type: 'info' | 'warning' | 'error'
  title: string
  message: string
  timestamp: string
  resolved: boolean
}

export function BackupMonitoring() {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [alerts, setAlerts] = useState<BackupAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const { toast } = useToast()

  useEffect(() => {
    void refreshMonitoring(false)

    const interval = setInterval(() => {
      void refreshMonitoring(false)
    }, 30000)

    return () => clearInterval(interval)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshMonitoring = async (showToast: boolean) => {
    setLoading(true)
    let healthOk = false
    let criticalCount = 0

    try {
      const healthRes = await fetch('/api/admin/backups/health')
      if (healthRes.ok) {
        setHealth(await healthRes.json())
        setLastUpdate(new Date())
        healthOk = true
      } else {
        setHealth(null)
      }
    } catch (error) {
      console.error('Error loading system health:', error)
      setHealth(null)
      if (showToast) {
        toast({
          title: 'Error de conexión',
          description: 'No se pudo cargar el estado del sistema',
          variant: 'destructive',
        })
      }
    }

    try {
      const alertsRes = await fetch('/api/admin/backups/alerts')
      if (alertsRes.ok) {
        const data = await alertsRes.json()
        setAlerts(data)
        criticalCount = data.filter(
          (alert: BackupAlert) => alert.type === 'error' && !alert.resolved
        ).length
      }
    } catch (error) {
      console.error('Error loading alerts:', error)
      setAlerts([])
    }

    setLoading(false)

    if (!showToast || !healthOk) return

    if (criticalCount > 0) {
      toast({
        title: 'Alertas críticas',
        description: `${criticalCount} alerta(s) requieren atención — revisa el panel inferior`,
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'Monitoreo actualizado',
        description: 'Estado del sistema cargado correctamente',
      })
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatTime = (minutes: number | null) => {
    if (minutes === null || minutes === 0) return 'Sin datos'
    if (minutes < 60) return `${minutes.toFixed(1)} min`
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    return `${hours}h ${mins}m`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
      case 'running':
      case 'healthy':
        return 'text-primary bg-primary/5 border-primary/20'
      case 'warning':
        return 'text-destructive bg-destructive/10 border-destructive/20'
      case 'disconnected':
      case 'stopped':
      case 'error':
      case 'critical':
        return 'text-destructive bg-destructive/20 border-destructive/40'
      default:
        return 'text-muted-foreground bg-muted border-border'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
      case 'running':
      case 'healthy':
        return <CheckCircle className='h-4 w-4 text-primary' />
      case 'warning':
        return <AlertTriangle className='h-4 w-4 text-destructive' />
      case 'disconnected':
      case 'stopped':
      case 'error':
      case 'critical':
        return <AlertTriangle className='h-4 w-4 text-destructive' />
      default:
        return <Clock className='h-4 w-4 text-muted-foreground' />
    }
  }

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'info':
        return <CheckCircle className='h-4 w-4 text-primary' />
      case 'warning':
        return <AlertTriangle className='h-4 w-4 text-destructive' />
      case 'error':
        return <AlertTriangle className='h-4 w-4 text-destructive' />
      default:
        return <Bell className='h-4 w-4 text-muted-foreground' />
    }
  }

  if (loading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto'></div>
          <p className='mt-2 text-muted-foreground'>Cargando estado del sistema...</p>
        </div>
      </div>
    )
  }

  if (!health) {
    return (
      <Alert className='border-destructive/40 bg-destructive/10'>
        <AlertTriangle className='h-4 w-4 text-destructive' />
        <AlertDescription className='text-destructive'>
          No se pudo cargar el estado del sistema. Verifique la conectividad.
        </AlertDescription>
      </Alert>
    )
  }

  const activeAlerts = alerts.filter(alert => !alert.resolved)
  const storageUsagePercent =
    health.storage.total > 0 ? (health.storage.used / health.storage.total) * 100 : 0

  return (
    <div className='space-y-6'>
      {/* Header con última actualización */}
      <div className='flex justify-between items-center'>
        <div>
          <h2 className='text-2xl font-bold text-foreground'>Monitoreo del Sistema</h2>
          <p className='text-muted-foreground'>
            Última actualización: {lastUpdate.toLocaleTimeString('es-ES')}
          </p>
        </div>

        <Button
          variant='outline'
          onClick={() => void refreshMonitoring(true)}
          size='sm'
          disabled={loading}
          title='Recargar estado del worker y alertas'
        >
          <Activity className='h-4 w-4 mr-2' />
          Recargar
        </Button>
      </div>

      {health.diskUsage && (
        <Alert
          className={
            health.diskUsage.status === 'critical'
              ? 'border-destructive/50 bg-destructive/10'
              : health.diskUsage.status === 'warning'
                ? 'border-amber-500/40 bg-amber-500/10'
                : 'border-primary/30 bg-primary/5'
          }
        >
          <HardDrive className='h-4 w-4' />
          <AlertDescription className='text-sm space-y-1'>
            <div>
              <strong>Repositorio pgBackRest</strong> ({health.diskUsage.repoPath}):{' '}
              {formatFileSize(health.diskUsage.repoUsedBytes)} en backups ·{' '}
              {health.diskUsage.usagePercent.toFixed(1)}% del disco ·{' '}
              {formatFileSize(health.diskUsage.availableBytes)} libres
            </div>
            <div className='text-xs text-muted-foreground'>
              Retención activa: 2 FULL + 7 DIFF — pgBackRest purga automáticamente al crear nuevos
              respaldos. Monitorea aquí si el disco supera 75%.
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Estado general del sistema */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
        <Card>
          <CardContent className='p-6'>
            <div className='flex items-center justify-between mb-4'>
              <div className='p-3 rounded-lg bg-muted border border-border'>
                <Database className='h-6 w-6 text-muted-foreground' />
              </div>
              {getStatusIcon(health.database.status)}
            </div>
            <div className='space-y-2'>
              <div className='text-lg font-bold text-foreground'>Base de Datos</div>
              <div
                className={`text-sm px-2 py-1 rounded border ${getStatusColor(health.database.status)}`}
              >
                {health.database.status === 'connected' ? 'Conectada' : 'Desconectada'}
              </div>
              <div className='text-xs text-muted-foreground'>
                Tiempo de respuesta: {health.database.responseTime}ms
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-6'>
            <div className='flex items-center justify-between mb-4'>
              <div className='p-3 rounded-lg bg-muted border border-border'>
                <HardDrive className='h-6 w-6 text-muted-foreground' />
              </div>
              {getStatusIcon(health.storage.status)}
            </div>
            <div className='space-y-2'>
              <div className='text-lg font-bold text-foreground'>Exports .dump</div>
              <div
                className={`text-sm px-2 py-1 rounded border ${getStatusColor(health.storage.status)}`}
              >
                {formatFileSize(health.storage.available)} libres en disco
              </div>
              <div className='space-y-1'>
                <div className='flex justify-between text-xs text-muted-foreground'>
                  <span>Archivos export: {formatFileSize(health.storage.used)}</span>
                  {health.diskUsage && (
                    <span>pgBackRest: {formatFileSize(health.diskUsage.repoUsedBytes)}</span>
                  )}
                </div>
                <Progress value={storageUsagePercent} className='h-2' />
                <div className='text-xs text-muted-foreground'>
                  Barra: uso de exports vs espacio total del volumen
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-6'>
            <div className='flex items-center justify-between mb-4'>
              <div className='p-3 rounded-lg bg-muted border border-border'>
                <Server className='h-6 w-6 text-muted-foreground' />
              </div>
              {getStatusIcon(health.backupService.status)}
            </div>
            <div className='space-y-2'>
              <div className='text-lg font-bold text-foreground'>pgBackRest</div>
              <div
                className={`text-sm px-2 py-1 rounded border ${getStatusColor(health.backupService.pgBackRestAvailable ? 'running' : 'error')}`}
              >
                {health.backupService.pgBackRestAvailable
                  ? `Stanza ${health.backupService.pgBackRestStanza || 'main'} OK`
                  : 'No disponible'}
              </div>
              <div className='text-xs text-muted-foreground'>
                Exportaciones:{' '}
                {health.backupService.exportAvailable ? 'pg_dump OK' : 'No disponible'}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className='p-6'>
            <div className='flex items-center justify-between mb-4'>
              <div className='p-3 rounded-lg bg-muted border border-border'>
                <TrendingUp className='h-6 w-6 text-muted-foreground' />
              </div>
              {health.performance.successRate >= 80 ? (
                <CheckCircle className='h-4 w-4 text-primary' />
              ) : (
                <AlertTriangle className='h-4 w-4 text-destructive' />
              )}
            </div>
            <div className='space-y-2'>
              <div className='text-lg font-bold text-foreground'>Rendimiento</div>
              <div className='text-sm text-primary bg-primary/5 px-2 py-1 rounded border border-primary/20'>
                {health.performance.successRate}% éxito
              </div>
              <div className='text-xs text-muted-foreground'>
                Tiempo promedio: {formatTime(health.performance.avgBackupTime)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Métricas detalladas */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center space-x-2'>
              <Zap className='h-5 w-5 text-primary' />
              <span>Métricas de Rendimiento</span>
            </CardTitle>
            <CardDescription>Estadísticas de eficiencia y optimización</CardDescription>
          </CardHeader>
          <CardContent className='space-y-6'>
            <div className='grid grid-cols-2 gap-4'>
              <div className='text-center p-4 bg-muted/50 rounded-lg border border-border'>
                <div className='text-2xl font-bold text-foreground'>
                  {health.performance.successRate.toFixed(1)}%
                </div>
                <div className='text-sm text-muted-foreground'>Tasa de Éxito</div>
              </div>
              <div className='text-center p-4 bg-muted/50 rounded-lg border border-border'>
                <div className='text-2xl font-bold text-foreground'>
                  {health.performance.compressionRatio !== null
                    ? `${health.performance.compressionRatio}%`
                    : 'N/A'}
                </div>
                <div className='text-sm text-muted-foreground'>Compresión</div>
              </div>
            </div>

            <div className='space-y-3'>
              <div className='flex justify-between items-center'>
                <span className='text-sm font-medium text-foreground'>Tiempo Promedio</span>
                <span className='text-sm font-bold text-foreground'>
                  {formatTime(health.performance.avgBackupTime)}
                </span>
              </div>

              <div className='flex justify-between items-center'>
                <span className='text-sm font-medium text-foreground'>Backups (30 días)</span>
                <span className='text-sm font-bold text-foreground'>
                  {health.performance.completedBackups} completados
                  {health.performance.failedBackups > 0 && (
                    <span className='text-destructive ml-1'>
                      · {health.performance.failedBackups} fallidos
                    </span>
                  )}
                </span>
              </div>

              <div className='flex justify-between items-center'>
                <span className='text-sm font-medium text-foreground'>Próximo Backup</span>
                <span className='text-sm font-bold text-foreground'>
                  {health.backupService.nextScheduled
                    ? new Date(health.backupService.nextScheduled).toLocaleString('es-ES', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : health.backupService.backupEnabled === false
                      ? 'Deshabilitado'
                      : 'No programado'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='flex items-center space-x-2'>
              <Bell className='h-5 w-5 text-primary' />
              <span>Alertas del Sistema</span>
            </CardTitle>
            <CardDescription>Notificaciones y eventos recientes</CardDescription>
          </CardHeader>
          <CardContent>
            {activeAlerts.length === 0 ? (
              <div className='text-center py-8 text-muted-foreground'>
                <CheckCircle className='h-8 w-8 mx-auto mb-2 text-primary' />
                <p className='text-sm'>No hay alertas activas</p>
                <p className='text-xs'>El sistema está funcionando correctamente</p>
              </div>
            ) : (
              <div className='space-y-3 max-h-64 overflow-y-auto'>
                {activeAlerts.map(alert => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-lg border ${
                      alert.type === 'error'
                        ? 'bg-destructive/10 border-destructive/30'
                        : alert.type === 'warning'
                          ? 'bg-destructive/5 border-destructive/20'
                          : 'bg-muted/50 border-border'
                    }`}
                  >
                    <div className='flex items-start space-x-3'>
                      {getAlertIcon(alert.type)}
                      <div className='flex-1 min-w-0'>
                        <div className='flex items-center justify-between'>
                          <p className='text-sm font-medium text-foreground'>{alert.title}</p>
                          {alert.resolved && (
                            <Badge variant='outline' className='text-xs'>
                              Resuelto
                            </Badge>
                          )}
                        </div>
                        <p className='text-xs text-muted-foreground mt-1'>{alert.message}</p>
                        <p className='text-xs text-muted-foreground mt-1'>
                          {new Date(alert.timestamp).toLocaleString('es-ES')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
