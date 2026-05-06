'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { TemporalTrendPoint, Granularity } from '../utils/report-types'
import { TabLoadingState, TabEmptyState } from './shared-tab-states'

interface TrendsTabProps {
  data: TemporalTrendPoint[]
  loading: boolean
  granularity: Granularity
  onGranularityChange: (g: Granularity) => void
  isAllFamilies: boolean
}

const FAMILY_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#f97316',
  '#84cc16',
  '#ec4899',
  '#6366f1',
]

// Tooltip personalizado con tema
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className='rounded-lg border border-border bg-card shadow-lg px-3 py-2 text-sm'>
      <p className='font-medium text-foreground mb-1'>{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className='flex items-center gap-2'>
          <span className='h-2 w-2 rounded-full' style={{ backgroundColor: entry.color }} />
          <span className='text-muted-foreground'>{entry.name}:</span>
          <span className='font-semibold text-foreground'>{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export function TrendsTab({
  data,
  loading,
  granularity,
  onGranularityChange,
  isAllFamilies,
}: TrendsTabProps) {
  if (loading) return <TabLoadingState />
  if (data.length === 0)
    return (
      <Card>
        <CardHeader>
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
            <CardTitle className='flex items-center gap-2'>
              <TrendingUp className='h-5 w-5' />
              Tendencias Temporales
            </CardTitle>
            <Select value={granularity} onValueChange={v => onGranularityChange(v as Granularity)}>
              <SelectTrigger className='w-36'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='day'>Diario</SelectItem>
                <SelectItem value='week'>Semanal</SelectItem>
                <SelectItem value='month'>Mensual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <TabEmptyState message='No hay datos de tendencias para el período seleccionado.' />
        </CardContent>
      </Card>
    )

  // ── Cálculos ──────────────────────────────────────────────────────────────
  const totalTickets = data.reduce((s, d) => s + d.count, 0)
  const periods = Array.from(new Set(data.map(d => d.period))).sort()

  const lastPeriodCount = (() => {
    const last = periods[periods.length - 1]
    return data.filter(d => d.period === last).reduce((s, d) => s + d.count, 0)
  })()

  const prevPeriodCount = (() => {
    if (periods.length < 2) return null
    const prev = periods[periods.length - 2]
    return data.filter(d => d.period === prev).reduce((s, d) => s + d.count, 0)
  })()

  const trend =
    prevPeriodCount !== null && prevPeriodCount > 0
      ? Math.round(((lastPeriodCount - prevPeriodCount) / prevPeriodCount) * 100)
      : null

  const avgPerPeriod = periods.length > 0 ? Math.round(totalTickets / periods.length) : 0

  // ── Datos del gráfico ─────────────────────────────────────────────────────
  // Siempre normalizar a { period, Tickets } para familia única
  // y { period, [familyName]: count } para multi-familia
  const { chartData, familyKeys } = (() => {
    if (!isAllFamilies) {
      // Familia específica seleccionada
      return {
        chartData: data.map(d => ({ period: d.period, Tickets: d.count })),
        familyKeys: [] as string[],
      }
    }

    // Todas las familias — agrupar por período
    const familyNames = Array.from(new Set(data.map(d => d.familyName ?? 'Sin familia')))

    if (familyNames.length <= 1) {
      // Una sola familia aunque sea "todas" — usar clave simple
      const map = new Map<string, number>()
      for (const d of data) map.set(d.period, (map.get(d.period) ?? 0) + d.count)
      return {
        chartData: Array.from(map.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([period, count]) => ({ period, Tickets: count })),
        familyKeys: [] as string[],
      }
    }

    // Múltiples familias — clave por nombre de familia
    const periodMap = new Map<string, Record<string, number>>()
    for (const d of data) {
      const fname = d.familyName ?? 'Sin familia'
      if (!periodMap.has(d.period)) periodMap.set(d.period, {})
      periodMap.get(d.period)![fname] = (periodMap.get(d.period)![fname] ?? 0) + d.count
    }
    return {
      chartData: Array.from(periodMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, counts]) => ({ period, ...counts })),
      familyKeys: familyNames,
    }
  })()

  // Tabla
  const tableData = (() => {
    if (!isAllFamilies) return data.map(d => ({ period: d.period, count: d.count }))
    const map = new Map<string, number>()
    for (const d of data) map.set(d.period, (map.get(d.period) ?? 0) + d.count)
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, count]) => ({ period, count }))
  })()

  const TrendIcon = trend === null ? Minus : trend > 0 ? TrendingUp : TrendingDown
  const trendColor =
    trend === null
      ? 'text-muted-foreground'
      : trend > 0
        ? 'text-orange-600 dark:text-orange-400'
        : 'text-emerald-600 dark:text-emerald-400'

  return (
    <div className='space-y-4'>
      {/* KPIs */}
      <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
        <Card>
          <CardContent className='pt-4 pb-3'>
            <p className='text-xs text-muted-foreground'>Total en el período</p>
            <p className='text-2xl font-bold mt-1'>{totalTickets.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-4 pb-3'>
            <p className='text-xs text-muted-foreground'>Último período</p>
            <p className='text-2xl font-bold mt-1'>{lastPeriodCount.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-4 pb-3'>
            <p className='text-xs text-muted-foreground'>Promedio por período</p>
            <p className='text-2xl font-bold mt-1'>{avgPerPeriod.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-4 pb-3'>
            <p className='text-xs text-muted-foreground'>Variación vs anterior</p>
            <div className='flex items-center gap-1.5 mt-1'>
              <TrendIcon className={`h-5 w-5 ${trendColor}`} />
              <p className={`text-2xl font-bold ${trendColor}`}>
                {trend === null ? '—' : `${trend > 0 ? '+' : ''}${trend}%`}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico */}
      <Card>
        <CardHeader>
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
            <div>
              <CardTitle className='flex items-center gap-2'>
                <TrendingUp className='h-5 w-5' />
                Tendencias Temporales
              </CardTitle>
              <CardDescription>
                Volumen de tickets creados por período
                {isAllFamilies ? ' — desglose por familia' : ''}
              </CardDescription>
            </div>
            <Select value={granularity} onValueChange={v => onGranularityChange(v as Granularity)}>
              <SelectTrigger className='w-36'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='day'>Diario</SelectItem>
                <SelectItem value='week'>Semanal</SelectItem>
                <SelectItem value='month'>Mensual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className='space-y-6'>
            {/* Gráfico */}
            <div className='w-full'>
              <ResponsiveContainer width='100%' height={300}>
                {familyKeys.length > 1 ? (
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid
                      strokeDasharray='3 3'
                      stroke='currentColor'
                      opacity={0.08}
                      vertical={false}
                    />
                    <XAxis
                      dataKey='period'
                      tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      width={28}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                      iconType='circle'
                      iconSize={8}
                    />
                    {familyKeys.map((fname, i) => (
                      <Bar
                        key={fname}
                        dataKey={fname}
                        stackId='a'
                        fill={FAMILY_COLORS[i % FAMILY_COLORS.length]}
                        radius={i === familyKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                        name={fname}
                        minPointSize={2}
                      />
                    ))}
                  </BarChart>
                ) : (
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <defs>
                      <linearGradient id='ticketGradient' x1='0' y1='0' x2='0' y2='1'>
                        <stop offset='5%' stopColor={FAMILY_COLORS[0]} stopOpacity={0.3} />
                        <stop offset='95%' stopColor={FAMILY_COLORS[0]} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray='3 3'
                      stroke='currentColor'
                      opacity={0.08}
                      vertical={false}
                    />
                    <XAxis
                      dataKey='period'
                      tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.6 }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      width={28}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type='monotone'
                      dataKey='Tickets'
                      stroke={FAMILY_COLORS[0]}
                      strokeWidth={2}
                      fill='url(#ticketGradient)'
                      dot={{ fill: FAMILY_COLORS[0], strokeWidth: 0, r: 3 }}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                    />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* Tabla de datos */}
            <div className='overflow-x-auto rounded-md border border-border'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='border-b bg-muted/50'>
                    <th className='text-left px-4 py-2.5 font-medium text-muted-foreground'>
                      Período
                    </th>
                    <th className='text-right px-4 py-2.5 font-medium text-muted-foreground'>
                      Tickets
                    </th>
                    <th className='text-right px-4 py-2.5 font-medium text-muted-foreground'>
                      Variación
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((row, idx) => {
                    const prev = idx > 0 ? tableData[idx - 1].count : null
                    const delta =
                      prev !== null && prev > 0
                        ? Math.round(((row.count - prev) / prev) * 100)
                        : null
                    return (
                      <tr
                        key={row.period}
                        className='border-b last:border-0 hover:bg-muted/30 transition-colors'
                      >
                        <td className='px-4 py-2.5 font-mono text-sm text-foreground'>
                          {row.period}
                        </td>
                        <td className='px-4 py-2.5 text-right font-semibold text-foreground'>
                          {row.count}
                        </td>
                        <td className='px-4 py-2.5 text-right'>
                          {delta === null ? (
                            <span className='text-muted-foreground'>—</span>
                          ) : (
                            <span
                              className={`font-medium flex items-center justify-end gap-1 ${
                                delta > 0
                                  ? 'text-orange-600 dark:text-orange-400'
                                  : delta < 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-muted-foreground'
                              }`}
                            >
                              {delta > 0 ? (
                                <TrendingUp className='h-3 w-3' />
                              ) : delta < 0 ? (
                                <TrendingDown className='h-3 w-3' />
                              ) : null}
                              {delta > 0 ? '+' : ''}
                              {delta}%
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className='border-t-2 bg-muted/50'>
                    <td className='px-4 py-2.5 font-semibold text-foreground'>Total</td>
                    <td className='px-4 py-2.5 text-right font-bold text-foreground'>
                      {totalTickets.toLocaleString()}
                    </td>
                    <td className='px-4 py-2.5 text-right text-muted-foreground'>—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
