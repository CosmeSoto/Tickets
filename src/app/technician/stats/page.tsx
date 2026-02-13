'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { StatsCard, SymmetricStatsCard } from '@/components/shared/stats-card'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle,
  Target,
  Award,
  Calendar,
  Zap,
  Users,
  Star,
  Activity,
  RefreshCw,
} from 'lucide-react'

interface TechnicianStats {
  today: {
    resolved: number
    assigned: number
    avgResponseTime: string
    avgResolutionTime: string
  }
  week: {
    resolved: number
    assigned: number
    avgSatisfaction: number
    productivity: number
  }
  month: {
    resolved: number
    assigned: number
    totalHours: number
    efficiency: number
  }
  performance: {
    responseTimeRank: number
    resolutionTimeRank: number
    satisfactionRank: number
    totalTechnicians: number
  }
}

interface CategoryStats {
  name: string
  resolved: number
  pending: number
  avgTime: string
  color: string
}

export default function TechnicianStatsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<TechnicianStats>({
    today: {
      resolved: 0,
      assigned: 0,
      avgResponseTime: '0h',
      avgResolutionTime: '0h',
    },
    week: {
      resolved: 0,
      assigned: 0,
      avgSatisfaction: 0,
      productivity: 0,
    },
    month: {
      resolved: 0,
      assigned: 0,
      totalHours: 0,
      efficiency: 0,
    },
    performance: {
      responseTimeRank: 0,
      resolutionTimeRank: 0,
      satisfactionRank: 0,
      totalTechnicians: 0,
    },
  })
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (!session) {
      router.push('/login')
      return
    }

    if (session.user.role !== 'TECHNICIAN') {
      router.push('/unauthorized')
      return
    }

    loadStats()
  }, [session, router])

  const loadStats = async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true)
    
    try {
      const response = await fetch('/api/technician/stats')
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.stats) {
          setStats(data.stats)
          setCategoryStats(data.categoryStats || [])
        } else {
          console.error('API returned unsuccessful response:', data)
        }
      } else {
        console.error('API request failed with status:', response.status)
        const errorData = await response.json().catch(() => ({}))
        console.error('Error details:', errorData)
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  if (isLoading) {
    return (
      <RoleDashboardLayout title="Estadísticas" subtitle="Mi rendimiento">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </RoleDashboardLayout>
    )
  }

  return (
    <RoleDashboardLayout
      title="Mis Estadísticas"
      subtitle="Análisis de rendimiento y productividad"
    >
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Panel de Rendimiento
            </h2>
            <p className="text-sm text-muted-foreground">
              Última actualización: {new Date().toLocaleString('es-ES')}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => loadStats(true)}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>

        {/* Today Stats */}
        <div>
          <h3 className="text-base font-semibold text-foreground mb-4 flex items-center">
            <Calendar className="h-5 w-5 mr-2 text-blue-600" />
            Hoy
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SymmetricStatsCard
              title="Resueltos Hoy"
              value={stats.today.resolved}
              icon={CheckCircle}
              color="green"
            />
            <SymmetricStatsCard
              title="Asignados Hoy"
              value={stats.today.assigned}
              icon={Target}
              color="blue"
            />
            <SymmetricStatsCard
              title="Tiempo de Respuesta"
              value={stats.today.avgResponseTime}
              icon={Zap}
              color="purple"
            />
            <SymmetricStatsCard
              title="Tiempo de Resolución"
              value={stats.today.avgResolutionTime}
              icon={Clock}
              color="orange"
            />
          </div>
        </div>

        {/* Week Stats */}
        <div>
          <h3 className="text-base font-semibold text-foreground mb-4 flex items-center">
            <Activity className="h-5 w-5 mr-2 text-green-600" />
            Esta Semana
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SymmetricStatsCard
              title="Resueltos"
              value={stats.week.resolved}
              icon={CheckCircle}
              color="green"
              trend={{ value: 15, label: 'vs semana pasada', isPositive: true }}
            />
            <SymmetricStatsCard
              title="Asignados"
              value={stats.week.assigned}
              icon={Target}
              color="blue"
              trend={{ value: 8, label: 'vs semana pasada', isPositive: true }}
            />
            <SymmetricStatsCard
              title="Satisfacción"
              value={`${stats.week.avgSatisfaction}/5`}
              icon={Star}
              color="orange"
            />
            <SymmetricStatsCard
              title="Productividad"
              value={`${stats.week.productivity}%`}
              icon={TrendingUp}
              color="purple"
              trend={{ value: 5, label: 'vs semana pasada', isPositive: true }}
            />
          </div>
        </div>

        {/* Month Stats */}
        <div>
          <h3 className="text-base font-semibold text-foreground mb-4 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-purple-600" />
            Este Mes
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SymmetricStatsCard
              title="Resueltos"
              value={stats.month.resolved}
              icon={CheckCircle}
              color="green"
            />
            <SymmetricStatsCard
              title="Asignados"
              value={stats.month.assigned}
              icon={Target}
              color="blue"
            />
            <SymmetricStatsCard
              title="Horas Trabajadas"
              value={stats.month.totalHours}
              icon={Clock}
              color="purple"
            />
            <SymmetricStatsCard
              title="Eficiencia"
              value={`${stats.month.efficiency}%`}
              icon={Award}
              color="orange"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Performance Ranking */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Award className="h-5 w-5 mr-2 text-yellow-600" />
                Ranking de Rendimiento
              </CardTitle>
              <CardDescription>
                Tu posición entre {stats.performance.totalTechnicians} técnicos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Zap className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Tiempo de Respuesta</p>
                    <p className="text-sm text-muted-foreground">
                      Qué tan rápido respondes
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge className="bg-blue-100 text-blue-800">
                    #{stats.performance.responseTimeRank}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    Top {Math.round((stats.performance.responseTimeRank / stats.performance.totalTechnicians) * 100)}%
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Tiempo de Resolución</p>
                    <p className="text-sm text-muted-foreground">
                      Qué tan rápido resuelves
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge className="bg-green-100 text-green-800">
                    #{stats.performance.resolutionTimeRank}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    Top {Math.round((stats.performance.resolutionTimeRank / stats.performance.totalTechnicians) * 100)}%
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <Star className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Satisfacción del Cliente</p>
                    <p className="text-sm text-muted-foreground">
                      Calificaciones recibidas
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge className="bg-yellow-100 text-yellow-800">
                    #{stats.performance.satisfactionRank}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    Top {Math.round((stats.performance.satisfactionRank / stats.performance.totalTechnicians) * 100)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Category Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="h-5 w-5 mr-2 text-purple-600" />
                Estadísticas por Categoría
              </CardTitle>
              <CardDescription>
                Rendimiento en tus categorías asignadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {categoryStats.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground">
                    No hay estadísticas de categorías disponibles
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {categoryStats.map((category, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 border border-border rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        <div>
                          <p className="font-medium text-foreground">{category.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Tiempo promedio: {category.avgTime}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center space-x-2">
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            {category.resolved} resueltos
                          </Badge>
                          <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                            {category.pending} pendientes
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Goals Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Target className="h-5 w-5 mr-2 text-blue-600" />
              Objetivos del Mes
            </CardTitle>
            <CardDescription>
              Progreso hacia tus metas mensuales
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">
                    Tickets Resueltos (Meta: 100)
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {stats.month.resolved}/100
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min((stats.month.resolved / 100) * 100, 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">
                    Satisfacción (Meta: 4.5/5)
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {stats.week.avgSatisfaction}/5
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-yellow-600 h-2 rounded-full transition-all"
                    style={{ width: `${(stats.week.avgSatisfaction / 5) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">
                    Eficiencia (Meta: 90%)
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {stats.month.efficiency}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${stats.month.efficiency}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </RoleDashboardLayout>
  )
}
