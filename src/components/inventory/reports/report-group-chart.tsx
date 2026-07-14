'use client'

import { useMemo, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  buildGroupChartPoints,
  formatChartMetricValue,
  getGroupedChartMetrics,
  type GroupChartPoint,
} from '@/lib/inventory/reports/chart-data'

const CHART_COLORS = [
  'hsl(var(--primary))',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#f97316',
  '#84cc16',
  '#ec4899',
  '#6366f1',
  '#14b8a6',
  '#a855f7',
]

function ChartTooltipContent({
  active,
  payload,
  datasetId,
  metricKey,
}: {
  active?: boolean
  payload?: any[]
  datasetId: string
  metricKey: string
}) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload as GroupChartPoint | undefined
  if (!point) return null
  return (
    <div className='rounded-lg border bg-card shadow-md px-3 py-2 text-sm'>
      <p className='font-medium'>{point.fullName}</p>
      <p className='text-muted-foreground'>
        {formatChartMetricValue(point.value, metricKey, datasetId)}
      </p>
    </div>
  )
}

export function ReportGroupChart({
  datasetId,
  rows,
  groupByLabel,
}: {
  datasetId: string
  rows: Record<string, unknown>[]
  groupByLabel?: string
}) {
  const metrics = useMemo(
    () => getGroupedChartMetrics(datasetId, rows[0]),
    [datasetId, rows]
  )
  const [metricKey, setMetricKey] = useState(metrics[0]?.key ?? 'cantidad')
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar')

  const chartPoints = useMemo(
    () => buildGroupChartPoints(rows, metricKey),
    [rows, metricKey]
  )

  const effectiveMetric = metrics.some(m => m.key === metricKey)
    ? metricKey
    : (metrics[0]?.key ?? 'cantidad')

  const showPie = chartPoints.length <= 8 && chartPoints.length > 0
  const activeChart = chartType === 'pie' && showPie ? 'pie' : 'bar'

  if (!chartPoints.length) return null

  const metricLabel = metrics.find(m => m.key === effectiveMetric)?.label ?? 'Valor'

  return (
    <Card>
      <CardHeader className='pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0'>
        <CardTitle className='text-sm flex items-center gap-2'>
          <BarChart3 className='h-4 w-4' />
          Visualización
          {groupByLabel && (
            <span className='font-normal text-muted-foreground'>· {groupByLabel}</span>
          )}
        </CardTitle>
        <div className='flex flex-wrap items-center gap-3'>
          <div className='flex items-center gap-2'>
            <Label className='text-xs text-muted-foreground shrink-0'>Métrica</Label>
            <Select value={effectiveMetric} onValueChange={setMetricKey}>
              <SelectTrigger className='h-8 w-[160px]'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {metrics.map(m => (
                  <SelectItem key={m.key} value={m.key}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {showPie && (
            <div className='flex items-center gap-2'>
              <Label className='text-xs text-muted-foreground shrink-0'>Tipo</Label>
              <Select value={activeChart} onValueChange={v => setChartType(v as 'bar' | 'pie')}>
                <SelectTrigger className='h-8 w-[120px]'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='bar'>Barras</SelectItem>
                  <SelectItem value='pie'>Pastel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className='h-[280px] w-full'>
          <ResponsiveContainer width='100%' height='100%'>
            {activeChart === 'pie' ? (
              <PieChart>
                <Pie
                  data={chartPoints}
                  dataKey='value'
                  nameKey='name'
                  cx='50%'
                  cy='50%'
                  outerRadius={100}
                  label={entry => entry.name}
                >
                  {chartPoints.map((_, index) => (
                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  content={
                    <ChartTooltipContent
                      datasetId={datasetId}
                      metricKey={effectiveMetric}
                    />
                  }
                />
              </PieChart>
            ) : (
              <BarChart data={chartPoints} margin={{ top: 8, right: 8, left: 0, bottom: 48 }}>
                <CartesianGrid strokeDasharray='3 3' className='stroke-muted' />
                <XAxis
                  dataKey='name'
                  tick={{ fontSize: 11 }}
                  angle={-35}
                  textAnchor='end'
                  interval={0}
                  height={60}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={v =>
                    formatChartMetricValue(Number(v), effectiveMetric, datasetId)
                  }
                />
                <Tooltip
                  content={
                    <ChartTooltipContent
                      datasetId={datasetId}
                      metricKey={effectiveMetric}
                    />
                  }
                />
                <Bar dataKey='value' name={metricLabel} radius={[4, 4, 0, 0]}>
                  {chartPoints.map((_, index) => (
                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
        {rows.length > chartPoints.length && (
          <p className='text-xs text-muted-foreground mt-2 text-center'>
            Mostrando top {chartPoints.length} de {rows.length} grupos en el gráfico
          </p>
        )}
      </CardContent>
    </Card>
  )
}
