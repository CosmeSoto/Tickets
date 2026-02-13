'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card'
import { Badge } from './badge'
import { Progress } from './progress'
import { useToast } from '@/hooks/use-toast'
import { 
  Ticket, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  Star,
  Target,
  Calendar,
  BarChart3
} from 'lucide-react'

interface DashboardStats {
  tickets: {
    total: number
    open: number
    inProgress: number
    resolved: number
    closed: number
    overdue: number
    avgResolutionTime: number // en horas
    todayCreated: number
    weekCreated: number
    monthCreated: number
  }
  technicians: {
    total: number
    active: number
    avgRating: number
    topPerformer: {
      id: string
      name: string
      rating: number
      resolvedTickets: number
    }
    workload: Array<{
      id: string
      name: string
      assignedTickets: number
      avgRating: number
    }>
  }
  categories: {
    mostUsed: Array<{
      id: string
      name: string
      color: string
      count: number
      percentage: number
    }>
  }
  performance: {
    resolutionTrend: 'up' | 'down' | 'stable'
    resolutionChange: number // porcentaje
    satisfactionTrend: 'up' | 'down' | 'stable'
    satisfactionChange: number // porcentaje
    avgResponseTime: number // en horas
    slaCompliance: number // porcentaje
  }
}

interface DashboardStatsProps {
  period?: 'today' | 'week' | 'month' | 'quarter'
  refreshInterval?: number // en segundos
}

