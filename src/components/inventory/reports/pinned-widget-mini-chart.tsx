'use client'

import { Bar, BarChart, ResponsiveContainer } from 'recharts'
import { buildGroupChartPoints } from '@/lib/inventory/reports/chart-data'

export function PinnedWidgetMiniChart({ rows }: { rows: Record<string, unknown>[] }) {
  const points = buildGroupChartPoints(rows, 'cantidad', 6)
  if (points.length < 2) return null

  return (
    <div className='h-12 mt-2 pl-6'>
      <ResponsiveContainer width='100%' height='100%'>
        <BarChart data={points} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <Bar dataKey='value' fill='hsl(var(--primary) / 0.75)' radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
