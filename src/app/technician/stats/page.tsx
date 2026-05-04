'use client'

import { useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { BackToTickets } from '@/components/tickets/back-to-tickets'
import { SymmetricStatsCard } from '@/components/shared/stats-card'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useModuleData } from '@/hooks/common/use-module-data'
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

interface TechnicianCategory {
  id: string
  categoryId: string
  name: string
  color: string
  stats: { open: number; inProgress: number; resolved: number; total: number }
  currentTickets: number
}

export default function TechnicianStatsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Datos del dashboard del técnico
  const {
    data: dashboardData,
    loading: dashLoading,
    error: dashError,
    reload: reloadDash,
  } = useModuleData<any>({
    endpoint: '/api/dashboard/stats',
    initialLoad: true,
    transform: (raw: any) => (raw ? [raw] : []),
  })

  // Categorías del técnico
  const {
    data: categories,
    loading: catLoading,
    reload: reloadCats,
  } = useModuleData<TechnicianCategory>({
    endpoint: '/api/technician/categories',
    initialLoad: true,
  })

  const reload = () => {
    reloadDash()
    reloadCats()
  }
  const loading = dashLoading || catLoading

  // Protección de ruta
  if (status === 'loading') return null
  if (!session || session.user.role !== 'TECHNICIAN') {
    if (typeof window !== 'undefined') router.push('/login')
    return null
  }

  // Extraer stats del primer elemento (la API devuelve un objeto, no array)
  const d = dashboardData[0] ?? {}

  const stats = {
    today: {
      resolved: d.completedToday || 0,
      assigned: d.assignedTickets || 0,
      avgResponseTime: d.avgFirstResponseTime || '—',
      avgResolutionTime: d.avgResolutionTime || '—',
    },
    week: {
      resolved: d.thisWeekResolved || 0,
      assigned: d.assignedTickets || 0,
      avgSatisfaction: d.satisfactionScore || 0,
      productivity:
        d.thisWeekResolved > 0 ? Math.min(Math.round((d.thisWeekResolved / 7) * 10), 100) : 0,
    },
    month: {
      resolved: d.resolvedTickets || 0,
      assigned: d.assignedTickets || 0,
      totalHours: d.myResolutionPlans?.avgActualHours
        ? Math.round(d.myResolutionPlans.avgActualHours * (d.myResolutionPlans.total || 0))
        : 0,
      efficiency: d.myResolutionPlans?.efficiency || 0,
    },
  }

  return (
    <ModuleLayout
      title='Mis Estadísticas'
      subtitle='Análisis de rendimiento y productividad'
      loading={loading && dashboardData.length === 0}
      error={dashError}
      onRetry={reload}
      headerActions={
        <Button variant='outline' size='sm' onClick={reload} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      }
    >
      <div className='space-y-6'>
        <BackToTickets />

        {/* Hoy */}
        <div>
          <h3 className='text-base font-semibold text-foreground mb-4 flex items-center'>
            <Calendar className='h-5 w-5 mr-2 text-blue-600 dark:text-blue-400' />
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
              title='Asignados'
              value={stats.today.assigned}
              icon={Target}
              color='blue'
            />
            <SymmetricStatsCard
              title='Tiempo Respuesta'
              value={stats.today.avgResponseTime}
              icon={Zap}
              color='purple'
            />
            <SymmetricStatsCard
              title='Tiempo Resolución'
              value={stats.today.avgResolutionTime}
              icon={Clock}
              color='orange'
            />
          </div>
        </div>

        {/* Esta semana */}
        <div>
          <h3 className='text-base font-semibold text-foreground mb-4 flex items-center'>
            <Activity className='h-5 w-5 mr-2 text-green-600 dark:text-green-400' />
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
                stats.week.avgSatisfaction >= 4.5
                  ? 'success'
                  : stats.week.avgSatisfaction >= 4
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

        {/* Este mes */}
        <div>
          <h3 className='text-base font-semibold text-foreground mb-4 flex items-center'>
            <BarChart3 className='h-5 w-5 mr-2 text-purple-600 dark:text-purple-400' />
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
              status={
                stats.month.efficiency >= 90
                  ? 'success'
                  : stats.month.efficiency >= 70
                    ? 'normal'
                    : 'warning'
              }
            />
          </div>
        </div>

        {/* Estadísticas por categoría */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center'>
              <BarChart3 className='h-5 w-5 mr-2 text-purple-600 dark:text-purple-400' />
              Estadísticas por Categoría
            </CardTitle>
            <CardDescription>Rendimiento en tus categorías asignadas</CardDescription>
          </CardHeader>
          <CardContent>
            {categories.length === 0 ? (
              <div className='text-center py-8'>
                <Users className='h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50' />
                <p className='text-sm text-muted-foreground'>
                  No hay estadísticas de categorías disponibles
                </p>
              </div>
            ) : (
              <div className='space-y-3'>
                {categories.map(cat => (
                  <div
                    key={cat.id}
                    className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors cursor-pointer'
                    onClick={() => router.push(`/technician/tickets?category=${cat.categoryId}`)}
                  >
                    <div className='flex items-center space-x-3'>
                      <div
                        className='w-3 h-3 rounded-full flex-shrink-0'
                        style={{ backgroundColor: cat.color || '#6B7280' }}
                      />
                      <div>
                        <p className='font-medium text-foreground'>{cat.name}</p>
                        <p className='text-xs text-muted-foreground'>
                          {cat.stats?.total || 0} tickets totales · {cat.currentTickets || 0}{' '}
                          activos míos
                        </p>
                      </div>
                    </div>
                    <div className='flex items-center gap-2 flex-wrap'>
                      <Badge
                        variant='secondary'
                        className='bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300'
                      >
                        {cat.stats?.resolved || 0} resueltos
                      </Badge>
                      <Badge
                        variant='secondary'
                        className='bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300'
                      >
                        {cat.stats?.open || 0} abiertos
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Objetivos del mes */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center'>
              <Target className='h-5 w-5 mr-2 text-blue-600 dark:text-blue-400' />
              Objetivos del Mes
            </CardTitle>
            <CardDescription>Progreso hacia tus metas mensuales</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='space-y-4'>
              {[
                {
                  label: 'Tickets Resueltos (Meta: 100)',
                  value: stats.month.resolved,
                  max: 100,
                  color: 'bg-green-600 dark:bg-green-500',
                },
                {
                  label: `Satisfacción (Meta: 4.5/5)`,
                  value: stats.week.avgSatisfaction,
                  max: 5,
                  color: 'bg-yellow-500',
                },
                {
                  label: 'Eficiencia (Meta: 90%)',
                  value: stats.month.efficiency,
                  max: 100,
                  color: 'bg-blue-600 dark:bg-blue-500',
                },
              ].map(goal => (
                <div key={goal.label}>
                  <div className='flex items-center justify-between mb-2'>
                    <span className='text-sm font-medium text-foreground'>{goal.label}</span>
                    <span className='text-sm text-muted-foreground'>
                      {goal.value}/{goal.max}
                    </span>
                  </div>
                  <div className='w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2'>
                    <div
                      className={`${goal.color} h-2 rounded-full transition-all`}
                      style={{ width: `${Math.min((goal.value / goal.max) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </ModuleLayout>
  )
}