export function DashboardStats({ 
  period = 'month', 
  refreshInterval = 300 
}: DashboardStatsProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadStats()
    
    // Auto-refresh
    const interval = setInterval(loadStats, refreshInterval * 1000)
    return () => clearInterval(interval)
  }, [period, refreshInterval])

  const loadStats = async () => {
    try {
      const response = await fetch(`/api/dashboard/stats?period=${period}`)
      
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setStats(data.data)
          setLastUpdated(new Date())
          
          // Solo mostrar toast en actualizaciones manuales, no en auto-refresh
          if (lastUpdated) {
            toast({
              title: 'Estadísticas actualizadas',
              description: 'Los datos del dashboard han sido actualizados',
              variant: 'success',
            })
          }
        } else {
          throw new Error(data.error || 'Error al cargar estadísticas')
        }
      } else {
        throw new Error('Error de servidor')
      }
    } catch (err) {
      console.error('Error loading dashboard stats:', err)
      
      if (lastUpdated) { // Solo mostrar error si no es la primera carga
        toast({
          title: 'Error al actualizar estadísticas',
          description: 'No se pudieron cargar las estadísticas más recientes',
          variant: 'destructive',
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-600" />
      default:
        return <BarChart3 className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getTrendColor = (trend: 'up' | 'down' | 'stable', isPositive: boolean = true) => {
    if (trend === 'stable') return 'text-muted-foreground'
    
    const isGoodTrend = (trend === 'up' && isPositive) || (trend === 'down' && !isPositive)
    return isGoodTrend ? 'text-green-600' : 'text-red-600'
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No se pudieron cargar las estadísticas</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Estadísticas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total de tickets */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Tickets</p>
                <p className="text-3xl font-bold text-foreground">{stats.tickets.total}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  +{stats.tickets.todayCreated} hoy
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Ticket className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tickets abiertos */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tickets Abiertos</p>
                <p className="text-3xl font-bold text-orange-600">{stats.tickets.open}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.tickets.overdue} vencidos
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tickets resueltos */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Resueltos</p>
                <p className="text-3xl font-bold text-green-600">{stats.tickets.resolved}</p>
                <div className="flex items-center mt-1">
                  {getTrendIcon(stats.performance.resolutionTrend)}
                  <span className={`text-xs ml-1 ${getTrendColor(stats.performance.resolutionTrend)}`}>
                    {stats.performance.resolutionChange > 0 ? '+' : ''}{stats.performance.resolutionChange}%
                  </span>
                </div>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tiempo promedio de resolución */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tiempo Promedio</p>
                <p className="text-3xl font-bold text-purple-600">
                  {stats.tickets.avgResolutionTime}h
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Respuesta: {stats.performance.avgResponseTime}h
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos y detalles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribución de estados */}
        <Card>
          <CardHeader>
            <CardTitle>Distribución de Estados</CardTitle>
            <CardDescription>Estado actual de todos los tickets</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm">Abiertos</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">{stats.tickets.open}</span>
                  <span className="text-xs text-muted-foreground">
                    {Math.round((stats.tickets.open / stats.tickets.total) * 100)}%
                  </span>
                </div>
              </div>
              <Progress 
                value={(stats.tickets.open / stats.tickets.total) * 100} 
                className="h-2"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm">En Progreso</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">{stats.tickets.inProgress}</span>
                  <span className="text-xs text-muted-foreground">
                    {Math.round((stats.tickets.inProgress / stats.tickets.total) * 100)}%
                  </span>
                </div>
              </div>
              <Progress 
                value={(stats.tickets.inProgress / stats.tickets.total) * 100} 
                className="h-2"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm">Resueltos</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">{stats.tickets.resolved}</span>
                  <span className="text-xs text-muted-foreground">
                    {Math.round((stats.tickets.resolved / stats.tickets.total) * 100)}%
                  </span>
                </div>
              </div>
              <Progress 
                value={(stats.tickets.resolved / stats.tickets.total) * 100} 
                className="h-2"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-muted0 rounded-full"></div>
                  <span className="text-sm">Cerrados</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">{stats.tickets.closed}</span>
                  <span className="text-xs text-muted-foreground">
                    {Math.round((stats.tickets.closed / stats.tickets.total) * 100)}%
                  </span>
                </div>
              </div>
              <Progress 
                value={(stats.tickets.closed / stats.tickets.total) * 100} 
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>

        {/* Rendimiento del equipo */}
        <Card>
          <CardHeader>
            <CardTitle>Rendimiento del Equipo</CardTitle>
            <CardDescription>Estadísticas de técnicos activos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mejor técnico */}
            <div className="p-4 bg-yellow-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-yellow-800">Mejor Técnico</p>
                  <p className="text-lg font-bold text-yellow-900">
                    {stats.technicians.topPerformer.name}
                  </p>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className="flex items-center space-x-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-3 w-3 ${
                            star <= stats.technicians.topPerformer.rating
                              ? 'text-yellow-400 fill-current'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-yellow-700">
                      {stats.technicians.topPerformer.resolvedTickets} resueltos
                    </span>
                  </div>
                </div>
                <div className="p-2 bg-yellow-200 rounded-full">
                  <Target className="h-5 w-5 text-yellow-700" />
                </div>
              </div>
            </div>

            {/* Carga de trabajo */}
            <div>
              <h4 className="text-sm font-medium text-foreground mb-3">Carga de Trabajo</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {stats.technicians.workload.map((tech) => (
                  <div key={tech.id} className="flex items-center justify-between p-2 bg-muted rounded">
                    <div>
                      <p className="text-sm font-medium">{tech.name}</p>
                      <div className="flex items-center space-x-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-3 w-3 ${
                              star <= tech.avgRating
                                ? 'text-yellow-400 fill-current'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <Badge variant="outline">
                      {tech.assignedTickets} tickets
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Métricas generales */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{stats.technicians.active}</p>
                <p className="text-xs text-muted-foreground">Técnicos Activos</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {stats.technicians.avgRating.toFixed(1)}
                </p>
                <p className="text-xs text-muted-foreground">Rating Promedio</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Categorías más utilizadas y métricas de rendimiento */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Categorías más utilizadas */}
        <Card>
          <CardHeader>
            <CardTitle>Categorías Más Utilizadas</CardTitle>
            <CardDescription>Top categorías por número de tickets</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.categories.mostUsed.slice(0, 5).map((category) => (
                <div key={category.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="text-sm font-medium">{category.name}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-muted-foreground">{category.count}</span>
                    <Badge variant="outline" className="text-xs">
                      {category.percentage.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Métricas de rendimiento */}
        <Card>
          <CardHeader>
            <CardTitle>Métricas de Rendimiento</CardTitle>
            <CardDescription>Indicadores clave de rendimiento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* SLA Compliance */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Cumplimiento SLA</span>
                <span className="text-sm font-bold text-green-600">
                  {stats.performance.slaCompliance}%
                </span>
              </div>
              <Progress value={stats.performance.slaCompliance} className="h-2" />
            </div>

            {/* Satisfacción del cliente */}
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-blue-800">Satisfacción del Cliente</p>
                <div className="flex items-center space-x-2 mt-1">
                  {getTrendIcon(stats.performance.satisfactionTrend)}
                  <span className={`text-sm font-bold ${getTrendColor(stats.performance.satisfactionTrend)}`}>
                    {stats.performance.satisfactionChange > 0 ? '+' : ''}{stats.performance.satisfactionChange}%
                  </span>
                </div>
              </div>
              <div className="p-2 bg-blue-200 rounded-full">
                <Star className="h-5 w-5 text-blue-700" />
              </div>
            </div>

            {/* Tiempo de respuesta */}
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-purple-800">Tiempo de Respuesta</p>
                <p className="text-lg font-bold text-purple-900">
                  {stats.performance.avgResponseTime}h promedio
                </p>
              </div>
              <div className="p-2 bg-purple-200 rounded-full">
                <Clock className="h-5 w-5 text-purple-700" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Última actualización */}
      {lastUpdated && (
        <div className="text-center text-xs text-muted-foreground">
          <Calendar className="h-3 w-3 inline mr-1" />
          Última actualización: {lastUpdated.toLocaleString()}
        </div>
      )}
    </div>
  )
}