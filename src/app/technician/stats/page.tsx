'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { BackToTickets } from '@/components/tickets/back-to-tickets'
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
  }, [session, router]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadStats = async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true)

    try {
      // Usar el endpoint correcto del dashboard para técnico (sin query param de rol)
      const response = await fetch('/api/dashboard/stats')
      if (response.ok) {
        const data = await response.json()

        const mappedStats: TechnicianStats = {
          today: {
            resolved: data.completedToday || 0,
            assigned: data.assignedTickets || 0,
            avgResponseTime: data.avgFirstResponseTime || '0h',
            avgResolutionTime: data.avgResolutionTime || '0h',
          },
          week: {
            resolved: data.thisWeekResolved || 0,
            assigned: data.assignedTickets || 0,
            avgSatisfaction: data.satisfactionScore || 0,
            productivity:
              data.thisWeekResolved > 0
                ? Math.min(Math.round((data.thisWeekResolved / 7) * 10), 100)
                : 0,
          },
          month: {
            resolved: data.resolvedTickets || 0,
            assigned: data.assignedTickets || 0,
            totalHours: data.myResolutionPlans?.avgActualHours
              ? Math.round(data.myResolutionPlans.avgActualHours * data.myResolutionPlans.total)
              : 0,
            efficiency: data.myResolutionPlans?.efficiency || 0,
          },
        }

        setStats(mappedStats)

        // Cargar estadísticas por categoría desde el endpoint correcto
        loadCategoryStats()
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const loadCategoryStats = async () => {
    try {
      // Usar el endpoint específico de categorías del técnico
      const response = await fetch('/api/technician/categories')
      if (response.ok) {
        const data = await response.json()
        const cats = data.categories ?? []

        const mapped: CategoryStats[] = cats
          .map((cat: any) => ({
            name: cat.name,
            resolved: cat.stats?.resolved || 0,
            pending: (cat.stats?.open || 0) + (cat.stats?.inProgress || 0),
            avgTime: '—',
            color: cat.color || '#3b82f6',
          }))
          .sort(
            (a: CategoryStats, b: CategoryStats) =>
              b.resolved + b.pending - (a.resolved + a.pending)
          )

        setCategoryStats(mapped.slice(0, 5))
      }
    } catch (error) {
      console.error('Error loading category stats:', error)
    }
  }

  if (isLoading) {
    return (
      <RoleDashboardLayout title='Estadísticas' subtitle='Mi rendimiento'>
        <div className='flex items-center justify-center h-64'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600'></div>
        </div>
      </RoleDashboardLayout>
    )
  }

  return (
    <RoleDashboardLayout
      title='Mis Estadísticas'
      subtitle='Análisis de rendimiento y productividad'
    >
      <div className='space-y-6'>
        <BackToTickets />
        {/* Header Actions */}
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
          <div>
            <h2 className='text-lg font-semibold text-foreground'>Panel de Rendimiento</h2>
            <p className='text-sm text-muted-foreground'>
              Última actualización: {new Date().toLocaleString('es-ES')}
            </p>
          </div>
          <Button
            variant='outline'
            onClick={() => loadStats(true)}
            disabled={isRefreshing}
            className='self-start sm:self-auto'
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>

        {/* Today Stats */}
        <div>
          <h3 className='text-base font-semibold text-foreground mb-4 flex items-center'>
            <Calendar className='h-5 w-5 mr-2 text-blue-600' />
            Hoy
          </h3>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
            <SymmetricStatsCard
              title='Resueltos Hoy'
              value={stats.today.resolved}
              icon={CheckCircle}
              color='green'
            />
            <SymmetricStatsCard
              title='Asignados Hoy'
              value={stats.today.assigned}
              icon={Target}
              color='blue'
            />
            <SymmetricStatsCard
              title='Tiempo de Respuesta'
              value={stats.today.avgResponseTime}
              icon={Zap}
              color='purple'
            />
            <SymmetricStatsCard
              title='Tiempo de Resolución'
              value={stats.today.avgResolutionTime}
              icon={Clock}
              color='orange'
            />
          </div>
        </div>

        {/* Week Stats */}
        <div>
          <h3 className='text-base font-semibold text-foreground mb-4 flex items-center'>
            <Activity className='h-5 w-5 mr-2 text-green-600' />
            Esta Semana
          </h3>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
            <SymmetricStatsCard
              title='Resueltos'
              value={stats.week.resolved}
              icon={CheckCircle}
              color='green'
            />
            <SymmetricStatsCard
              title='Asignados'
              value={stats.week.assigned}
              icon={Target}
              color='blue'
            />
            <SymmetricStatsCard
              title='Satisfacción'
              value={`${stats.week.avgSatisfaction}/5`}
              icon={Star}
              color='orange'
              status={
                (stats.week.avgSatisfaction || 0) >= 4.5
                  ? 'success'
                  : (stats.week.avgSatisfaction || 0) >= 4
                    ? 'normal'
                    : 'warning'
              }
            />
            <SymmetricStatsCard
              title='Productividad'
              value={`${stats.week.productivity}%`}
              icon={TrendingUp}
              color='purple'
              status={
                stats.week.productivity >= 80
                  ? 'success'
                  : stats.week.productivity >= 60
                    ? 'normal'
                    : 'warning'
              }
            />
          </div>
        </div>

        {/* Month Stats */}
        <div>
          <h3 className='text-base font-semibold text-foreground mb-4 flex items-center'>
            <BarChart3 className='h-5 w-5 mr-2 text-purple-600' />
            Este Mes
          </h3>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
            <SymmetricStatsCard
              title='Resueltos'
              value={stats.month.resolved}
              icon={CheckCircle}
              color='green'
            />
            <SymmetricStatsCard
              title='Asignados'
              value={stats.month.assigned}
              icon={Target}
              color='blue'
            />
            <SymmetricStatsCard
              title='Horas Trabajadas'
              value={stats.month.totalHours}
              icon={Clock}
              color='purple'
            />
            <SymmetricStatsCard
              title='Eficiencia'
              value={`${stats.month.efficiency}%`}
              icon={Award}
              color='orange'
            />
          </div>
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
          {/* Estadísticas por Categoría */}
          <Card className='lg:col-span-2'>
            <CardHeader>
              <CardTitle className='flex items-center'>
                <BarChart3 className='h-5 w-5 mr-2 text-purple-600' />
                Estadísticas por Categoría
              </CardTitle>
              <CardDescription>Rendimiento en tus categorías asignadas</CardDescription>
            </CardHeader>
            <CardContent>
              {categoryStats.length === 0 ? (
                <div className='text-center py-8'>
                  <Users className='h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50' />
                  <p className='text-sm text-muted-foreground'>
                    No hay estadísticas de categorías disponibles
                  </p>
                </div>
              ) : (
                <div className='space-y-3'>
                  {categoryStats.map((category, index) => (
                    <div
                      key={index}
                      className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 border border-border rounded-lg'
                    >
                      <div className='flex items-center space-x-3'>
                        <div
                          className='w-3 h-3 rounded-full flex-shrink-0'
                          style={{ backgroundColor: category.color }}
                        />
                        <div>
                          <p className='font-medium text-foreground'>{category.name}</p>
                          <p className='text-xs text-muted-foreground'>
                            Tiempo promedio: {category.avgTime}
                          </p>
                        </div>
                      </div>
                      <div className='flex items-center gap-2 flex-wrap'>
                        <Badge
                          variant='secondary'
                          className='bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300'
                        >
                          {category.resolved} resueltos
                        </Badge>
                        <Badge
                          variant='secondary'
                          className='bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300'
                        >
                          {category.pending} pendientes
                        </Badge>
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
            <CardTitle className='flex items-center'>
              <Target className='h-5 w-5 mr-2 text-blue-600' />
              Objetivos del Mes
            </CardTitle>
            <CardDescription>Progreso hacia tus metas mensuales</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-4'>
              <div>
                <div className='flex items-center justify-between mb-2'>
                  <span className='text-sm font-medium text-foreground'>
                    Tickets Resueltos (Meta: 100)
                  </span>
                  <span className='text-sm text-muted-foreground'>{stats.month.resolved}/100</span>
                </div>
                <div className='w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2'>
                  <div
                    className='bg-green-600 dark:bg-green-500 h-2 rounded-full transition-all'
                    style={{ width: `${Math.min((stats.month.resolved / 100) * 100, 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className='flex items-center justify-between mb-2'>
                  <span className='text-sm font-medium text-foreground'>
                    Satisfacción (Meta: 4.5/5)
                  </span>
                  <span className='text-sm text-muted-foreground'>
                    {stats.week.avgSatisfaction}/5
                  </span>
                </div>
                <div className='w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2'>
                  <div
                    className='bg-yellow-500 h-2 rounded-full transition-all'
                    style={{ width: `${(stats.week.avgSatisfaction / 5) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className='flex items-center justify-between mb-2'>
                  <span className='text-sm font-medium text-foreground'>
                    Eficiencia (Meta: 90%)
                  </span>
                  <span className='text-sm text-muted-foreground'>{stats.month.efficiency}%</span>
                </div>
                <div className='w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2'>
                  <div
                    className='bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all'
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
