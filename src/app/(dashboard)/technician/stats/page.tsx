'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { BackToTickets } from '@/components/tickets/back-to-tickets'
import { SymmetricStatsCard } from '@/components/shared/stats-card'
import { useLiveTicketRefresh } from '@/hooks/use-live-ticket-refresh'
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

interface TechStats {
  today: { resolved: number; assigned: number; avgResponseTime: string; avgResolutionTime: string }
  week: { resolved: number; assigned: number; avgSatisfaction: number; productivity: number }
  month: { resolved: number; assigned: number; totalHours: number; efficiency: number }
}

interface CatStat {
  name: string
  resolved: number
  pending: number
  avgTime: string
  color: string
}

export default function TechnicianStatsPage() {
  // ── Todos los hooks PRIMERO, sin ningún return antes ──────────────────────
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<TechStats | null>(null)
  const [categoryStats, setCategoryStats] = useState<CatStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadStats = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      const res = await fetch('/api/technician/stats', { cache: 'no-store' })
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const data = await res.json()
      if (data.success) {
        setStats(data.stats)
        setCategoryStats(data.categoryStats ?? [])
      } else {
        throw new Error(data.error || 'Error al cargar estadísticas')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar estadísticas')
    } finally {
      setLoading(false)
    }
  }, [])

  useLiveTicketRefresh(
    useCallback(() => {
      void loadStats(true)
    }, [loadStats])
  )

  // useEffect siempre se llama — la carga real solo ocurre si hay sesión válida
  useEffect(() => {
    if (status === 'loading') return
    if (!session || session.user.role !== 'TECHNICIAN') return
    void loadStats(false)
  }, [status, session?.user?.id, loadStats])

  // ── Returns condicionales DESPUÉS de todos los hooks ─────────────────────
  if (status === 'loading') return null

  if (!session || session.user.role !== 'TECHNICIAN') {
    router.push('/login')
    return null
  }

  const s = stats ?? {
    today: { resolved: 0, assigned: 0, avgResponseTime: '—', avgResolutionTime: '—' },
    week: { resolved: 0, assigned: 0, avgSatisfaction: 0, productivity: 0 },
    month: { resolved: 0, assigned: 0, totalHours: 0, efficiency: 0 },
  }

  return (
    <ModuleLayout
      title='Mis Estadísticas'
      subtitle='Análisis de rendimiento y productividad'
      loading={loading && !stats}
      error={error}
      onRetry={loadStats}
      headerActions={
        <Button variant='outline' size='sm' onClick={loadStats} disabled={loading}>
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
              value={s.today.resolved}
              icon={CheckCircle}
              color='green'
            />
            <SymmetricStatsCard
              title='Asignados'
              value={s.today.assigned}
              icon={Target}
              color='blue'
            />
            <SymmetricStatsCard
              title='Tiempo Respuesta'
              value={s.today.avgResponseTime}
              icon={Zap}
              color='purple'
            />
            <SymmetricStatsCard
              title='Tiempo Resolución'
              value={s.today.avgResolutionTime}
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
              value={s.week.resolved}
              icon={CheckCircle}
              color='green'
            />
            <SymmetricStatsCard
              title='Asignados'
              value={s.week.assigned}
              icon={Target}
              color='blue'
            />
            <SymmetricStatsCard
              title='Satisfacción'
              value={`${s.week.avgSatisfaction}/5`}
              icon={Star}
              color='orange'
              status={
                s.week.avgSatisfaction >= 4.5
                  ? 'success'
                  : s.week.avgSatisfaction >= 4
                    ? 'normal'
                    : 'warning'
              }
            />
            <SymmetricStatsCard
              title='Productividad'
              value={`${s.week.productivity}%`}
              icon={TrendingUp}
              color='purple'
              status={
                s.week.productivity >= 80
                  ? 'success'
                  : s.week.productivity >= 60
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
              value={s.month.resolved}
              icon={CheckCircle}
              color='green'
            />
            <SymmetricStatsCard
              title='Asignados'
              value={s.month.assigned}
              icon={Target}
              color='blue'
            />
            <SymmetricStatsCard
              title='Horas Trabajadas'
              value={s.month.totalHours}
              icon={Clock}
              color='purple'
            />
            <SymmetricStatsCard
              title='Eficiencia'
              value={`${s.month.efficiency}%`}
              icon={Award}
              color='orange'
              status={
                s.month.efficiency >= 90
                  ? 'success'
                  : s.month.efficiency >= 70
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
            <CardDescription>Rendimiento en tus categorías asignadas este mes</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryStats.length === 0 ? (
              <div className='text-center py-8'>
                <Users className='h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50' />
                <p className='text-sm text-muted-foreground'>
                  No hay estadísticas de categorías disponibles este mes
                </p>
              </div>
            ) : (
              <div className='space-y-3'>
                {categoryStats.map((cat, i) => (
                  <div
                    key={i}
                    className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 border border-border rounded-lg'
                  >
                    <div className='flex items-center space-x-3'>
                      <div
                        className='w-3 h-3 rounded-full flex-shrink-0'
                        style={{ backgroundColor: cat.color || '#6B7280' }}
                      />
                      <div>
                        <p className='font-medium text-foreground'>{cat.name}</p>
                        <p className='text-xs text-muted-foreground'>
                          Tiempo promedio: {cat.avgTime}
                        </p>
                      </div>
                    </div>
                    <div className='flex items-center gap-2 flex-wrap'>
                      <Badge
                        variant='secondary'
                        className='bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300'
                      >
                        {cat.resolved} resueltos
                      </Badge>
                      <Badge
                        variant='secondary'
                        className='bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300'
                      >
                        {cat.pending} pendientes
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
                  value: s.month.resolved,
                  max: 100,
                  color: 'bg-green-600 dark:bg-green-500',
                },
                {
                  label: 'Satisfacción (Meta: 4.5/5)',
                  value: s.week.avgSatisfaction,
                  max: 5,
                  color: 'bg-yellow-500',
                },
                {
                  label: 'Eficiencia (Meta: 90%)',
                  value: s.month.efficiency,
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
