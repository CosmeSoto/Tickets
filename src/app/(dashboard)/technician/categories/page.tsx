'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { BackToTickets } from '@/components/tickets/back-to-tickets'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SymmetricStatsCard } from '@/components/shared/stats-card'
import { ExportButton } from '@/components/common/export-button'
import { useExport } from '@/hooks/common/use-export'
import { useModuleData } from '@/hooks/common/use-module-data'
import {
  FolderTree,
  Search,
  Ticket,
  AlertCircle,
  CheckCircle,
  BarChart3,
  Eye,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  TrendingUp,
  Clock,
  Star,
  Zap,
  Activity,
  Calendar,
  Award,
  Target,
} from 'lucide-react'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface CategoryStats {
  open: number
  inProgress: number
  resolved: number
  total: number
}

interface TechnicianCategory {
  id: string
  categoryId: string
  name: string
  description: string
  color: string
  levelName: string
  categoryLevel: number
  parentId: string | null
  priority: number
  maxTickets: number | null
  autoAssign: boolean
  currentTickets: number
  utilization: number
  stats: CategoryStats
}

interface TechStats {
  today: { resolved: number; assigned: number; avgResponseTime: string; avgResolutionTime: string }
  week: { resolved: number; assigned: number; avgSatisfaction: number; productivity: number }
  month: { resolved: number; assigned: number; totalHours: number; efficiency: number }
}

type SortField = 'name' | 'total' | 'open' | 'resolved' | 'current' | 'resolution'
type SortDir = 'asc' | 'desc'
type StatusFilter = 'all' | 'with_open' | 'with_resolved'
type LevelFilter = 'all' | '1' | '2' | '3' | '4'

const PAGE_SIZE = 20

// ── Helper ────────────────────────────────────────────────────────────────────

