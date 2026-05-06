'use client'

/**
 * Trends Tab Component
 * Shows temporal trends with charts and tables
 */

import { TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
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

// Palette for multi-family stacked bars
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

  // Totales para KPIs
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

  // Build chart data
  const { chartData, familyKeys } = (() => {
    if (!isAllFamilies) {
      return {
        chartData: data.map(d => ({ period: d.period, count: d.count })),
        familyKeys: [] as string[],
      }
    }
    const familyNames = Array.from(new Set(data.map(d => d.familyName ?? 'Sin familia')))
    const periodMap = new Map<string, Record<string, number>>()
    for (const d of data) {
      const fname = d.familyName ?? 'Sin familia'
      if (!periodMap.has(d.period)) periodMap.set(d.period, {})
      periodMap.get(d.period)![fname] = (periodMap.get(d.period)![fname] ?? 0) + d.count
    }
    const chartData = Array.from(periodMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, counts]) => ({ period, ...counts }))
    return { chartData, familyKeys: familyNames }
  })()

  // Table data
  const tableData = (() => {
    if (!isAllFamilies) return data.map(d => ({ period: d.period, count: d.count }))
    const map = new Map<string, number>()
    for (const d of data) map.set(d.period, (map.get(d.period) ?? 0) + d.count)
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, count]) => ({ period, count }))
  })()

  return (
    <div className='space-y-4'>
      {/* KPIs */}
      <div className='grid grid-cols-2 sm:grid-cols-3 gap-3'>
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
            <p className='text-xs text-muted-foreground'>Variación vs anterior</p>
            <p
              className={`text-2xl font-bold mt-1 ${
                trend === null
                  ? 'text-muted-foreground'
                  : trend > 0
                    ? 'text-orange-600 dark:text-orange-400'
                    : trend < 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-muted-foreground'
              }`}
            >
              {trend === null ? '—' : `${trend > 0 ? '+' : ''}${trend}%`}
            </p>
          </CardContent>
        </Card>
      </div>

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
            {/* Chart */}
            <ResponsiveContainer width='100%' height={300}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray='3 3' stroke='currentColor' opacity={0.1} />
                <XAxis
                  dataKey='period'
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={30}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 6,
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    color: 'hsl(var(--foreground))',
                  }}
                />
                {isAllFamilies && familyKeys.length > 0 ? (
                  <>
                    <Legend wrapperStyle={{ fontSize: 12 }} />
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
                  </>
                ) : (
                  <Bar
                    dataKey='count'
                    fill={FAMILY_COLORS[0]}
                    radius={[4, 4, 0, 0]}
                    name='Tickets'
                    minPointSize={2}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>

            {/* Table */}
            <div className='overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='border-b bg-muted/50'>
                    <th className='text-left p-3 font-medium'>Período</th>
                    <th className='text-right p-3 font-medium'>Tickets</th>
                    <th className='text-right p-3 font-medium'>Variación</th>
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
                      <tr key={row.period} className='border-b hover:bg-muted/30 transition-colors'>
                        <td className='p-3 font-mono text-sm'>{row.period}</td>
                        <td className='p-3 text-right font-semibold'>{row.count}</td>
                        <td className='p-3 text-right'>
                          {delta === null ? (
                            <span className='text-muted-foreground'>—</span>
                          ) : (
                            <span
                              className={
                                delta > 0
                                  ? 'text-orange-600 dark:text-orange-400'
                                  : delta < 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-muted-foreground'
                              }
                            >
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
                  <tr className='border-t-2 bg-muted/50 font-semibold'>
                    <td className='p-3'>Total</td>
                    <td className='p-3 text-right'>{totalTickets.toLocaleString()}</td>
                    <td className='p-3 text-right text-muted-foreground'>—</td>
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
