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
  Bell
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
  backupService: {
    status: 'running' | 'stopped' | 'error'
    lastBackup: string | null
    nextScheduled: string | null
  }
  performance: {
    avgBackupTime: number
    successRate: number
    compressionRatio: number
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
    loadSystemHealth()
    loadAlerts()
    
    // Actualizar cada 30 segundos
    const interval = setInterval(() => {
      loadSystemHealth()
      loadAlerts()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const loadSystemHealth = async () => {
    try {
      const response = await fetch('/api/admin/backups/health')
      if (response.ok) {
        const data = await response.json()
        setHealth(data)
        setLastUpdate(new Date())
        
        toast({
          title: 'Estado actualizado',
          description: 'Información del sistema cargada correctamente',
          variant: 'success',
        })
      } else {
        throw new Error('Error al cargar estado del sistema')
      }
    } catch (error) {
      console.error('Error loading system health:', error)
      
      toast({
        title: 'Error de conexión',
        description: 'No se pudo conectar con el servicio de monitoreo. Mostrando datos de ejemplo.',
        variant: 'warning',
      })
      
      // Datos de ejemplo para desarrollo
      setHealth({
        database: {
          status: 'connected',
          responseTime: 45,
          lastCheck: new Date().toISOString()
        },
        storage: {
          available: 85 * 1024 * 1024 * 1024, // 85GB
          used: 15 * 1024 * 1024 * 1024,     // 15GB
          total: 100 * 1024 * 1024 * 1024,   // 100GB
          status: 'healthy'
        },
        backupService: {
          status: 'running',
          lastBackup: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 horas atrás
          nextScheduled: new Date(Date.now() + 22 * 60 * 60 * 1000).toISOString() // en 22 horas
        },
        performance: {
          avgBackupTime: 3.5, // minutos
          successRate: 98.5,
          compressionRatio: 65
        }
      })
    } finally {
      setLoading(false)
    }
  }

  const loadAlerts = async () => {
    try {
      const response = await fetch('/api/admin/backups/alerts')
      if (response.ok) {
        const data = await response.json()
        setAlerts(data)
        
        // Notificar sobre alertas críticas
        const criticalAlerts = data.filter((alert: BackupAlert) => 
          alert.type === 'error' && !alert.resolved
        )
        
        if (criticalAlerts.length > 0) {
          toast({
            title: 'Alertas críticas detectadas',
            description: `${criticalAlerts.length} alerta(s) requieren atención inmediata`,
            variant: 'destructive',
          })
        }
      }
    } catch (error) {
      console.error('Error loading alerts:', error)
      
      toast({
        title: 'Error al cargar alertas',
        description: 'No se pudieron cargar las alertas del sistema. Mostrando datos de ejemplo.',
        variant: 'warning',
      })
      
      // Alertas de ejemplo
      setAlerts([
        {
          id: '1',
          type: 'info',
          title: 'Backup completado',
          message: 'Backup automático completado exitosamente',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          resolved: true
        },
        {
          id: '2',
          type: 'warning',
          title: 'Espacio en disco',
          message: 'El espacio disponible está por debajo del 20%',
          timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          resolved: false
        }
      ])
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatTime = (minutes: number) => {
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
        return 'text-green-600 bg-green-50 border-green-200'
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'disconnected':
      case 'stopped':
      case 'error':
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200'
      default:
        return 'text-muted-foreground bg-muted border-border'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
      case 'running':
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'disconnected':
      case 'stopped':
      case 'error':
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'info':
        return <CheckCircle className="h-4 w-4 text-blue-600" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      default:
        return <Bell className="h-4 w-4 text-muted-foreground" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Cargando estado del sistema...</p>
        </div>
      </div>
    )
  }

  if (!health) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          No se pudo cargar el estado del sistema. Verifique la conectividad.
        </AlertDescription>
      </Alert>
    )
  }

  const storageUsagePercent = (health.storage.used / health.storage.total) * 100

  return (
    <div className="space-y-6">
      {/* Header con última actualización */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Monitoreo del Sistema</h2>
          <p className="text-muted-foreground">
            Última actualización: {lastUpdate.toLocaleTimeString('es-ES')}
          </p>
        </div>
        
        <Button variant="outline" onClick={() => {
          loadSystemHealth()
          toast({
            title: 'Actualizando...',
            description: 'Obteniendo el estado más reciente del sistema',
            variant: 'info',
          })
        }} size="sm">
          <Activity className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Estado general del sistema */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <Database className="h-6 w-6 text-blue-600" />
              </div>
              {getStatusIcon(health.database.status)}
            </div>
            
            <div className="space-y-2">
              <div className="text-lg font-bold text-foreground">Base de Datos</div>
              <div className={`text-sm px-2 py-1 rounded border ${getStatusColor(health.database.status)}`}>
                {health.database.status === 'connected' ? 'Conectada' : 'Desconectada'}
              </div>
              <div className="text-xs text-muted-foreground">
                Tiempo de respuesta: {health.database.responseTime}ms
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                <HardDrive className="h-6 w-6 text-green-600" />
              </div>
              {getStatusIcon(health.storage.status)}
            </div>
            
            <div className="space-y-2">
              <div className="text-lg font-bold text-foreground">Almacenamiento</div>
              <div className={`text-sm px-2 py-1 rounded border ${getStatusColor(health.storage.status)}`}>
                {formatFileSize(health.storage.available)} disponible
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Usado: {storageUsagePercent.toFixed(1)}%</span>
                  <span>{formatFileSize(health.storage.used)}</span>
                </div>
                <Progress value={storageUsagePercent} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
                <Server className="h-6 w-6 text-purple-600" />
              </div>
              {getStatusIcon(health.backupService.status)}
            </div>
            
            <div className="space-y-2">
              <div className="text-lg font-bold text-foreground">Servicio Backup</div>
              <div className={`text-sm px-2 py-1 rounded border ${getStatusColor(health.backupService.status)}`}>
                {health.backupService.status === 'running' ? 'Activo' : 'Inactivo'}
              </div>
              <div className="text-xs text-muted-foreground">
                {health.backupService.lastBackup 
                  ? `Último: ${new Date(health.backupService.lastBackup).toLocaleString('es-ES', { 
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                    })}`
                  : 'Sin backups recientes'
                }
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                <TrendingUp className="h-6 w-6 text-orange-600" />
              </div>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
            
            <div className="space-y-2">
              <div className="text-lg font-bold text-foreground">Rendimiento</div>
              <div className="text-sm text-green-600 bg-green-50 px-2 py-1 rounded border border-green-200">
                {health.performance.successRate}% éxito
              </div>
              <div className="text-xs text-muted-foreground">
                Tiempo promedio: {formatTime(health.performance.avgBackupTime)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Métricas detalladas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Zap className="h-5 w-5 text-yellow-600" />
              <span>Métricas de Rendimiento</span>
            </CardTitle>
            <CardDescription>
              Estadísticas de eficiencia y optimización
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-700">
                  {health.performance.successRate}%
                </div>
                <div className="text-sm text-blue-600">Tasa de Éxito</div>
              </div>
              
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-700">
                  {health.performance.compressionRatio}%
                </div>
                <div className="text-sm text-green-600">Compresión</div>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-foreground">Tiempo Promedio</span>
                <span className="text-sm font-bold text-foreground">
                  {formatTime(health.performance.avgBackupTime)}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-foreground">Próximo Backup</span>
                <span className="text-sm font-bold text-foreground">
                  {health.backupService.nextScheduled 
                    ? new Date(health.backupService.nextScheduled).toLocaleString('es-ES', {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })
                    : 'No programado'
                  }
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bell className="h-5 w-5 text-red-600" />
              <span>Alertas del Sistema</span>
            </CardTitle>
            <CardDescription>
              Notificaciones y eventos recientes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-400" />
                <p className="text-sm">No hay alertas activas</p>
                <p className="text-xs">El sistema está funcionando correctamente</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-lg border ${
                      alert.type === 'error' ? 'bg-red-50 border-red-200' :
                      alert.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                      'bg-blue-50 border-blue-200'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      {getAlertIcon(alert.type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-foreground">
                            {alert.title}
                          </p>
                          {alert.resolved && (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                              Resuelto
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {alert.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
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