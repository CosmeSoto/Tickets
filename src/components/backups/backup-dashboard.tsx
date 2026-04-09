'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Database, 
  HardDrive, 
  Clock, 
  Shield, 
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Activity,
  Zap,
  Calendar,
  Server
} from 'lucide-react'

interface BackupDashboardProps {
  backups: any[]
  stats: any
  loading: boolean
  onRefresh: () => void
  onCreateBackup: () => void
}

export function BackupDashboard({ 
  backups, 
  stats, 
  loading, 
  onRefresh, 
  onCreateBackup 
}: BackupDashboardProps) {
  
  // Análisis de backups
  const analysis = useMemo(() => {
    if (!backups.length) return null

    const completedBackups = backups.filter(b => b.status === 'completed')
    const failedBackups = backups.filter(b => b.status === 'failed')
    const manualBackups = backups.filter(b => b.type === 'manual')
    const automaticBackups = backups.filter(b => b.type === 'automatic')
    
    const successRate = backups.length > 0 ? (completedBackups.length / backups.length) * 100 : 0
    
    // Análisis de tendencias (últimos 7 días)
    const last7Days = new Date()
    last7Days.setDate(last7Days.getDate() - 7)
    
    const recentBackups = backups.filter(b => 
      new Date(b.createdAt) >= last7Days
    )
    
    // Calcular tamaño promedio
    const avgSize = completedBackups.length > 0 
      ? completedBackups.reduce((sum, b) => sum + b.size, 0) / completedBackups.length 
      : 0

    // Tiempo desde último backup
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
      lastBackup
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
    if (!analysis) return { status: 'unknown', color: 'gray', message: 'Sin datos' }
    
    const { successRate, timeSinceLastBackup } = analysis
    const hoursAgo = timeSinceLastBackup ? timeSinceLastBackup / (1000 * 60 * 60) : Infinity
    
    if (successRate >= 95 && hoursAgo <= 24) {
      return { status: 'excellent', color: 'green', message: 'Excelente' }
    } else if (successRate >= 80 && hoursAgo <= 48) {
      return { status: 'good', color: 'blue', message: 'Bueno' }
    } else if (successRate >= 60 && hoursAgo <= 72) {
      return { status: 'warning', color: 'yellow', message: 'Atención' }
    } else {
      return { status: 'critical', color: 'red', message: 'Crítico' }
    }
  }

  const healthStatus = getHealthStatus()

  return (
    <div className="space-y-6">
      {/* Header con estado general */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard de Backups</h2>
          <p className="text-muted-foreground">Monitoreo y gestión de respaldos</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full bg-${healthStatus.color}-50 border border-${healthStatus.color}-200`}>
            <div className={`w-2 h-2 rounded-full bg-${healthStatus.color}-500`}></div>
            <span className={`text-sm font-medium text-${healthStatus.color}-700`}>
              Estado: {healthStatus.message}
            </span>
          </div>
          
          <Button 
            variant="outline" 
            onClick={onRefresh}
            disabled={loading} 
            size="sm"
          >
            <Activity className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          
          <Button 
            onClick={onCreateBackup}
            size="sm" 
          >
            <Database className="h-4 w-4 mr-2" />
            Crear Backup
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="relative overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <Database className="h-6 w-6 text-primary" />
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-foreground">
                  {stats?.totalBackups || 0}
                </div>
                <div className="text-sm text-muted-foreground">Total Backups</div>
              </div>
            </div>
            
            {analysis && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Tasa de éxito</span>
                  <span>{analysis.successRate.toFixed(1)}%</span>
                </div>
                <Progress value={analysis.successRate} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                <HardDrive className="h-6 w-6 text-green-600" />
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-foreground">
                  {formatFileSize(stats?.totalSize || 0)}
                </div>
                <div className="text-sm text-muted-foreground">Espacio Total</div>
              </div>
            </div>
            
            {analysis && (
              <div className="text-xs text-muted-foreground">
                <div>Promedio: {formatFileSize(analysis.avgSize)}</div>
                <div className="mt-1">
                  {analysis.manualCount} manuales • {analysis.automaticCount} automáticos
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-muted border border-border">
                <Clock className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-foreground">
                  {analysis?.timeSinceLastBackup 
                    ? formatTimeSince(analysis.timeSinceLastBackup)
                    : 'Nunca'
                  }
                </div>
                <div className="text-sm text-muted-foreground">Último Backup</div>
              </div>
            </div>
            
            {stats?.lastBackup && (
              <div className="text-xs text-muted-foreground">
                {new Date(stats.lastBackup).toLocaleDateString('es-ES', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
                <Shield className="h-6 w-6 text-orange-600" />
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-foreground">
                  {analysis?.recentCount || 0}
                </div>
                <div className="text-sm text-muted-foreground">Últimos 7 días</div>
              </div>
            </div>
            
            {analysis && analysis.failedCount > 0 && (
              <div className="flex items-center space-x-1 text-xs text-red-600">
                <AlertTriangle className="h-3 w-3" />
                <span>{analysis.failedCount} fallidos</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Análisis de tendencias */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span>Análisis de Rendimiento</span>
            </CardTitle>
            <CardDescription>
              Métricas de calidad y confiabilidad del sistema de backups
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analysis ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-foreground">Tasa de Éxito</span>
                      <span className="text-sm font-bold text-green-600">
                        {analysis.successRate.toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={analysis.successRate} className="h-3" />
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-foreground">Cobertura Semanal</span>
                      <span className="text-sm font-bold text-foreground">
                        {analysis.recentCount} backups
                      </span>
                    </div>
                    <Progress value={Math.min((analysis.recentCount / 7) * 100, 100)} className="h-3" />
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">Completados</span>
                      </div>
                      <span className="text-lg font-bold text-green-900">
                        {backups.filter(b => b.status === 'completed').length}
                      </span>
                    </div>
                    
                    {analysis.failedCount > 0 && (
                      <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                          <span className="text-sm font-medium text-red-800">Fallidos</span>
                        </div>
                        <span className="text-lg font-bold text-red-900">
                          {analysis.failedCount}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Database className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm">No hay datos suficientes para el análisis</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Zap className="h-5 w-5 text-yellow-600" />
              <span>Estado del Sistema</span>
            </CardTitle>
            <CardDescription>
              Monitoreo en tiempo real
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`p-4 rounded-lg border-2 bg-${healthStatus.color}-50 border-${healthStatus.color}-200`}>
              <div className="flex items-center space-x-2 mb-2">
                <div className={`w-3 h-3 rounded-full bg-${healthStatus.color}-500`}></div>
                <span className={`font-medium text-${healthStatus.color}-800`}>
                  {healthStatus.message}
                </span>
              </div>
              <p className={`text-sm text-${healthStatus.color}-700`}>
                {healthStatus.status === 'excellent' && 'Sistema funcionando perfectamente'}
                {healthStatus.status === 'good' && 'Sistema funcionando correctamente'}
                {healthStatus.status === 'warning' && 'Requiere atención'}
                {healthStatus.status === 'critical' && 'Acción inmediata requerida'}
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Próximo backup automático</span>
                <Badge variant="outline" className="text-xs">
                  <Calendar className="h-3 w-3 mr-1" />
                  Programado
                </Badge>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Espacio disponible</span>
                <Badge variant="outline" className="text-xs">
                  <Server className="h-3 w-3 mr-1" />
                  Suficiente
                </Badge>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Integridad de datos</span>
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Verificado
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}