function resolutionRate(cat: TechnicianCategory): number {
  const t = cat.stats?.total ?? 0
  if (t === 0) return 0
  return Math.round(((cat.stats?.resolved ?? 0) / t) * 100)
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function TechnicianCategoriesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // ── Estados de UI ─────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(1)
  const [statsOpen, setStatsOpen] = useState(false)

  // ── Datos: categorías ─────────────────────────────────────────────────────
  const {
    data: categories,
    loading,
    error,
    reload,
  } = useModuleData<TechnicianCategory>({
    endpoint: '/api/technician/categories',
    initialLoad: true,
  })

  // ── Datos: estadísticas personales (lazy, al expandir) ────────────────────
  const [techStats, setTechStats] = useState<TechStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)

  const loadStats = useCallback(async () => {
    if (techStats || statsLoading) return
    setStatsLoading(true)
    try {
      const res = await fetch('/api/technician/stats', { cache: 'no-store' })
      const data = await res.json()
      if (data.success) setTechStats(data.stats)
    } catch {
      /* silencioso */
    } finally {
      setStatsLoading(false)
    }
  }, [techStats, statsLoading])

  useEffect(() => {
    if (statsOpen) loadStats()
  }, [statsOpen, loadStats])

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return categories.filter(cat => {
      if (
        searchQuery &&
        !cat.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !(cat.description?.toLowerCase() ?? '').includes(searchQuery.toLowerCase())
      )
        return false
      if (levelFilter !== 'all' && String(cat.categoryLevel) !== levelFilter) return false
      if (statusFilter === 'with_open' && (cat.stats?.open ?? 0) === 0) return false
      if (statusFilter === 'with_resolved' && (cat.stats?.resolved ?? 0) === 0) return false
      return true
    })
  }, [categories, searchQuery, levelFilter, statusFilter])

  // ── Ordenamiento ──────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va: number | string = 0
      let vb: number | string = 0
      switch (sortField) {
        case 'name':
          va = a.name
          vb = b.name
          break
        case 'total':
          va = a.stats?.total ?? 0
          vb = b.stats?.total ?? 0
          break
        case 'open':
          va = a.stats?.open ?? 0
          vb = b.stats?.open ?? 0
          break
        case 'resolved':
          va = a.stats?.resolved ?? 0
          vb = b.stats?.resolved ?? 0
          break
        case 'current':
          va = a.currentTickets ?? 0
          vb = b.currentTickets ?? 0
          break
        case 'resolution':
          va = resolutionRate(a)
          vb = resolutionRate(b)
          break
      }
      if (typeof va === 'string')
        return sortDir === 'asc' ? va.localeCompare(vb as string) : (vb as string).localeCompare(va)
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })
  }, [filtered, sortField, sortDir])

  // ── Exportación con el componente canónico ────────────────────────────────
  const { exportCSV, exportExcel, exportPDF, exporting } = useExport<TechnicianCategory>({
    filename: 'mis-categorias',
    title: 'Mis Categorías',
    getData: () => sorted,
    columns: [
      { key: 'name', label: 'Categoría' },
      { key: 'levelName', label: 'Nivel' },
      { key: 'stats', label: 'Total área', format: (v: CategoryStats) => String(v?.total ?? 0) },
      { key: 'stats', label: 'Abiertos', format: (v: CategoryStats) => String(v?.open ?? 0) },
      { key: 'stats', label: 'Resueltos', format: (v: CategoryStats) => String(v?.resolved ?? 0) },
      {
        key: 'currentTickets',
        label: 'Mis tickets activos',
        format: (v: number) => String(v ?? 0),
      },
      {
        key: 'maxTickets',
        label: 'Capacidad máx.',
        format: (v: number | null) => (v != null ? String(v) : '—'),
      },
      {
        key: 'id',
        label: 'Tasa resolución %',
        format: (_: string, row: TechnicianCategory) => String(resolutionRate(row)),
      },
      { key: 'autoAssign', label: 'Auto-asignación', format: (v: boolean) => (v ? 'Sí' : 'No') },
    ],
  })

  // ── Guards de sesión ──────────────────────────────────────────────────────
  if (status === 'loading') return null
  if (!session || session.user.role !== 'TECHNICIAN') {
    router.push('/login')
    return null
  }

  // ── Totales globales ──────────────────────────────────────────────────────
  const totalTickets = categories.reduce((s, c) => s + (c.stats?.total ?? 0), 0)
  const totalOpen = categories.reduce((s, c) => s + (c.stats?.open ?? 0), 0)
  const totalResolved = categories.reduce((s, c) => s + (c.stats?.resolved ?? 0), 0)

  // ── Paginación ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginated = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortField(field)
      setSortDir('asc')
    }
    setPage(1)
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className='h-3.5 w-3.5 opacity-40 ml-1' />
    return sortDir === 'asc' ? (
      <ArrowUp className='h-3.5 w-3.5 ml-1 text-primary' />
    ) : (
      <ArrowDown className='h-3.5 w-3.5 ml-1 text-primary' />
    )
  }

  const s = techStats ?? {
    today: { resolved: 0, assigned: 0, avgResponseTime: '—', avgResolutionTime: '—' },
    week: { resolved: 0, assigned: 0, avgSatisfaction: 0, productivity: 0 },
    month: { resolved: 0, assigned: 0, totalHours: 0, efficiency: 0 },
  }

  return (
    <ModuleLayout
      title='Mis Categorías'
      subtitle={`${categories.length} categoría${categories.length !== 1 ? 's' : ''} asignada${categories.length !== 1 ? 's' : ''}`}
      loading={loading && categories.length === 0}
      error={error}
      onRetry={reload}
      headerActions={
        <ExportButton
          onExportCSV={exportCSV}
          onExportExcel={exportExcel}
          onExportPDF={exportPDF}
          loading={exporting}
          disabled={sorted.length === 0}
        />
      }
    >
      <div className='space-y-4'>
        <BackToTickets />

        {/* ── Resumen global ── */}
        <div className='grid grid-cols-3 gap-3'>
          <SymmetricStatsCard
            title='Total Tickets'
            value={totalTickets}
            icon={Ticket}
            color='blue'
          />
          <SymmetricStatsCard
            title='Abiertos'
            value={totalOpen}
            icon={AlertCircle}
            color='orange'
            status={totalOpen > 10 ? 'warning' : 'normal'}
          />
          <SymmetricStatsCard
            title='Resueltos'
            value={totalResolved}
            icon={CheckCircle}
            color='green'
            status='success'
          />
        </div>

        {/* ── Panel de rendimiento personal (colapsable) ── */}
        <div className='rounded-lg border bg-card overflow-hidden'>
          <button
            type='button'
            onClick={() => setStatsOpen(v => !v)}
            className='w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors'
          >
            <div className='flex items-center gap-2'>
              <BarChart3 className='h-4 w-4 text-purple-500' />
              <span className='text-sm font-semibold'>Mi Rendimiento</span>
              <Badge variant='secondary' className='text-xs'>
                Hoy · Semana · Mes
              </Badge>
            </div>
            {statsOpen ? (
              <ChevronUp className='h-4 w-4 text-muted-foreground' />
            ) : (
              <ChevronDown className='h-4 w-4 text-muted-foreground' />
            )}
          </button>

          {statsOpen && (
            <div className='border-t px-4 py-4 space-y-4'>
              {statsLoading ? (
                <div className='flex justify-center py-6'>
                  <RefreshCw className='h-5 w-5 animate-spin text-muted-foreground' />
                </div>
              ) : (
                <>
                  <div>
                    <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5'>
                      <Calendar className='h-3.5 w-3.5' /> Hoy
                    </p>
                    <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
                      <SymmetricStatsCard
                        title='Resueltos'
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
                        title='T. Respuesta'
                        value={s.today.avgResponseTime}
                        icon={Zap}
                        color='purple'
                      />
                      <SymmetricStatsCard
                        title='T. Resolución'
                        value={s.today.avgResolutionTime}
                        icon={Clock}
                        color='orange'
                      />
                    </div>
                  </div>
                  <div>
                    <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5'>
                      <Activity className='h-3.5 w-3.5' /> Esta semana
                    </p>
                    <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
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
                  <div>
                    <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5'>
                      <BarChart3 className='h-3.5 w-3.5' /> Este mes
                    </p>
                    <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
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
                        title='Horas'
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
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Filtros ── */}
        <div className='flex flex-wrap gap-2'>
          <div className='relative flex-1 min-w-[200px]'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none' />
            <Input
              placeholder='Buscar categorías...'
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
              className='pl-9'
            />
          </div>
          <Select
            value={levelFilter}
            onValueChange={v => {
              setLevelFilter(v as LevelFilter)
              setPage(1)
            }}
          >
            <SelectTrigger className='w-[140px]'>
              <SelectValue placeholder='Nivel' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Todos los niveles</SelectItem>
              <SelectItem value='1'>Nivel 1</SelectItem>
              <SelectItem value='2'>Nivel 2</SelectItem>
              <SelectItem value='3'>Nivel 3</SelectItem>
              <SelectItem value='4'>Nivel 4</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={v => {
              setStatusFilter(v as StatusFilter)
              setPage(1)
            }}
          >
            <SelectTrigger className='w-[160px]'>
              <SelectValue placeholder='Estado' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Todos</SelectItem>
              <SelectItem value='with_open'>Con tickets abiertos</SelectItem>
              <SelectItem value='with_resolved'>Con resueltos</SelectItem>
            </SelectContent>
          </Select>
          {(searchQuery || levelFilter !== 'all' || statusFilter !== 'all') && (
            <Button
              variant='ghost'
              size='sm'
              onClick={() => {
                setSearchQuery('')
                setLevelFilter('all')
                setStatusFilter('all')
                setPage(1)
              }}
            >
              Limpiar
            </Button>
          )}
        </div>

        {/* ── Tabla ── */}
        <Card>
          <CardContent className='p-0'>
            {filtered.length === 0 ? (
              <div className='text-center py-12'>
                <FolderTree className='h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-40' />
                <p className='text-sm text-muted-foreground'>
                  {searchQuery || levelFilter !== 'all' || statusFilter !== 'all'
                    ? 'No se encontraron categorías con esos filtros'
                    : 'No tienes categorías asignadas'}
                </p>
              </div>
            ) : (
              <>
                <div className='overflow-x-auto'>
                  <table className='w-full text-sm'>
                    <thead>
                      <tr className='border-b bg-muted/40'>
                        <th className='text-left px-4 py-2.5 font-medium text-muted-foreground'>
                          <button className='flex items-center' onClick={() => handleSort('name')}>
                            Categoría <SortIcon field='name' />
                          </button>
                        </th>
                        <th className='text-center px-3 py-2.5 font-medium text-muted-foreground hidden sm:table-cell'>
                          <button
                            className='flex items-center mx-auto'
                            onClick={() => handleSort('total')}
                          >
                            Total <SortIcon field='total' />
                          </button>
                        </th>
                        <th className='text-center px-3 py-2.5 font-medium text-muted-foreground'>
                          <button
                            className='flex items-center mx-auto'
                            onClick={() => handleSort('open')}
                          >
                            Abiertos <SortIcon field='open' />
                          </button>
                        </th>
                        <th className='text-center px-3 py-2.5 font-medium text-muted-foreground hidden md:table-cell'>
                          <button
                            className='flex items-center mx-auto'
                            onClick={() => handleSort('resolved')}
                          >
                            Resueltos <SortIcon field='resolved' />
                          </button>
                        </th>
                        <th className='text-center px-3 py-2.5 font-medium text-muted-foreground hidden lg:table-cell'>
                          <button
                            className='flex items-center mx-auto'
                            onClick={() => handleSort('current')}
                          >
                            Mis activos <SortIcon field='current' />
                          </button>
                        </th>
                        <th className='text-center px-3 py-2.5 font-medium text-muted-foreground hidden lg:table-cell'>
                          <button
                            className='flex items-center mx-auto'
                            onClick={() => handleSort('resolution')}
                          >
                            Resolución <SortIcon field='resolution' />
                          </button>
                        </th>
                        <th className='px-4 py-2.5 font-medium text-muted-foreground text-right'>
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className='divide-y'>
                      {paginated.map(cat => {
                        const rate = resolutionRate(cat)
                        return (
                          <tr
                            key={cat.id}
                            className='hover:bg-muted/30 transition-colors cursor-pointer'
                            onClick={() =>
                              router.push(`/technician/tickets?category=${cat.categoryId}`)
                            }
                          >
                            <td className='px-4 py-3'>
                              <div className='flex items-center gap-2 min-w-0'>
                                <span
                                  className='w-2.5 h-2.5 rounded-full shrink-0'
                                  style={{ backgroundColor: cat.color || '#6B7280' }}
                                />
                                <div className='min-w-0'>
                                  <p className='font-medium truncate'>{cat.name}</p>
                                  {cat.description && (
                                    <p className='text-xs text-muted-foreground truncate max-w-[220px]'>
                                      {cat.description}
                                    </p>
                                  )}
                                </div>
                                <Badge
                                  variant='outline'
                                  className='text-xs shrink-0 hidden sm:inline-flex'
                                >
                                  {cat.levelName}
                                </Badge>
                              </div>
                            </td>
                            <td className='px-3 py-3 text-center tabular-nums hidden sm:table-cell'>
                              {cat.stats?.total ?? 0}
                            </td>
                            <td className='px-3 py-3 text-center tabular-nums'>
                              <span
                                className={`font-medium ${(cat.stats?.open ?? 0) > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'}`}
                              >
                                {cat.stats?.open ?? 0}
                              </span>
                            </td>
                            <td className='px-3 py-3 text-center tabular-nums hidden md:table-cell'>
                              <span
                                className={`font-medium ${(cat.stats?.resolved ?? 0) > 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}
                              >
                                {cat.stats?.resolved ?? 0}
                              </span>
                            </td>
                            <td className='px-3 py-3 text-center tabular-nums hidden lg:table-cell'>
                              <span className='font-medium'>{cat.currentTickets ?? 0}</span>
                              {cat.maxTickets && (
                                <span className='text-xs text-muted-foreground'>
                                  /{cat.maxTickets}
                                </span>
                              )}
                            </td>
                            <td className='px-3 py-3 hidden lg:table-cell'>
                              <div className='flex items-center gap-2 min-w-[80px]'>
                                <div className='flex-1 h-1.5 bg-muted rounded-full overflow-hidden'>
                                  <div
                                    className='h-full bg-green-500 rounded-full transition-all'
                                    style={{ width: `${rate}%` }}
                                  />
                                </div>
                                <span className='text-xs text-muted-foreground tabular-nums w-8 text-right'>
                                  {rate}%
                                </span>
                              </div>
                            </td>
                            <td className='px-4 py-3 text-right' onClick={e => e.stopPropagation()}>
                              <Button
                                variant='ghost'
                                size='sm'
                                className='h-7 text-xs'
                                onClick={() =>
                                  router.push(`/technician/tickets?category=${cat.categoryId}`)
                                }
                              >
                                <Eye className='h-3.5 w-3.5 mr-1' />
                                Ver
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Paginación */}
                {totalPages > 1 && (
                  <div className='flex items-center justify-between px-4 py-3 border-t bg-muted/20'>
                    <p className='text-xs text-muted-foreground'>
                      {sorted.length} categorías · página {safePage} de {totalPages}
                    </p>
                    <div className='flex items-center gap-1'>
                      <Button
                        variant='outline'
                        size='sm'
                        className='h-7 w-7 p-0'
                        disabled={safePage === 1}
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                      >
                        <ChevronLeft className='h-4 w-4' />
                      </Button>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const pg =
                          safePage <= 3
                            ? i + 1
                            : safePage >= totalPages - 2
                              ? totalPages - 4 + i
                              : safePage - 2 + i
                        if (pg < 1 || pg > totalPages) return null
                        return (
                          <Button
                            key={pg}
                            variant={pg === safePage ? 'default' : 'outline'}
                            size='sm'
                            className='h-7 w-7 p-0 text-xs'
                            onClick={() => setPage(pg)}
                          >
                            {pg}
                          </Button>
                        )
                      })}
                      <Button
                        variant='outline'
                        size='sm'
                        className='h-7 w-7 p-0'
                        disabled={safePage === totalPages}
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      >
                        <ChevronRight className='h-4 w-4' />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </ModuleLayout>
  )
}
